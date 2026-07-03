// The profile form is generated entirely from the shared field registry
// (lib/fields.js). To add a field, edit AA_FIELD_DEFS there — nothing here.
// Each section's `fields` is a list of { name, label, long } descriptors.
const SECTIONS = (typeof aaFormGroups === "function") ? aaFormGroups() : [];

// Repeating sections (experience, education, projects, certifications, awards,
// volunteering) are defined entirely in the shared registry (lib/fields.js).
// Add a section or field there and it appears here automatically.
const REPEATERS = (typeof aaRepeaterGroups === "function") ? aaRepeaterGroups() : [];

// Commonly-requested fields used for the completeness meter.
const COMMON_FIELDS = [
  { section: "personal", field: "firstName", label: "First name" },
  { section: "personal", field: "lastName", label: "Last name" },
  { section: "personal", field: "email", label: "Email" },
  { section: "personal", field: "phone", label: "Phone" },
  { section: "personal", field: "city", label: "City" },
  { section: "personal", field: "country", label: "Country" },
  { section: "links", field: "linkedin", label: "LinkedIn" },
  { section: "professional", field: "currentTitle", label: "Current title" },
  { section: "professional", field: "experienceYears", label: "Years of experience" },
  { section: "professional", field: "skills", label: "Skills" },
  { section: "professional", field: "noticePeriod", label: "Notice period" },
  { section: "professional", field: "desiredSalary", label: "Desired salary" },
  { section: "professional", field: "workAuthorization", label: "Work authorization" }
];

function renderCompleteness(prof) {
  const host = document.getElementById("completenessBody");
  if (!host || !prof) return;
  const missing = [];
  let total = 0;
  SECTIONS.forEach(function (section) {
    const sec = prof[section.key] || {};
    section.fields.forEach(function (fd) {
      total++;
      const v = sec[fd.name];
      if (v === null || v === undefined || String(v).trim() === "") missing.push(fd.label);
    });
  });
  const filled = total - missing.length;
  const pct = total ? Math.round((filled / total) * 100) : 0;
  host.innerHTML = "";
  const bar = document.createElement("div");
  bar.className = "aa-completeness__bar";
  const fill = document.createElement("div");
  fill.className = "aa-completeness__fill";
  fill.style.width = pct + "%";
  bar.appendChild(fill);
  host.appendChild(bar);
  const pctEl = document.createElement("p");
  pctEl.className = "aa-completeness__pct";
  pctEl.textContent = pct + "% complete — " + filled + " of " + total + " profile fields filled";
  host.appendChild(pctEl);
  if (missing.length) {
    const wrap = document.createElement("div");
    wrap.className = "aa-completeness__missing";
    missing.forEach(function (m) {
      const chip = document.createElement("span");
      chip.className = "aa-completeness__chip";
      chip.textContent = m;
      wrap.appendChild(chip);
    });
    host.appendChild(wrap);
  } else {
    const done = document.createElement("div");
    done.className = "aa-completeness__done";
    done.textContent = "✓ All profile fields are filled.";
    host.appendChild(done);
  }
}
let DATA = null;
let lastGoodJson = "";
let rawTimer = null;

const AA_DEFAULT_JOB_KEYWORDS = ["apply now", "apply for the job", "apply for job", "job application", "application form", "fill job form", "fill application", "submit application", "apply for this job", "apply for this position", "cover letter", "upload cover letter", "resume", "upload resume", "cv", "upload cv", "upload cv/resume", "curriculum vitae", "work authorization", "notice period", "expected salary", "current salary", "salary expectation", "years of experience", "linkedin profile", "why do you want", "equal opportunity employer", "we're hiring", "we’re hiring", "position applied", "current company", "current working status", "employment status", "willing to relocate", "visa sponsorship", "earliest start date", "date available", "availability date", "employment history", "desired salary", "hiring process", "candidate profile", "personal information", "professional information", "attach resume", "attach cv"];
let PENDING_CV_FILE = null;

const AA_DEFAULT_BLOCKED_SITES = ["mail.google.com", "outlook.live.com", "outlook.office.com", "web.whatsapp.com", "facebook.com", "instagram.com", "x.com", "twitter.com", "linkedin.com/feed", "youtube.com", "notion.so", "docs.google.com", "drive.google.com", "dropbox.com", "bank", "paypal.com", "stripe.com", "github.com/login", "accounts.google.com"];

const DEFAULT_MODELS = {
  gemini: "gemini-1.5-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free"
};

function setModelOptions(models, selected) {
  const sel = document.getElementById("aiModel");
  sel.innerHTML = "";
  models.forEach(function (m) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    sel.appendChild(opt);
  });
  if (selected && models.some(function (m) { return m.id === selected; })) sel.value = selected;
}

async function loadModels(preferred) {
  const provider = document.getElementById("aiProvider").value;
  const key = document.getElementById("aiKey").value.trim();
  if (provider !== "openrouter" && !key) {
    setModelOptions([{ id: "", label: "Enter API key, then Refresh models" }], "");
    return;
  }
  setAiStatus("Loading models\u2026", "");
  try {
    const resp = await aaSendMessage({ action: "aa-list-models", payload: { provider: provider, apiKey: key } });
    if (!resp || !resp.ok) throw new Error((resp && resp.error) || "Could not load models.");
    const models = resp.models || [];
    if (!models.length) throw new Error("No models returned.");
    setModelOptions(models, preferred || DEFAULT_MODELS[provider]);
    setAiStatus(models.length + " models loaded \u2014 pick one.", "success");
  } catch (err) {
    setModelOptions([{ id: DEFAULT_MODELS[provider], label: DEFAULT_MODELS[provider] + " (default)" }], preferred);
    setAiStatus(String((err && err.message) || err), "error");
  }
}

function activeProfile() {
  return DATA.profiles.find(function (p) { return p.id === DATA.activeProfileId; }) || DATA.profiles[0];
}

function ensureArray(obj, key) {
  if (!Array.isArray(obj[key])) obj[key] = obj[key] ? [obj[key]] : [];
}

function labelize(s) {
  return s.replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }).trim();
}

// Build one labelled form row. `isLong` -> textarea; `isList` -> the value is
// an array edited as comma-separated text (tagged with data-list for collection).
function makeRow(labelText, value, data, isLong, isList) {
  const row = document.createElement("div");
  row.className = "aa-field-grid__row";
  const lbl = document.createElement("label");
  lbl.textContent = labelText;
  row.appendChild(lbl);
  const input = isLong ? document.createElement("textarea") : document.createElement("input");
  if (!isLong) input.type = "text";
  Object.keys(data).forEach(function (k) { input.dataset[k] = data[k]; });
  if (isList) {
    input.dataset.list = "1";
    input.placeholder = "Comma-separated";
    value = Array.isArray(value) ? value.join(", ") : (value || "");
  }
  input.value = (value === null || value === undefined) ? "" : value;
  row.appendChild(input);
  if (isLong) row.classList.add("aa-field-grid__row--full");
  return row;
}

function makeHeader(text) {
  const head = document.createElement("div");
  head.className = "aa-section-head";
  const h = document.createElement("h2");
  h.className = "aa-section-head__title";
  h.textContent = text;
  head.appendChild(h);
  return head;
}

function makeHeaderWithButton(text, btnText, onClick) {
  const head = document.createElement("div");
  head.className = "aa-section-head";
  const h = document.createElement("h2");
  h.className = "aa-section-head__title";
  h.textContent = text;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "aa-btn aa-btn--add";
  btn.textContent = btnText;
  btn.addEventListener("click", onClick);
  head.appendChild(h);
  head.appendChild(btn);
  return head;
}

function renderRepeaterCard(rep, entry, idx) {
  const card = document.createElement("div");
  card.className = "aa-entry-card";
  const head = document.createElement("div");
  head.className = "aa-entry-card__head";
  const title = document.createElement("span");
  title.className = "aa-entry-card__title";
  title.textContent = rep.itemLabel + " " + (idx + 1);
  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "aa-btn aa-btn--remove";
  rm.textContent = "Remove";
  rm.addEventListener("click", function () { removeRepeaterEntry(rep.key, idx); });
  head.appendChild(title);
  head.appendChild(rm);
  card.appendChild(head);
  const grid = document.createElement("div");
  grid.className = "aa-field-grid";
  rep.fields.forEach(function (fd) {
    grid.appendChild(makeRow(fd.label, entry[fd.name] || "", { rep: rep.key, index: String(idx), field: fd.name }, fd.long, fd.list));
  });
  card.appendChild(grid);
  return card;
}

function renderCustomCard(cf, idx) {
  const card = document.createElement("div");
  card.className = "aa-entry-card";
  const grid = document.createElement("div");
  grid.className = "aa-field-grid";
  grid.appendChild(makeRow("Field label", cf.label || "", { custom: String(idx), cfield: "label" }, false));
  grid.appendChild(makeRow("Match keywords (comma separated)", cf.match || "", { custom: String(idx), cfield: "match" }, false));
  const valRow = makeRow("Value", cf.value || "", { custom: String(idx), cfield: "value" }, true);
  grid.appendChild(valRow);
  card.appendChild(grid);
  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "aa-btn aa-btn--remove aa-entry-card__remove";
  rm.textContent = "Remove field";
  rm.addEventListener("click", function () { removeCustomField(idx); });
  card.appendChild(rm);
  return card;
}

function renderCvProfileBlock(prof) {
  const block = document.createElement("div"); block.className = "aa-card-block aa-card-block--cv aa-profile-cv";
  block.innerHTML = '<div class="aa-card-block__title">Profile CV / Resume</div><p class="aa-muted aa-muted--small">Stored per profile and auto-attached to CV/resume upload fields.</p><div class="aa-field-line"><label class="aa-btn aa-btn--ghost aa-btn--file">Choose CV / resume<input type="file" id="profileCvFile" accept=".pdf,.doc,.docx" hidden></label><span id="profileCvStatus" class="aa-status"></span></div><p class="aa-muted aa-muted--small">After choosing a file, click the bottom Save button to save it with this profile.</p>';
  setTimeout(function(){
    const input=document.getElementById("profileCvFile"), st=document.getElementById("profileCvStatus");
    if(input) input.onchange=function(){ PENDING_CV_FILE = input.files && input.files[0] ? input.files[0] : null; if(st && PENDING_CV_FILE){ st.textContent="Ready to save: "+PENDING_CV_FILE.name; st.className="aa-status"; } };
    if(prof && prof.id && st) aaGetResume(prof.id).then(function(cv){ if(cv&&cv.name){ st.textContent="Current: "+cv.name; st.className="aa-status aa-success"; } else { st.textContent="No CV saved yet."; st.className="aa-status"; }});
  },0);
  return block;
}


function renderForm() {
  const prof = activeProfile();
  const form = document.getElementById("profileForm");
  form.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "aa-profile-fields-layout";
  const nav = document.createElement("div");
  nav.className = "aa-profile-fields-nav";
  const panels = document.createElement("div");
  panels.className = "aa-profile-fields-panels";
  layout.appendChild(nav); layout.appendChild(panels);

  function addLeftTab(id, label, build, active) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "aa-profile-field-tab" + (active ? " aa-is-active" : ""); btn.textContent = label;
    const panel = document.createElement("section");
    panel.className = "aa-profile-field-panel" + (active ? " aa-is-active" : ""); panel.dataset.panel = id;
    build(panel);
    btn.addEventListener("click", function(){
      nav.querySelectorAll(".aa-profile-field-tab").forEach(function(b){ b.classList.remove("aa-is-active"); });
      panels.querySelectorAll(".aa-profile-field-panel").forEach(function(p){ p.classList.remove("aa-is-active"); });
      btn.classList.add("aa-is-active"); panel.classList.add("aa-is-active");
    });
    nav.appendChild(btn); panels.appendChild(panel);
  }

  addLeftTab("profile", "Profile", function(panel){
    const metaGrid = document.createElement("div"); metaGrid.className = "aa-field-grid";
    const labelRow = makeRow("Profile label", prof.label || "", { meta: "label" }, false);
    labelRow.classList.add("aa-field-grid__row--full"); metaGrid.appendChild(labelRow); panel.appendChild(metaGrid);
    panel.appendChild(renderCvProfileBlock(prof));
  }, true);

  SECTIONS.forEach(function (section) {
    addLeftTab(section.key, section.label, function(panel){
      if (!prof[section.key]) prof[section.key] = {};
      const grid = document.createElement("div"); grid.className = "aa-field-grid";
      section.fields.forEach(function (fd) { grid.appendChild(makeRow(fd.label, prof[section.key][fd.name] || "", { section: section.key, field: fd.name }, fd.long, fd.list)); });
      panel.appendChild(grid);
    }, false);
  });

  REPEATERS.forEach(function (rep) {
    addLeftTab(rep.key, rep.label, function(panel){
      panel.appendChild(makeHeaderWithButton(rep.label, "+ Add " + rep.itemLabel, function () { addRepeaterEntry(rep.key); }));
      ensureArray(prof, rep.key);
      const list = document.createElement("div"); prof[rep.key].forEach(function (entry, idx) { list.appendChild(renderRepeaterCard(rep, entry, idx)); }); panel.appendChild(list);
    }, false);
  });

  addLeftTab("custom", "Custom fields", function(panel){
    panel.appendChild(makeHeaderWithButton("Custom fields", "+ Add field", function () { addCustomField(); }));
    ensureArray(prof, "customFields"); const clist = document.createElement("div"); prof.customFields.forEach(function (cf, idx) { clist.appendChild(renderCustomCard(cf, idx)); }); panel.appendChild(clist);
  }, false);

  form.appendChild(layout);
  renderCompleteness(prof);
}


// Read a form input's value, converting comma-separated "list" fields
// (e.g. languages, tools) back into an array for storage.
function aaReadInputValue(input) {
  if (input.dataset && input.dataset.list) {
    return input.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }
  return input.value;
}

function collectForm() {
  if (!DATA) return;
  const prof = activeProfile();
  const form = document.getElementById("profileForm");
  if (!form) return;
  const labelInput = form.querySelector('[data-meta="label"]');
  if (labelInput) prof.label = labelInput.value;
  form.querySelectorAll("[data-section]").forEach(function (input) {
    const s = input.dataset.section;
    const f = input.dataset.field;
    if (!prof[s]) prof[s] = {};
    prof[s][f] = aaReadInputValue(input);
  });
  REPEATERS.forEach(function (rep) { ensureArray(prof, rep.key); });
  form.querySelectorAll("[data-rep]").forEach(function (input) {
    const key = input.dataset.rep;
    const idx = parseInt(input.dataset.index, 10);
    const f = input.dataset.field;
    if (!prof[key][idx]) prof[key][idx] = {};
    prof[key][idx][f] = aaReadInputValue(input);
  });
  ensureArray(prof, "customFields");
  form.querySelectorAll("[data-custom]").forEach(function (input) {
    const idx = parseInt(input.dataset.custom, 10);
    const cf = input.dataset.cfield;
    if (!prof.customFields[idx]) prof.customFields[idx] = { label: "", match: "", value: "" };
    prof.customFields[idx][cf] = input.value;
  });
}

function addRepeaterEntry(key) {
  collectForm();
  const prof = activeProfile();
  ensureArray(prof, key);
  const rep = REPEATERS.find(function (r) { return r.key === key; });
  const blank = {};
  rep.fields.forEach(function (fd) { blank[fd.name] = fd.list ? [] : ""; });
  prof[key].push(blank);
  renderForm();
  renderRaw();
}

function removeRepeaterEntry(key, idx) {
  collectForm();
  const prof = activeProfile();
  ensureArray(prof, key);
  prof[key].splice(idx, 1);
  renderForm();
  renderRaw();
}

function addCustomField() {
  collectForm();
  const prof = activeProfile();
  ensureArray(prof, "customFields");
  prof.customFields.push({ label: "", match: "", value: "" });
  renderForm();
  renderRaw();
}

function removeCustomField(idx) {
  collectForm();
  const prof = activeProfile();
  ensureArray(prof, "customFields");
  prof.customFields.splice(idx, 1);
  renderForm();
  renderRaw();
}

function renderProfiles() {
  const sel = document.getElementById("profileSelect");
  sel.innerHTML = "";
  DATA.profiles.forEach(function (p) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label || p.id;
    if (p.id === DATA.activeProfileId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderRaw() {
  const txt = JSON.stringify(DATA, null, 2);
  const ta = document.getElementById("rawJson");
  if (ta) ta.value = txt;
  lastGoodJson = txt;
}

function setStatus(t, kind) {
  const s = document.getElementById("status");
  if (s) {
    s.textContent = t;
    s.className = "aa-status " + (kind ? "aa-" + kind : "");
  }
  let toast = document.getElementById("saveToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "saveToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = t || "";
  toast.className = "aa-save-toast " + (kind ? "aa-" + kind : "");
  if (t) {
    toast.classList.add("aa-is-visible");
    clearTimeout(window.__aaSaveStatusTimer);
    window.__aaSaveStatusTimer = setTimeout(function () {
      if (s) s.textContent = "";
      toast.classList.remove("aa-is-visible");
    }, 3500);
  }
}

function setRawStatus(t, kind) {
  const s = document.getElementById("rawStatus");
  if (!s) return;
  s.textContent = t;
  s.className = "aa-raw-status " + (kind ? "aa-" + kind : "");
}

function setAiStatus(t, kind) {
  const s = document.getElementById("aiStatus");
  if (!s) return;
  s.textContent = t;
  s.className = "aa-status " + (kind ? "aa-" + kind : "");
}

async function save() {
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.dataset.originalText = saveBtn.dataset.originalText || saveBtn.textContent; saveBtn.textContent = "Saving…"; }
  collectForm();
  if (!aaValidateSettings()) { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = saveBtn.dataset.originalText || "Save profile"; } setStatus("Fix validation errors", "error"); return; }
  if (PENDING_CV_FILE) {
    const dataUrl = await aaFileToDataUrl(PENDING_CV_FILE);
    await aaSetResume(DATA.activeProfileId, { name: PENDING_CV_FILE.name, type: PENDING_CV_FILE.type, dataUrl: dataUrl, ts: Date.now() });
    PENDING_CV_FILE = null;
  }
  await aaSaveData(DATA);
  renderRaw();
  setStatus("Saved ✓", "success");
  if (saveBtn) { saveBtn.textContent = "Saved ✓"; setTimeout(function(){ saveBtn.disabled = false; saveBtn.textContent = saveBtn.dataset.originalText || "Save profile"; }, 1400); }
}

// Live: fields -> JSON
function onFieldInput() {
  collectForm();
  renderRaw();
  renderCompleteness(activeProfile());
  setRawStatus("Updated from fields", "success");
}

// Live: JSON -> fields (debounced)
function onRawInput() {
  clearTimeout(rawTimer);
  rawTimer = setTimeout(function () {
    const ta = document.getElementById("rawJson");
    let parsed;
    try {
      parsed = JSON.parse(ta.value);
    } catch (err) {
      setRawStatus("Invalid JSON \u2014 will restore on blur", "error");
      return;
    }
    DATA = aaMigrate(parsed);
    lastGoodJson = JSON.stringify(DATA, null, 2);
    renderProfiles();
    renderForm();
    setRawStatus("Synced to fields \u2713", "success");
  }, 350);
}

// On blur: if invalid, restore last working JSON; if valid, reformat.
function onRawBlur() {
  const ta = document.getElementById("rawJson");
  let parsed;
  try {
    parsed = JSON.parse(ta.value);
  } catch (err) {
    ta.value = lastGoodJson;
    setRawStatus("Restored last working JSON", "error");
    return;
  }
  DATA = aaMigrate(parsed);
  renderProfiles();
  renderForm();
  renderRaw();
  setRawStatus("", "");
}

// ---- AI resume import -------------------------------------------------
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
  prof.links = prof.links || {};
  prof.professional = prof.professional || {};
  aaMergeObj(prof.personal, parsed.personal);
  aaMergeObj(prof.links, parsed.links);
  aaMergeObj(prof.professional, parsed.professional);
  if (Array.isArray(parsed.experience) && parsed.experience.length) {
    prof.experience = parsed.experience.map(aaStrObj);
  }
  if (Array.isArray(parsed.education) && parsed.education.length) {
    prof.education = parsed.education.map(aaStrObj);
  }
}

function setCvStatus(t, kind) {
  const s = document.getElementById("cvStatus");
  if (!s) return;
  s.textContent = t;
  s.className = "aa-status " + (kind ? "aa-" + kind : "");
}

function aaFileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const fr = new FileReader();
    fr.onload = function () { resolve(fr.result); };
    fr.onerror = function () { reject(new Error("Could not read file.")); };
    fr.readAsDataURL(file);
  });
}

async function parseResume() {
  const fileInput = document.getElementById("resumeFile");
  const file = fileInput.files[0];
  if (!file) { setAiStatus("Choose a PDF or DOCX file first.", "error"); return; }
  const provider = document.getElementById("aiProvider").value;
  const key = document.getElementById("aiKey").value.trim();
  const model = document.getElementById("aiModel").value.trim();
  if (!key) { setAiStatus("Enter an API key for " + provider + " first.", "error"); return; }

  // Persist the key/provider/model for next time.
  const settings = await aaLoadSettings();
  settings.provider = provider;
  settings.model = model;
  settings.keys = settings.keys || {};
  settings.keys[provider] = key;
  await aaSaveSettings(settings);

  try {
    setAiStatus("Reading file\u2026", "");
    const isPdf = (file.name || "").toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    let text = "";
    let base = {};
    try {
      text = await aaExtractText(file);
      base = aaHeuristicProfile(text);
    } catch (e) {
      text = "";
    }
    const payload = { provider: provider, apiKey: key, model: model };
    if (provider === "gemini" && isPdf) {
      payload.fileBase64 = await aaFileToBase64(file);
      payload.mimeType = "application/pdf";
      payload.text = text;
    } else {
      if (!text || text.length < 20) throw new Error("Could not read text from this file. Try a PDF or DOCX, or use Gemini for scanned PDFs.");
      payload.text = text;
    }
    setAiStatus("Asking " + provider + " to extract fields\u2026", "");
    const resp = await aaSendMessage({ action: "aa-parse-resume", payload: payload });
    if (!resp || !resp.ok) throw new Error((resp && resp.error) || "No response from AI.");
    const prof = activeProfile();
    aaMergeIntoProfile(prof, base);
    aaMergeIntoProfile(prof, resp.data);
    renderForm();
    renderRaw();
    setAiStatus("Imported \u2014 review the fields, then click Save.", "success");
  } catch (err) {
    setAiStatus(String((err && err.message) || err), "error");
  }
}

async function init() {
  DATA = await aaLoadData();
  renderProfiles();
  renderForm();
  renderRaw();

  document.getElementById("profileForm").addEventListener("input", onFieldInput);

  const rawJson = document.getElementById("rawJson");
  rawJson.addEventListener("input", onRawInput);
  rawJson.addEventListener("blur", onRawBlur);

  // AI settings
  const settings = await aaLoadSettings();
  const provSel = document.getElementById("aiProvider");
  provSel.value = settings.provider;
  document.getElementById("aiKey").value = (settings.keys && settings.keys[settings.provider]) || "";
  loadModels(settings.model);

  provSel.addEventListener("change", async function () {
    const s = await aaLoadSettings();
    document.getElementById("aiKey").value = (s.keys && s.keys[provSel.value]) || "";
    loadModels(s.provider === provSel.value ? s.model : "");
  });

  document.getElementById("saveKey").addEventListener("click", async function () {
    const s = await aaLoadSettings();
    s.provider = provSel.value;
    s.model = document.getElementById("aiModel").value.trim();
    s.keys = s.keys || {};
    s.keys[provSel.value] = document.getElementById("aiKey").value.trim();
    await aaSaveSettings(s);
    setAiStatus("Saved key for " + provSel.value, "success");
    loadModels(s.model);
  });

  document.getElementById("refreshModels").addEventListener("click", function () {
    loadModels(document.getElementById("aiModel").value);
  });

  // Form-detection settings
  const detect = settings.detect || { enabled: true, allowlist: "", blocklist: "", keywords: "", minFields: 4 };
  function asText(v) { return Array.isArray(v) ? v.join("\n") : (v || ""); }
  document.getElementById("detectEnabled").checked = detect.enabled !== false;
  document.getElementById("detectAllow").value = asText(detect.allowlist);
  document.getElementById("detectBlock").value = asText(detect.blocklist) || AA_DEFAULT_BLOCKED_SITES.join("\n");
  document.getElementById("detectKeywords").value = asText(detect.keywords);
  const rolesEl = document.getElementById("detectRoles");
  if (rolesEl) rolesEl.value = asText(detect.roles || detect.jobTitles || "");
  document.getElementById("detectMinFields").value = String(parseInt(detect.minFields, 10) || 4);
  const kw = document.getElementById("defaultJobKeywords");
  if (kw) kw.textContent = AA_DEFAULT_JOB_KEYWORDS.join(", ");

  document.getElementById("saveDetect").addEventListener("click", async function () {
    const s = await aaLoadSettings();
    s.detect = {
      enabled: document.getElementById("detectEnabled").checked,
      allowlist: document.getElementById("detectAllow").value.trim(),
      blocklist: document.getElementById("detectBlock").value.trim(),
      keywords: document.getElementById("detectKeywords").value.trim(),
      roles: (document.getElementById("detectRoles") ? document.getElementById("detectRoles").value.trim() : ""),
      minFields: Math.max(1, parseInt(document.getElementById("detectMinFields").value, 10) || 4)
    };
    await aaSaveSettings(s);
    const st = document.getElementById("detectStatus");
    st.textContent = "Saved. Reload open tabs to apply.";
    st.className = "aa-status aa-success";
  });

  document.getElementById("resumeFile").addEventListener("change", function () {
    const f = this.files[0];
    if (f) setAiStatus("Selected: " + f.name, "");
  });

  document.getElementById("parseResume").addEventListener("click", parseResume);

  // CV/resume upload lives in the Profile tab and is saved with the bottom Save button.


  document.getElementById("profileSelect").addEventListener("change", function (e) {
    collectForm();
    DATA.activeProfileId = e.target.value;
    renderForm();
    renderRaw();
    try { cvFile.value = ""; } catch (er) { /* ignore */ }
    refreshCvStatus();
  });

  document.getElementById("addProfile").addEventListener("click", function () {
    collectForm();
    const id = "profile-" + Date.now();
    // Start from a blank profile (do NOT clone Profile 1). aaEnsureProfileFields
    // fills the flat sections (personal/links/professional) with empty values;
    // repeating sections and custom fields start as empty lists.
    const base = { id: id, label: "New profile" };
    aaEnsureProfileFields(base);
    aaRepeaterGroups().forEach(function (g) { base[g.key] = []; });
    base.customFields = [];
    DATA.profiles.push(base);
    DATA.activeProfileId = id;
    renderProfiles();
    renderForm();
    renderRaw();
    try { cvFile.value = ""; } catch (er) { /* ignore */ }
    refreshCvStatus();
  });

  document.getElementById("saveBtn").addEventListener("click", save);

  document.getElementById("exportBtn").addEventListener("click", function () {
    collectForm();
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "autoapply-profile.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importFile").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        DATA = aaMigrate(JSON.parse(reader.result));
        renderProfiles();
        renderForm();
        renderRaw();
        setStatus("Imported \u2014 remember to Save", "success");
      } catch (err) {
        setStatus("Invalid JSON file", "error");
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("toggleRaw").addEventListener("click", function () {
    const w = document.getElementById("rawWrap");
    collectForm();
    renderRaw();
    w.classList.toggle("aa-hidden");
  });

  setupSettingsTabs();
}

function setupSettingsTabs() {
  const items = document.querySelectorAll(".aa-nav-item");
  const panels = document.querySelectorAll(".aa-tab-panel");
  const titleEl = document.getElementById("panelTitle");
  items.forEach(function (it) {
    it.addEventListener("click", function () {
      const name = it.getAttribute("data-tab");
      items.forEach(function (x) { x.classList.toggle("aa-nav-item--active", x === it); });
      panels.forEach(function (p) { p.classList.toggle("aa-tab-panel--active", p.getAttribute("data-panel") === name); });
      if (titleEl) { const lbl = it.querySelector(".aa-nav-item__label"); if (lbl) titleEl.textContent = lbl.textContent; }
    });
  });
}

init();
