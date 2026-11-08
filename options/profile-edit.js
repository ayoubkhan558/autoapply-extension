// Form collection, repeater/custom-field edits, profile/raw rendering.
// Classic-script module; dependency order is declared in config/modules.json.
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

function moveRepeaterEntry(key, idx, direction) {
  collectForm();
  const entries = activeProfile()[key];
  const target = idx + direction;
  if (target < 0 || target >= entries.length) return;
  entries.splice(target, 0, entries.splice(idx, 1)[0]);
  renderForm(); renderRaw();
  const cards = document.querySelector('[data-panel="' + key + '"]').querySelectorAll("details");
  cards[target].open = true;
  cards[target].querySelector("summary").focus();
}

function validateProfileForm() {
  const form = document.getElementById("profileForm");
  form.querySelectorAll("[data-field]").forEach(function (input) { input.setCustomValidity(""); });
  form.querySelectorAll(".aa-entry-card").forEach(function (card) {
    [["startDate", "endDate"], ["startYear", "endYear"], ["issueDate", "expiryDate"]].forEach(function (pair) {
      const start = card.querySelector('[data-field="' + pair[0] + '"]');
      const end = card.querySelector('[data-field="' + pair[1] + '"]');
      if (start && end && start.value && end.value && /^\d{4}/.test(start.value) && /^\d{4}/.test(end.value) && end.value < start.value) end.setCustomValidity("End must be on or after start.");
    });
  });
  const invalid = Array.from(form.querySelectorAll("input, textarea, select")).find(function (input) { return !input.checkValidity(); });
  if (!invalid) return true;
  const panel = invalid.closest("[data-panel]");
  const panels = Array.from(form.querySelectorAll("[data-panel]"));
  form.querySelectorAll(".aa-profile-field-tab")[panels.indexOf(panel)].click();
  const card = invalid.closest("details"); if (card) card.open = true;
  invalid.reportValidity(); invalid.focus();
  setStatus("Please correct the highlighted field before saving.", "error");
  return false;
}
