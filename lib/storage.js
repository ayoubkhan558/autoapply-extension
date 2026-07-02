// Profile storage helpers (used by the popup and options pages).
const STORAGE_KEY = "autoapplyData";
const AI_SETTINGS_KEY = "autoapplyAI";

// Bring older saved data up to the current shape: normalize the repeating
// lists, and (via the shared registry) make sure every profile has a key for
// every flat field so newly-added registry fields appear automatically.
function aaMigrate(data) {
  if (!data || !Array.isArray(data.profiles)) return data;
  // Every repeating section (experience, education, projects, ...) comes from
  // the shared registry so new sections are normalized automatically.
  var repeaterKeys = (typeof AA_REPEATER_GROUPS !== "undefined")
    ? AA_REPEATER_GROUPS.map(function (g) { return g.key; })
    : ["experience", "education"];
  data.profiles.forEach(function (p) {
    repeaterKeys.forEach(function (rk) {
      if (!Array.isArray(p[rk])) p[rk] = p[rk] ? [p[rk]] : [];
    });
    if (!Array.isArray(p.customFields)) p.customFields = [];
    // Backfill any flat fields added to lib/fields.js since this profile was saved.
    if (typeof aaEnsureProfileFields === "function") aaEnsureProfileFields(p);
  });
  data.version = 2;
  return data;
}

async function aaLoadData() {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  if (res && res[STORAGE_KEY]) return aaMigrate(res[STORAGE_KEY]);
  const url = chrome.runtime.getURL("data/profile.default.json");
  const def = await fetch(url).then(function (r) { return r.json(); });
  await chrome.storage.local.set({ [STORAGE_KEY]: def });
  return aaMigrate(def);
}

async function aaSaveData(data) {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

function aaGetActiveProfile(data) {
  const id = data.activeProfileId;
  return data.profiles.find(function (p) { return p.id === id; }) || data.profiles[0];
}

async function aaLoadSettings() {
  const res = await chrome.storage.local.get(AI_SETTINGS_KEY);
  const s = (res && res[AI_SETTINGS_KEY]) || {};
  return {
    provider: s.provider || "gemini",
    model: s.model || "",
    keys: s.keys || { gemini: "", groq: "", openrouter: "" },
    jobs: s.jobs || { role: "", location: "", sites: { lever: true, greenhouse: true, ashby: true, workable: false, indeed: false } },
    detect: Object.assign({ enabled: true, allowlist: "", blocklist: "", keywords: "", minFields: 4 }, s.detect || {})
  };
}

async function aaSaveSettings(s) {
  await chrome.storage.local.set({ [AI_SETTINGS_KEY]: s });
}

// ---- Per-profile CV / resume storage --------------------------------
// Each profile can have its own CV/resume. Stored as a map keyed by profile id
// so the (large, base64) file data stays out of the editable profile JSON.
const AA_RESUMES_KEY = "autoapplyResumes";

async function aaLoadResumes() {
  const res = await chrome.storage.local.get(AA_RESUMES_KEY);
  return (res && res[AA_RESUMES_KEY]) || {};
}

async function aaGetResume(profileId) {
  const map = await aaLoadResumes();
  if (profileId && map[profileId]) return map[profileId];
  // Legacy fallback: a single global CV saved by older versions. Migrate it to
  // the requested profile so future reads are per-profile.
  const legacy = await chrome.storage.local.get("autoapplyResume");
  const old = legacy && legacy["autoapplyResume"];
  if (old && old.dataUrl) {
    if (profileId) {
      map[profileId] = old;
      try { await chrome.storage.local.set({ [AA_RESUMES_KEY]: map }); } catch (e) { /* ignore */ }
    }
    return old;
  }
  return null;
}

async function aaSetResume(profileId, payload) {
  if (!profileId) return;
  const map = await aaLoadResumes();
  map[profileId] = payload;
  await chrome.storage.local.set({ [AA_RESUMES_KEY]: map });
}

async function aaRemoveResume(profileId) {
  const map = await aaLoadResumes();
  delete map[profileId];
  await chrome.storage.local.set({ [AA_RESUMES_KEY]: map });
}

// ---- "Last filled here" history -------------------------------------
const AA_HISTORY_KEY = "autoapplyHistory";

async function aaRecordFill(host, count) {
  if (!host) return;
  try {
    const res = await chrome.storage.local.get(AA_HISTORY_KEY);
    const hist = (res && res[AA_HISTORY_KEY]) || {};
    hist[host] = { ts: Date.now(), count: count || 0 };
    await chrome.storage.local.set({ [AA_HISTORY_KEY]: hist });
  } catch (e) { /* ignore */ }
}

async function aaGetFillRecord(host) {
  if (!host) return null;
  try {
    const res = await chrome.storage.local.get(AA_HISTORY_KEY);
    const hist = (res && res[AA_HISTORY_KEY]) || {};
    return hist[host] || null;
  } catch (e) { return null; }
}

function aaRelativeTime(ts) {
  if (!ts) return "";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 30) return d + "d ago";
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo + "mo ago";
  return Math.floor(mo / 12) + "y ago";
}
