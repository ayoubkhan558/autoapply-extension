// Date parsing, format detection, and fill confidence markers.
// Classic-script module; dependency order is declared in config/modules.json.
// AutoApply content module. Loaded into the extension isolated world.
// DOM helpers, value transforms, fill primitives.
var HL_CLASS = "autoapply-filled";

// ---- Confidence indicators ------------------------------------------
function confClass(score) { return score >= 0.85 ? "aa-conf-high" : "aa-conf-guess"; }

function markFilled(el, score) {
  el.classList.remove("aa-conf-high");
  el.classList.remove("aa-conf-guess");
  el.classList.add(confClass(typeof score === "number" ? score : 0.9));
  el.classList.add(HL_CLASS);
  setTimeout(function () { el.classList.remove(HL_CLASS); }, 2500);
}

// ---- Date format auto-detection -------------------------------------
function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

function parseDateParts(value) {
  const v = String(value).trim();
  let m = v.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (m) return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
  m = v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (m) return { y: Number(m[3]), mo: Number(m[1]), d: Number(m[2]) };
  const dt = new Date(v);
  if (!isNaN(dt.getTime())) return { y: dt.getFullYear(), mo: dt.getMonth() + 1, d: dt.getDate() };
  return null;
}

function formatDate(parts, order, sep) {
  const y = String(parts.y);
  const mo = pad2(parts.mo);
  const d = pad2(parts.d);
  if (order === "mdy") return mo + sep + d + sep + y;
  if (order === "dmy") return d + sep + mo + sep + y;
  return y + sep + mo + sep + d;
}

function detectDatePattern(el, sig) {
  const attrPat = (el.getAttribute("date-pattern") || el.getAttribute("date-format") || el.getAttribute("data-date-format") || "").toLowerCase();
  const hay = (attrPat + " " + (el.placeholder || "") + " " + (el.title || "") + " " + ((sig && sig.text) || "")).toLowerCase();
  let sep = "/";
  if (hay.indexOf("-") !== -1 && /(dd|mm|yyyy)/.test(hay)) sep = "-";
  else if (/dd\.mm|mm\.dd/.test(hay)) sep = ".";
  if (/mm[\/\-.]dd[\/\-.](yyyy|yy)/.test(hay)) return { order: "mdy", sep: sep };
  if (/dd[\/\-.]mm[\/\-.](yyyy|yy)/.test(hay)) return { order: "dmy", sep: sep };
  if (/(yyyy|yy)[\/\-.]mm[\/\-.]dd/.test(hay)) return { order: "iso", sep: sep === "/" ? "-" : sep };
  return null;
}

function isDateField(el, sig) {
  const t = (el.type || "").toLowerCase();
  if (t === "date") return true;
  if (t === "number" || t === "email" || t === "tel" || t === "url") return false;
  const hay = (((sig && sig.text) || "") + " " + ((sig && sig.attr) || "") + " " + (el.placeholder || "")).toLowerCase();
  return /date of birth|\bdob\b|birth|\bdate\b|mm\/dd|dd\/mm|dd-mm|mm-dd|yyyy/.test(hay);
}

function normalizeDate(el, sig, value) {
  const parts = parseDateParts(value);
  if (!parts) return value;
  if ((el.type || "").toLowerCase() === "date") return formatDate(parts, "iso", "-");
  const pat = detectDatePattern(el, sig);
  if (!pat) return value;
  return formatDate(parts, pat.order, pat.sep);
}

// ---- Phone normalization --------------------------------------------
