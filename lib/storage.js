// Profile storage helpers (used by the popup and options pages).
const STORAGE_KEY = "autoapplyData";
const AI_SETTINGS_KEY = "autoapplyAI";

// Default detection blocklist, shared by the content script (runtime gate)
// and the options page (UI display). Hostname-safe entries only: the matcher
// compares cleaned hostnames (exact or subdomain suffix), never URL paths.
const AA_DEFAULT_BLOCKED_SITES = ["mail.google.com", "outlook.live.com", "outlook.office.com", "web.whatsapp.com", "facebook.com", "instagram.com", "x.com", "twitter.com", "youtube.com", "notion.so", "docs.google.com", "drive.google.com", "dropbox.com", "paypal.com", "stripe.com", "accounts.google.com"];

// Built-in phrases that signal a job-application / careers page.
// Shared by content/detect.js (runtime) and options (keyword reference UI).
// Keep lowercase; detection compares against lowercased page text.
const AA_DEFAULT_JOB_KEYWORDS = [
  // Application-form phrases
  "apply now", "apply for the job", "apply for job", "job application", "application form",
  "fill job form", "fill application", "submit application", "apply for this job", "apply for this position",
  "cover letter", "upload cover letter", "resume", "upload resume", "cv", "upload cv", "upload cv/resume",
  "curriculum vitae", "work authorization", "notice period", "expected salary", "current salary",
  "salary expectation", "years of experience", "linkedin profile", "why do you want",
  "equal opportunity employer", "position applied", "current company", "current working status",
  "employment status", "willing to relocate", "visa sponsorship", "earliest start date",
  "date available", "availability date", "employment history", "desired salary", "hiring process",
  "candidate profile", "personal information", "professional information", "attach resume", "attach cv",
  // Careers / openings page phrases (v1.26)
  "careers", "career", "jobs", "job opening", "open position", "vacancy", "vacancies",
  "join our team", "join the team", "hiring", "now hiring", "we are hiring", "we're hiring",
  "we\u2019re hiring", "employment opportunities", "current openings", "open roles",
  "available positions", "work with us", "work for us", "become a part of our team"
];

// Built-in job titles / role names that mark a page as a job listing when they
// appear in the page text alongside fillable fields. Users can add more via
// Options → Form detection → Job titles. Shared by detect.js + options UI.
const AA_DEFAULT_JOB_ROLES = [
  "wordpress developer", "wordpress designer", "frontend developer", "front end developer",
  "web developer", "website developer", "software developer", "full stack developer",
  "fullstack developer", "cms developer", "shopify developer", "woocommerce developer",
  "react developer", "reactjs developer", "next.js developer", "nextjs developer",
  "javascript developer", "typescript developer", "php developer", "web application developer",
  "ui developer", "web designer", "figma designer", "ui/ux designer", "frontend engineer",
  "front end engineer", "software engineer", "website designer", "ecommerce developer"
];

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
  // Address fields moved from personal.* to their own address.* group (v1.25).
  var addressKeys = (typeof AA_FIELD_DEFS !== "undefined")
    ? AA_FIELD_DEFS.filter(function (d) { return d.group === "address"; }).map(function (d) { return d.name; })
    : ["address1", "address2", "currentAddress", "permanentAddress", "city", "state", "zip", "country"];
  data.profiles.forEach(function (p) {
    repeaterKeys.forEach(function (rk) {
      if (!Array.isArray(p[rk])) p[rk] = p[rk] ? [p[rk]] : [];
    });
    if (!Array.isArray(p.customFields)) p.customFields = [];
    if (!p.address || typeof p.address !== "object") p.address = {};
    addressKeys.forEach(function (k) {
      if (p.personal && p.personal[k] !== undefined) {
        if (!p.address[k]) p.address[k] = p.personal[k];
        delete p.personal[k];
      }
    });
    // Backfill any flat fields added to lib/fields.js since this profile was saved.
    if (typeof aaEnsureProfileFields === "function") aaEnsureProfileFields(p);
  });
  data.version = 2;
  return data;
}

// Validate external data before it becomes the active profile set.
function aaValidateProfileData(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.profiles) || !data.profiles.length) throw new Error("A profile export must contain at least one profile.");
  const ids = new Set();
  const copy = JSON.parse(JSON.stringify(data));
  const object = function (v) { return v && typeof v === "object" && !Array.isArray(v); };
  copy.profiles.forEach(function (p) {
    if (!object(p) || typeof p.id !== "string" || !p.id.trim() || ids.has(p.id)) throw new Error("Each profile needs a unique ID.");
    ids.add(p.id);
    if (p.label !== undefined && typeof p.label !== "string") throw new Error("Profile label must be text.");
    ["personal", "address", "links", "professional"].forEach(function (key) {
      if (p[key] === undefined) return;
      if (!object(p[key])) throw new Error(key + " must be an object.");
      Object.values(p[key]).forEach(function (v) { if (typeof v !== "string" && !(Array.isArray(v) && v.every(function (x) { return typeof x === "string"; }))) throw new Error("Invalid value in " + key + "."); });
    });
    ["experience", "education", "projects", "certifications", "awards", "volunteering", "customFields"].forEach(function (key) {
      if (p[key] === undefined) return;
      if (!Array.isArray(p[key]) || !p[key].every(function (item) { return object(item) && Object.values(item).every(function (v) { return typeof v === "string" || (Array.isArray(v) && v.every(function (x) { return typeof x === "string"; })); }); })) throw new Error("Invalid " + key + " entries.");
    });
  });
  if (!ids.has(copy.activeProfileId)) throw new Error("The active profile ID does not exist.");
  return aaMigrate(copy);
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
    keys: s.keys || { gemini: "", groq: "", openrouter: "", xai: "" },
    jobs: s.jobs || { preset: "pakistan", role: "", location: "Pakistan", sites: {} },
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

// Per-profile keys avoid lost updates when multiple options windows save at once.
function aaAttachmentKey(type, id) { return type + ":" + id; }
async function aaGetAttachment(type, id) {
  if (!id) return null;
  const key = aaAttachmentKey(type, id);
  const result = await chrome.storage.local.get(key);
  if (Object.prototype.hasOwnProperty.call(result, key) && result[key] !== undefined) return result[key];
  const old = await chrome.storage.local.get(type);
  const map = old[type] || {};
  if (map[id]) return map[id];
  if (type === AA_RESUMES_KEY) {
    const legacy = await chrome.storage.local.get("autoapplyResume");
    return legacy.autoapplyResume && legacy.autoapplyResume.dataUrl ? legacy.autoapplyResume : null;
  }
  return null;
}
async function aaSetAttachment(type, id, payload) { if (id) await chrome.storage.local.set({ [aaAttachmentKey(type, id)]: payload }); }
async function aaGetResume(id) { return aaGetAttachment(AA_RESUMES_KEY, id); }
async function aaSetResume(id, payload) { return aaSetAttachment(AA_RESUMES_KEY, id, payload); }
async function aaRemoveResume(id) { return aaSetAttachment(AA_RESUMES_KEY, id, null); }
const AA_PHOTOS_KEY = "autoapplyPhotos";
async function aaGetPhoto(id) { return aaGetAttachment(AA_PHOTOS_KEY, id); }
async function aaSetPhoto(id, payload) { return aaSetAttachment(AA_PHOTOS_KEY, id, payload); }
async function aaRemovePhoto(id) { return aaSetAttachment(AA_PHOTOS_KEY, id, null); }
const AA_COVER_LETTERS_KEY = "autoapplyCoverLetters";
async function aaGetCoverLetter(id) { return aaGetAttachment(AA_COVER_LETTERS_KEY, id); }
async function aaSetCoverLetter(id, payload) { return aaSetAttachment(AA_COVER_LETTERS_KEY, id, payload); }
async function aaRemoveCoverLetter(id) { return aaSetAttachment(AA_COVER_LETTERS_KEY, id, null); }

// Cached plain-text from the profile CV (stored when the file is saved).
async function aaGetResumeText(profileId) {
  const r = await aaGetResume(profileId);
  return (r && r.text) ? String(r.text).slice(0, 12000) : "";
}

// ---- "Last filled here" history -------------------------------------
const AA_HISTORY_KEY = "autoapplyHistory";

async function aaRecordFill(host, count) {
  if (!host) return;
  try {
    const res = await chrome.storage.local.get(AA_HISTORY_KEY);
    const hist = (res && res[AA_HISTORY_KEY]) || {};
    hist[host] = { ts: Date.now(), count: count || 0 };
    // Keep the map bounded: drop the oldest entries past 200 hosts.
    const hosts = Object.keys(hist);
    if (hosts.length > 200) {
      hosts.sort(function (a, b) { return (hist[a].ts || 0) - (hist[b].ts || 0); })
        .slice(0, hosts.length - 200)
        .forEach(function (h) { delete hist[h]; });
    }
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
