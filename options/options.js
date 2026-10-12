// Options initialization, event binding, and settings tab navigation.
// Classic-script module; dependency order is declared in config/modules.json.
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
  // Roles textarea is extras only; built-ins always apply at runtime.
  const rolesEl = document.getElementById("detectRoles");
  if (rolesEl) rolesEl.value = asText(detect.roles || detect.jobTitles || "");
  document.getElementById("detectMinFields").value = String(parseInt(detect.minFields, 10) || 4);
  const kw = document.getElementById("defaultJobKeywords");
  if (kw) kw.textContent = AA_DEFAULT_JOB_KEYWORDS.join(", ");
  // v1.26: mirror keywords reference for the built-in role list.
  const rolesRef = document.getElementById("defaultJobRoles");
  if (rolesRef) rolesRef.textContent = AA_DEFAULT_JOB_ROLES.join(", ");

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

  const newCvInput = document.getElementById("newProfileCvFile");
  document.getElementById("newProfileFromCv").addEventListener("click", function () { newCvInput.click(); });
  newCvInput.addEventListener("change", function () {
    const file = newCvInput.files && newCvInput.files[0];
    newCvInput.value = "";
    if (file) newProfileFromCv(file);
  });

  // CV / cover letter / photo uploads live in the Profile tab and save with the bottom Save button.


  document.getElementById("profileSelect").addEventListener("change", function (e) {
    collectForm();
    DATA.activeProfileId = e.target.value;
    renderForm();
    renderRaw();
    // Drop any not-yet-saved file picks so they can't be saved onto the new profile.
    PENDING_CV_FILE = null;
    PENDING_PHOTO_FILE = null;
    PENDING_COVER_LETTER_FILE = null;
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
    PENDING_CV_FILE = null;
    PENDING_PHOTO_FILE = null;
    PENDING_COVER_LETTER_FILE = null;
  });

  document.getElementById("dupProfile").addEventListener("click", async function () {
    collectForm();
    const src = activeProfile();
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = "profile-" + Date.now();
    copy.label = (src.label || "Profile") + " (copy)";
    DATA.profiles.push(copy);
    DATA.activeProfileId = copy.id;
    // Per-profile CV/photo live in separate storage keyed by id; copy them too.
    try { const cv = await aaGetResume(src.id); if (cv) await aaSetResume(copy.id, cv); } catch (e) { /* ignore */ }
    try { const ph = await aaGetPhoto(src.id); if (ph) await aaSetPhoto(copy.id, ph); } catch (e) { /* ignore */ }
    try { const cl = await aaGetCoverLetter(src.id); if (cl) await aaSetCoverLetter(copy.id, cl); } catch (e) { /* ignore */ }
    renderProfiles();
    renderForm();
    renderRaw();
    PENDING_CV_FILE = null;
    PENDING_PHOTO_FILE = null;
    PENDING_COVER_LETTER_FILE = null;
    setStatus("Duplicated \u2014 remember to Save", "success");
  });

  document.getElementById("deleteProfile").addEventListener("click", async function () {
    if (DATA.profiles.length <= 1) {
      setStatus("Keep at least one profile", "error");
      return;
    }
    const prof = activeProfile();
    if (!confirm('Delete "' + (prof.label || "this profile") + '"? This cannot be undone.')) return;
    DATA.profiles = DATA.profiles.filter(function (p) { return p.id !== prof.id; });
    DATA.activeProfileId = DATA.profiles[0].id;
    await Promise.all([aaRemoveResume(prof.id), aaRemovePhoto(prof.id), aaRemoveCoverLetter(prof.id), aaSaveData(DATA)]);
    PENDING_CV_FILE = null;
    PENDING_PHOTO_FILE = null;
    PENDING_COVER_LETTER_FILE = null;
    renderProfiles();
    renderForm();
    renderRaw();
    setStatus("Profile deleted", "success");
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
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.profiles) || !parsed.profiles.length) {
          throw new Error("Not an AutoApply profile export.");
        }
        DATA = aaMigrate(parsed);
        renderProfiles();
        renderForm();
        renderRaw();
        setStatus("Imported \u2014 remember to Save", "success");
      } catch (err) {
        setStatus((err && err.message && /profile export/.test(err.message)) ? err.message : "Invalid JSON file", "error");
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("toggleRaw").addEventListener("click", function () {
    const w = document.getElementById("rawWrap");
    collectForm();
    renderRaw();
    w.classList.toggle("aa-hidden");
    const open = !w.classList.contains("aa-hidden");
    this.textContent = open ? "Hide raw JSON" : "Show raw JSON";
    this.setAttribute("aria-pressed", open ? "true" : "false");
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
