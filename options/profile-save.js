// Saving and synchronized form/raw JSON editing.
// Classic-script module; dependency order is declared in config/modules.json.
async function save() {
  if (!validateProfileForm()) return;
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn.disabled) return;
  const original = saveBtn.textContent;
  saveBtn.disabled = true; saveBtn.textContent = "Saving…";
  collectForm();
  const id = DATA.activeProfileId;
  const snapshot = JSON.parse(JSON.stringify(DATA));
  const cv = PENDING_CV_FILE, photo = PENDING_PHOTO_FILE, cover = PENDING_COVER_LETTER_FILE;
  try {
    const updates = { [STORAGE_KEY]: snapshot };
    if (cv) {
      const dataUrl = await aaFileToDataUrl(cv);
      let text = ""; try { text = await aaExtractText(cv); } catch (e) { /* File is still usable for upload. */ }
      updates[aaAttachmentKey(AA_RESUMES_KEY, id)] = { name: cv.name, type: cv.type, dataUrl: dataUrl, text: text, ts: Date.now() };
    }
    if (photo) updates[aaAttachmentKey(AA_PHOTOS_KEY, id)] = { name: photo.name, type: photo.type, dataUrl: await aaFileToDataUrl(photo), ts: Date.now() };
    if (cover) updates[aaAttachmentKey(AA_COVER_LETTERS_KEY, id)] = { name: cover.name, type: cover.type, dataUrl: await aaFileToDataUrl(cover), ts: Date.now() };
    await chrome.storage.local.set(updates);
    if (PENDING_CV_FILE === cv) PENDING_CV_FILE = null;
    if (PENDING_PHOTO_FILE === photo) PENDING_PHOTO_FILE = null;
    if (PENDING_COVER_LETTER_FILE === cover) PENDING_COVER_LETTER_FILE = null;
    renderRaw(); setStatus("Saved ✓", "success");
  } catch (err) { setStatus("Save failed: " + (err.message || err) + ". Your changes are still open; try again.", "error"); }
  finally { saveBtn.disabled = false; saveBtn.textContent = original; }

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
      parsed = aaValidateProfileData(JSON.parse(ta.value));
    } catch (err) {
      setRawStatus("Invalid JSON \u2014 will restore on blur", "error");
      return;
    }
    if (DATA.activeProfileId !== parsed.activeProfileId) PENDING_CV_FILE = PENDING_PHOTO_FILE = PENDING_COVER_LETTER_FILE = null;
    DATA = parsed;
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
    parsed = aaValidateProfileData(JSON.parse(ta.value));
  } catch (err) {
    ta.value = lastGoodJson;
    setRawStatus("Restored last working JSON", "error");
    return;
  }
  if (DATA.activeProfileId !== parsed.activeProfileId) PENDING_CV_FILE = PENDING_PHOTO_FILE = PENDING_COVER_LETTER_FILE = null;
  DATA = parsed;
  renderProfiles();
  renderForm();
  renderRaw();
  setRawStatus("", "");
}

// ---- AI resume import -------------------------------------------------
