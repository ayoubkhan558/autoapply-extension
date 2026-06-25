// AutoApply resume text extraction — no external libraries.
// Uses the browser's built-in DecompressionStream for DOCX/PDF.

function aaBytesToLatin1(bytes) {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return s;
}

async function aaInflate(bytes, format) {
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  // Catch write/close rejections so invalid data does not surface as an
  // uncaught promise rejection; the readable side rejects too and is handled below.
  const writeDone = writer.write(bytes)
    .then(function () { return writer.close(); })
    .catch(function () {});
  try {
    const ab = await new Response(ds.readable).arrayBuffer();
    await writeDone;
    return new Uint8Array(ab);
  } catch (e) {
    await writeDone;
    throw e;
  }
}

async function aaTryInflate(bytes) {
  const formats = ["deflate", "deflate-raw"];
  for (let i = 0; i < formats.length; i++) {
    try {
      return await aaInflate(bytes, formats[i]);
    } catch (e) { /* try next */ }
  }
  return null;
}

function aaDecodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ---- DOCX -------------------------------------------------------------
function aaUnzipEntry(bytes, target) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("Not a valid DOCX file.");
  const cdOffset = dv.getUint32(eocd + 16, true);
  const cdCount = dv.getUint16(eocd + 10, true);
  let p = cdOffset;
  for (let n = 0; n < cdCount; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === target) {
      const lhNameLen = dv.getUint16(localOffset + 26, true);
      const lhExtraLen = dv.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
      const data = bytes.subarray(dataStart, dataStart + compSize);
      return { method: method, data: data };
    }
    p = p + 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("word/document.xml not found in DOCX.");
}

function aaDocxXmlToText(xml) {
  const paras = xml.split(/<\/w:p>/);
  const lines = paras.map(function (para) {
    let txt = "";
    const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let m;
    while ((m = re.exec(para)) !== null) txt += m[1];
    return aaDecodeXmlEntities(txt);
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function aaExtractDocxText(bytes) {
  const entry = aaUnzipEntry(bytes, "word/document.xml");
  let raw;
  if (entry.method === 0) raw = entry.data;
  else raw = await aaInflate(entry.data, "deflate-raw");
  const xml = new TextDecoder("utf-8").decode(raw);
  return aaDocxXmlToText(xml);
}

// ---- PDF --------------------------------------------------------------
function aaPdfStringsFromContent(str) {
  let out = "";
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (c === "(") {
      let depth = 1;
      i++;
      let s = "";
      while (i < str.length && depth > 0) {
        const ch = str[i];
        if (ch === "\\") {
          const next = str[i + 1];
          if (next === "n") s += "\n";
          else if (next === "r") s += "";
          else if (next === "t") s += "\t";
          else s += next;
          i += 2;
          continue;
        }
        if (ch === "(") { depth++; s += ch; i++; continue; }
        if (ch === ")") { depth--; if (depth > 0) s += ch; i++; continue; }
        s += ch;
        i++;
      }
      out += s + " ";
    } else {
      i++;
    }
  }
  return out;
}

async function aaExtractPdfText(bytes) {
  const latin1 = aaBytesToLatin1(bytes);
  let text = "";
  let idx = 0;
  while (true) {
    const s = latin1.indexOf("stream", idx);
    if (s === -1) break;
    let dataStart = s + 6;
    if (latin1[dataStart] === "\r") dataStart++;
    if (latin1[dataStart] === "\n") dataStart++;
    const e = latin1.indexOf("endstream", dataStart);
    if (e === -1) break;
    const streamBytes = bytes.subarray(dataStart, e);
    const inflated = await aaTryInflate(streamBytes);
    let content = null;
    if (inflated) content = aaBytesToLatin1(inflated);
    else {
      const rawStr = aaBytesToLatin1(streamBytes);
      if (rawStr.indexOf("BT") !== -1 && rawStr.indexOf("Tj") !== -1) content = rawStr;
    }
    if (content && /[A-Za-z]/.test(content)) {
      text += aaPdfStringsFromContent(content) + "\n";
    }
    idx = e + 9;
  }
  return text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// ---- Public helpers ---------------------------------------------------
async function aaExtractText(file) {
  const name = (file.name || "").toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());
  if (name.endsWith(".pdf") || file.type === "application/pdf") return aaExtractPdfText(buf);
  if (name.endsWith(".docx")) return aaExtractDocxText(buf);
  if (name.endsWith(".doc")) throw new Error("Legacy .doc is not supported \u2014 export as PDF or DOCX.");
  return new TextDecoder("utf-8").decode(buf);
}

async function aaFileToBase64(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  return btoa(aaBytesToLatin1(buf));
}

function aaHeuristicProfile(text) {
  const prof = { personal: {}, links: {} };
  if (!text) return prof;
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (email) prof.personal.email = email[0];
  const phone = text.match(/\+?\d[\d\s().-]{7,}\d/);
  if (phone) prof.personal.phone = phone[0].trim();
  const li = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[A-Za-z0-9_\/-]+/i);
  if (li) prof.links.linkedin = li[0];
  const gh = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_\/-]+/i);
  if (gh) prof.links.github = gh[0];
  return prof;
}
