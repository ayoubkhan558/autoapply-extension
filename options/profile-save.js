// Saving and synchronized form/raw JSON editing.
// Classic-script module; dependency order is declared in config/modules.json.
async function save() {
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.dataset.originalText = saveBtn.dataset.originalText || saveBtn.textContent; saveBtn.textContent = "Saving…"; }
  collectForm();
  if (PENDING_CV_FILE) {
    const dataUrl = await aaFileToDataUrl(PENDING_CV_FILE);
    let cvText = "";
    try { cvText = await aaExtractText(PENDING_CV_FILE); } catch (e) { /* ignore */ }
    await aaSetResume(DATA.activeProfileId, { name: PENDING_CV_FILE.name, type: PENDING_CV_FILE.type, dataUrl: dataUrl, text: cvText, ts: Date.now() });
    PENDING_CV_FILE = null;
  }
  if (PENDING_COVER_LETTER_FILE) {
    const clUrl = await aaFileToDataUrl(PENDING_COVER_LETTER_FILE);
    await aaSetCoverLetter(DATA.activeProfileId, { name: PENDING_COVER_LETTER_FILE.name, type: PENDING_COVER_LETTER_FILE.type, dataUrl: clUrl, ts: Date.now() });
    PENDING_COVER_LETTER_FILE = null;
  }
  if (PENDING_PHOTO_FILE) {
    const photoUrl = await aaFileToDataUrl(PENDING_PHOTO_FILE);
    await aaSetPhoto(DATA.activeProfileId, { name: PENDING_PHOTO_FILE.name, type: PENDING_PHOTO_FILE.type, dataUrl: photoUrl, ts: Date.now() });
    PENDING_PHOTO_FILE = null;
  }
  await aaSaveData(DATA);
  renderRaw();
  setStatus("Saved ✓", "success");
  if (saveBtn) { saveBtn.textContent = "Saved ✓"; setTimeout(function(){ saveBtn.disabled = false; saveBtn.textContent = saveBtn.dataset.originalText || "Save profile"; }, 1400); }
}

// Live: fields -> JSON (+ profile dropdown when label changes)
function onFieldInput() {
  collectForm();
  renderProfiles(); // keep toolbar select in sync with Profile label
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
