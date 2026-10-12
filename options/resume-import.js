// Message bridge, attachment conversion, and parsed-CV profile merge.
// Classic-script module; dependency order is declared in config/modules.json.
function aaSendMessage(msg) {
  return new Promise(function (resolve, reject) {
    chrome.runtime.sendMessage(msg, function (resp) {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      resolve(resp);
    });
  });
}

function aaMergeObj(target, src) {
  if (!src) return;
  Object.keys(src).forEach(function (k) {
    const v = src[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") target[k] = String(v);
  });
}

function aaStrObj(o) {
  const out = {};
  Object.keys(o || {}).forEach(function (k) {
    const v = o[k];
    out[k] = (v === null || v === undefined) ? "" : String(v);
  });
  return out;
}

function aaMergeIntoProfile(prof, parsed) {
  if (!parsed) return;
  prof.personal = prof.personal || {};
  prof.address = prof.address || {};
  prof.links = prof.links || {};
  prof.professional = prof.professional || {};
  // AI/heuristic parsers report address fields under `personal`; route them
  // to the address group where the form now keeps them.
  const addressNames = AA_FIELD_DEFS.filter(function (d) { return d.group === "address"; }).map(function (d) { return d.name; });
  if (parsed.personal) {
    const personal = Object.assign({}, parsed.personal);
    const addr = {};
    addressNames.forEach(function (k) { if (personal[k] !== undefined) { addr[k] = personal[k]; delete personal[k]; } });
    aaMergeObj(prof.personal, personal);
    aaMergeObj(prof.address, addr);
  }
  aaMergeObj(prof.address, parsed.address);
  aaMergeObj(prof.links, parsed.links);
  aaMergeObj(prof.professional, parsed.professional);
  if (Array.isArray(parsed.experience) && parsed.experience.length) {
    prof.experience = parsed.experience.map(aaStrObj);
  }
  if (Array.isArray(parsed.education) && parsed.education.length) {
    prof.education = parsed.education.map(aaStrObj);
  }
}

function aaFileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const fr = new FileReader();
    fr.onload = function () { resolve(fr.result); };
    fr.onerror = function () { reject(new Error("Could not read file.")); };
    fr.readAsDataURL(file);
  });
}

function aaDataUrlToBase64(dataUrl) {
  const i = (dataUrl || "").indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : "";
}

async function aaImportCvIntoProfile(prof, file, stored, onStatus) {
  const status = onStatus || setAiImportStatus;
  const provider = document.getElementById("aiProvider").value;
  const key = document.getElementById("aiKey").value.trim();
  const model = document.getElementById("aiModel").value.trim();
  if (!key) { status("Add an API key under AI in the sidebar first.", "error"); return false; }

  const settings = await aaLoadSettings();
  settings.provider = provider;
  settings.model = model;
  settings.keys = settings.keys || {};
  settings.keys[provider] = key;
  await aaSaveSettings(settings);

  status("Reading CV\u2026", "");
  const isPdf = (file.name || "").toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
  let text = (stored && stored.text) || "";
  let base = {};
  if (!text || text.length < 20) {
    try {
      text = await aaExtractText(file);
      base = aaHeuristicProfile(text);
    } catch (e) { text = text || ""; }
  } else {
    try { base = aaHeuristicProfile(text); } catch (e) { base = {}; }
  }
  const payload = { provider: provider, apiKey: key, model: model };
  if (provider === "gemini" && isPdf && stored && stored.dataUrl) {
    payload.fileBase64 = aaDataUrlToBase64(stored.dataUrl);
    payload.mimeType = stored.type || "application/pdf";
    payload.text = text;
  } else {
    if (!text || text.length < 20) throw new Error("Could not read text from the CV. Try Gemini for scanned PDFs.");
    payload.text = text;
  }
  status("Asking " + provider + " to extract fields\u2026", "");
  const resp = await aaSendMessage({ action: "aa-parse-resume", payload: payload });
  if (!resp || !resp.ok) throw new Error((resp && resp.error) || "No response from AI.");
  aaMergeIntoProfile(prof, base);
  aaMergeIntoProfile(prof, resp.data);
  if (text && text.length >= 20 && stored && prof.id) {
    await aaSetResume(prof.id, Object.assign({}, stored, { text: text, ts: Date.now() }));
  }
  return true;
}

async function newProfileFromCv(file) {
  if (!file) return;
  try {
    collectForm();
    const id = "profile-" + Date.now();
    const label = (file.name || "New profile").replace(/\.[^.]+$/, "") || "New profile";
    const prof = { id: id, label: label };
    aaEnsureProfileFields(prof);
    aaRepeaterGroups().forEach(function (g) { prof[g.key] = []; });
    prof.customFields = [];
    DATA.profiles.push(prof);
    DATA.activeProfileId = id;

    const dataUrl = await aaFileToDataUrl(file);
    let text = "";
    try { text = await aaExtractText(file); } catch (e) { /* ignore */ }
    const stored = { name: file.name, type: file.type, dataUrl: dataUrl, text: text, ts: Date.now() };
    await aaSetResume(id, stored);

    await aaImportCvIntoProfile(prof, file, stored, setAiImportStatus);
    await aaSaveData(DATA);
    PENDING_CV_FILE = null;
    PENDING_PHOTO_FILE = null;
    PENDING_COVER_LETTER_FILE = null;
    renderProfiles();
    renderForm();
    renderRaw();
    setAiImportStatus("Profile created from CV — review the fields.", "success");
  } catch (err) {
    setAiImportStatus(String((err && err.message) || err), "error");
  }
}
