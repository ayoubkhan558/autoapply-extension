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

// ---- Per-profile photo storage ---------------------------------------
// Same shape as resumes: { [profileId]: { name, type, dataUrl, ts } }.
const AA_PHOTOS_KEY = "autoapplyPhotos";

async function aaGetPhoto(profileId) {
  if (!profileId) return null;
  const res = await chrome.storage.local.get(AA_PHOTOS_KEY);
  const map = (res && res[AA_PHOTOS_KEY]) || {};
  return map[profileId] || null;
}

async function aaSetPhoto(profileId, payload) {
  if (!profileId) return;
  const res = await chrome.storage.local.get(AA_PHOTOS_KEY);
  const map = (res && res[AA_PHOTOS_KEY]) || {};
  map[profileId] = payload;
  await chrome.storage.local.set({ [AA_PHOTOS_KEY]: map });
}

async function aaRemovePhoto(profileId) {
  const res = await chrome.storage.local.get(AA_PHOTOS_KEY);
  const map = (res && res[AA_PHOTOS_KEY]) || {};
  delete map[profileId];
  await chrome.storage.local.set({ [AA_PHOTOS_KEY]: map });
}

// ---- Per-profile cover letter file storage --------------------------------
// Same shape as resumes: { [profileId]: { name, type, dataUrl, ts } }.
const AA_COVER_LETTERS_KEY = "autoapplyCoverLetters";

async function aaGetCoverLetter(profileId) {
  if (!profileId) return null;
  const res = await chrome.storage.local.get(AA_COVER_LETTERS_KEY);
  const map = (res && res[AA_COVER_LETTERS_KEY]) || {};
  return map[profileId] || null;
}

async function aaSetCoverLetter(profileId, payload) {
  if (!profileId) return;
  const res = await chrome.storage.local.get(AA_COVER_LETTERS_KEY);
  const map = (res && res[AA_COVER_LETTERS_KEY]) || {};
  map[profileId] = payload;
  await chrome.storage.local.set({ [AA_COVER_LETTERS_KEY]: map });
}

async function aaRemoveCoverLetter(profileId) {
  const res = await chrome.storage.local.get(AA_COVER_LETTERS_KEY);
  const map = (res && res[AA_COVER_LETTERS_KEY]) || {};
  delete map[profileId];
  await chrome.storage.local.set({ [AA_COVER_LETTERS_KEY]: map });
}

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
