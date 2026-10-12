// CV/photo/cover-letter profile block and attachment controls.
// Classic-script module; dependency order is declared in config/modules.json.
function renderCvProfileBlock(prof) {
  const block = document.createElement("div");
  block.className = "aa-card-block aa-card-block--cv aa-profile-cv";
  block.innerHTML = `
    <section class="aa-upload-section">
      <h3 class="aa-upload-section__title">Profile CV / Resume</h3>
      <p class="aa-muted aa-muted--small aa-upload-section__hint">Stored per profile and auto-attached to CV/resume upload fields.</p>
      <div class="aa-upload-section__actions">
        <label class="aa-btn aa-btn--ghost aa-btn--file">
          Choose CV / resume
          <input type="file" id="profileCvFile" accept=".pdf,.doc,.docx" hidden>
        </label>
      </div>
      <div id="profileCvMeta" class="aa-file-meta aa-hidden" aria-live="polite">
        <span id="profileCvIcon" class="aa-file-meta__icon" aria-hidden="true"></span>
        <span id="profileCvMetaText" class="aa-file-meta__text"></span>
        <a id="profileCvPreviewLink" class="aa-file-meta__link aa-hidden" href="#" target="_blank" rel="noopener">Preview</a>
      </div>
      <p id="profileCvStatus" class="aa-upload-section__status aa-hidden"></p>
    </section>

    <section class="aa-upload-section">
      <h3 class="aa-upload-section__title">Cover letter file</h3>
      <p class="aa-muted aa-muted--small aa-upload-section__hint">PDF/DOC attached to cover-letter upload fields on application forms.</p>
      <div class="aa-upload-section__actions">
        <label class="aa-btn aa-btn--ghost aa-btn--file">
          Choose cover letter
          <input type="file" id="profileCoverFile" accept=".pdf,.doc,.docx" hidden>
        </label>
        <button type="button" id="profileCoverRemove" class="aa-btn aa-btn--ghost">Remove</button>
      </div>
      <div id="profileCoverMeta" class="aa-file-meta aa-hidden" aria-live="polite">
        <span id="profileCoverIcon" class="aa-file-meta__icon" aria-hidden="true"></span>
        <span id="profileCoverMetaText" class="aa-file-meta__text"></span>
        <a id="profileCoverPreviewLink" class="aa-file-meta__link aa-hidden" href="#" target="_blank" rel="noopener">Preview</a>
      </div>
      <p id="profileCoverStatus" class="aa-upload-section__status aa-hidden"></p>
    </section>

    <section class="aa-upload-section">
      <h3 class="aa-upload-section__title">Profile picture</h3>
      <p class="aa-muted aa-muted--small aa-upload-section__hint">Attached to photo / picture upload fields on application forms.</p>
      <img id="profilePhotoPreview" class="aa-photo-preview aa-hidden" alt="Profile picture preview">
      <div class="aa-upload-section__actions">
        <label class="aa-btn aa-btn--ghost aa-btn--file">
          Choose photo
          <input type="file" id="profilePhotoFile" accept="image/*" hidden>
        </label>
        <button type="button" id="profilePhotoRemove" class="aa-btn aa-btn--ghost">Remove</button>
      </div>
      <p id="profilePhotoStatus" class="aa-upload-section__status aa-hidden"></p>
    </section>

    <p class="aa-muted aa-muted--small aa-profile-cv__foot">After choosing a file, click the bottom Save button to save it with this profile.</p>
  `;
  setTimeout(function () {
    function fileIconHtml(file) {
      const name = ((file && file.name) || "").toLowerCase();
      const type = ((file && file.type) || "").toLowerCase();
      const isPdf = name.endsWith(".pdf") || type === "application/pdf";
      const stroke = isPdf ? "#d70015" : "#0066cc";
      return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="' + stroke + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"></path><path d="M14 2v5h5"></path><path d="M8 13h8"></path><path d="M8 17h6"></path></svg>';
    }
    function setUploadUi(meta, iconEl, metaText, linkEl, statusEl, file, opts) {
      opts = opts || {};
      if (!meta || !statusEl) return;
      if (file && file.name) {
        meta.classList.remove("aa-hidden");
        if (iconEl) iconEl.innerHTML = fileIconHtml(file);
        if (metaText) metaText.textContent = file.name;
        if (linkEl) {
          if (opts.previewUrl) { linkEl.href = opts.previewUrl; linkEl.classList.remove("aa-hidden"); }
          else { linkEl.classList.add("aa-hidden"); }
        }
        if (opts.statusText) {
          statusEl.textContent = opts.statusText;
          statusEl.className = "aa-upload-section__status aa-status" + (opts.statusKind ? " aa-" + opts.statusKind : "");
          statusEl.classList.remove("aa-hidden");
        } else {
          statusEl.textContent = "";
          statusEl.classList.add("aa-hidden");
        }
        return;
      }
      meta.classList.add("aa-hidden");
      if (linkEl) linkEl.classList.add("aa-hidden");
      statusEl.textContent = opts.emptyText || "No file saved yet.";
      statusEl.className = "aa-upload-section__status aa-status";
      statusEl.classList.toggle("aa-hidden", !opts.emptyText);
    }

    const input = document.getElementById("profileCvFile");
    const st = document.getElementById("profileCvStatus");
    const meta = document.getElementById("profileCvMeta");
    const iconEl = document.getElementById("profileCvIcon");
    const metaText = document.getElementById("profileCvMetaText");
    const linkEl = document.getElementById("profileCvPreviewLink");
    if (input) input.onchange = function () {
      PENDING_CV_FILE = input.files && input.files[0] ? input.files[0] : null;
      if (PENDING_CV_FILE) setUploadUi(meta, iconEl, metaText, linkEl, st, PENDING_CV_FILE, { statusText: "Ready to save — click Save profile below." });
      else if (prof && prof.id) aaGetResume(prof.id).then(function (cv) { setUploadUi(meta, iconEl, metaText, linkEl, st, cv, { previewUrl: cv && cv.dataUrl, emptyText: "No CV saved yet." }); });
    };
    if (prof && prof.id && st) aaGetResume(prof.id).then(function (cv) {
      setUploadUi(meta, iconEl, metaText, linkEl, st, cv, { previewUrl: cv && cv.dataUrl, emptyText: "No CV saved yet." });
    });

    const cin = document.getElementById("profileCoverFile");
    const cst = document.getElementById("profileCoverStatus");
    const crm = document.getElementById("profileCoverRemove");
    const cmeta = document.getElementById("profileCoverMeta");
    const ciconEl = document.getElementById("profileCoverIcon");
    const cmetaText = document.getElementById("profileCoverMetaText");
    const clinkEl = document.getElementById("profileCoverPreviewLink");
    if (cin) cin.onchange = function () {
      PENDING_COVER_LETTER_FILE = cin.files && cin.files[0] ? cin.files[0] : null;
      if (PENDING_COVER_LETTER_FILE) setUploadUi(cmeta, ciconEl, cmetaText, clinkEl, cst, PENDING_COVER_LETTER_FILE, { statusText: "Ready to save — click Save profile below." });
      else if (prof && prof.id) aaGetCoverLetter(prof.id).then(function (cl) { setUploadUi(cmeta, ciconEl, cmetaText, clinkEl, cst, cl, { previewUrl: cl && cl.dataUrl, emptyText: "No cover letter saved." }); });
    };
    if (crm) crm.onclick = function () {
      PENDING_COVER_LETTER_FILE = null;
      if (cin) cin.value = "";
      setUploadUi(cmeta, ciconEl, cmetaText, clinkEl, cst, null, { emptyText: "No cover letter saved." });
      if (prof && prof.id) aaRemoveCoverLetter(prof.id);
    };
    if (prof && prof.id && cst) aaGetCoverLetter(prof.id).then(function (cl) {
      setUploadUi(cmeta, ciconEl, cmetaText, clinkEl, cst, cl, { previewUrl: cl && cl.dataUrl, emptyText: "No cover letter saved." });
    });

    const pin = document.getElementById("profilePhotoFile");
    const pst = document.getElementById("profilePhotoStatus");
    const prm = document.getElementById("profilePhotoRemove");
    const prev = document.getElementById("profilePhotoPreview");
    function showPhoto(file, src, statusText) {
      if (prev) {
        if (src) { prev.src = src; prev.classList.remove("aa-hidden"); }
        else { prev.removeAttribute("src"); prev.classList.add("aa-hidden"); }
      }
      if (!pst) return;
      if (file && file.name) {
        pst.textContent = statusText || file.name;
        pst.className = "aa-upload-section__status aa-status";
        pst.classList.toggle("aa-hidden", !statusText);
      } else {
        pst.textContent = "No photo saved.";
        pst.className = "aa-upload-section__status aa-status";
        pst.classList.remove("aa-hidden");
      }
    }
    if (pin) pin.onchange = function () {
      PENDING_PHOTO_FILE = pin.files && pin.files[0] ? pin.files[0] : null;
      if (PENDING_PHOTO_FILE) showPhoto(PENDING_PHOTO_FILE, URL.createObjectURL(PENDING_PHOTO_FILE), "Ready to save — click Save profile below.");
      else showPhoto(null, null, "");
    };
    if (prm) prm.onclick = function () {
      PENDING_PHOTO_FILE = null;
      if (pin) pin.value = "";
      showPhoto(null, null, "");
      if (prof && prof.id) aaRemovePhoto(prof.id);
    };
    if (prof && prof.id && pst) aaGetPhoto(prof.id).then(function (ph) {
      showPhoto(ph, ph && ph.dataUrl, ph && ph.name ? "" : "");
    });
  }, 0);
  return block;
}
