// Resume, photo, cover letter, and Google Forms uploads.
// Classic-script module; dependency order is declared in config/modules.json.
function aaGformFileWidgets(kind) {
  const out = [];
  const isCover = kind === "cover";
  const isPhoto = kind === "photo";
  try {
    document.querySelectorAll(".geS5n [role=\"heading\"]").forEach(function (h) {
      const t = norm(aaText(h));
      if (isCover) {
        if (!/cover letter|coverletter|cover note|covernote/.test(t)) return;
        if (/resume|cv|curriculum/.test(t)) return;
      } else if (isPhoto) {
        if (!/photo|picture|avatar|headshot|profile image/.test(t)) return;
      } else {
        if (!/(resume|cv|curriculum)/.test(t)) return;
        if (/cover letter|coverletter|cover note|covernote/.test(t) && !/(resume|cv|curriculum)/.test(t)) return;
      }
      const block = h.closest(".geS5n");
      if (!block || aaIsHidden(block)) return;
      if (block.querySelector("[role=\"listitem\"][data-mime-type], [data-mime-type]")) return;
      const btn = block.querySelector("[aria-label=\"Add file\"], [jsname=\"mWZCyf\"]");
      if (!btn || !aaIsEligible(btn, {actions:true}) || !aaCanSafeClick(btn)) return;
      out.push({ block: block, btn: btn, text: t });
    });
  } catch (e) { /* ignore */ }
  return out;
}

async function applyGformFile(item) {
  const block = item.block;
  if (block && block.querySelector("[role=\"listitem\"][data-mime-type], [data-mime-type]")) {
    markFilled(item.el, item.score);
    return true;
  }
  try { if (!aaIsEligible(item.el, {actions:true}) || !aaSafeClick(item.el)) return false; } catch (e) { return false; }
  await sleep(500);
  let input = block && block.querySelector('input[type="file"]');
  if (!input) {
    aaEligibleControls({allowFiles:true}).controls.forEach(function (el) {
      if (input || (el.type || "").toLowerCase() !== "file" || el.disabled) return;
      const lbl = norm(getLabelText(el) + " " + getAttrText(el));
      if (item.kind === "cover") {
        if (/cover letter|coverletter|cover note|covernote/.test(lbl) && !/resume|cv|curriculum/.test(lbl)) input = el;
      } else if (/resume|cv|curriculum/.test(lbl)) input = el;
    });
  }
  if (!input) return false;
  return aaSetFileInput(input, item.stored, item.score);
}

async function planResume() {
  let stored = null;
  try { stored = await aaLoadActiveResume(); } catch (e) { stored = null; }
  if (!stored || !stored.dataUrl) return null;
  const inputs = [];
  aaEligibleControls({allowFiles:true}).controls.forEach(function (el) { if ((el.type || "").toLowerCase() === "file" && !el.disabled) inputs.push(el); });
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i];
    const lbl = norm(getLabelText(el) + " " + getAttrText(el));
    if (/cover letter|coverletter|cover note|covernote/.test(lbl) && !/resume|cv|curriculum/.test(lbl)) continue;
    if (/resume|cv|curriculum/.test(lbl)) {
      return { kind: "resume", el: el, label: "Attach CV: " + (stored.name || "resume"), value: (stored.name || "resume"), score: 0.9, editable: false, stored: stored };
    }
  }
  const widgets = aaGformFileWidgets("resume");
  if (widgets.length) {
    const w = widgets[0];
    return { kind: "resume", gform: true, el: w.btn, block: w.block, label: "Attach CV: " + (stored.name || "resume"), value: (stored.name || "resume"), score: 0.9, editable: false, stored: stored };
  }
  return null;
}

// Attach the profile photo to photo/picture/avatar upload fields.
async function planPhoto() {
  let stored = null;
  try { stored = await aaLoadActivePhoto(); } catch (e) { stored = null; }
  if (!stored || !stored.dataUrl) return null;
  const inputs = aaEligibleControls({allowFiles:true}).controls.filter(function (el) { return (el.type || "").toLowerCase() === "file" && !el.disabled; });
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i];
    const lbl = norm(getLabelText(el) + " " + getAttrText(el));
    if (/resume|cv|curriculum/.test(lbl)) continue;
    if (/cover letter|coverletter|cover note|covernote/.test(lbl)) continue;
    const wantsImage = (el.accept || "").indexOf("image") !== -1;
    if (/photo|picture|avatar|headshot|profile image|profileimage/.test(lbl) || wantsImage) {
      return { kind: "resume", el: el, label: "Attach photo: " + (stored.name || "photo"), value: stored.name || "photo", score: 0.9, editable: false, stored: stored };
    }
  }
  return null;
}

async function planCoverLetter() {
  let stored = null;
  try { stored = await aaLoadActiveCoverLetter(); } catch (e) { stored = null; }
  if (!stored || !stored.dataUrl) return null;
  const inputs = aaEligibleControls({allowFiles:true}).controls.filter(function (el) { return (el.type || "").toLowerCase() === "file" && !el.disabled; });
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i];
    const lbl = norm(getLabelText(el) + " " + getAttrText(el));
    if (/cover letter|coverletter|cover note|covernote|upload cover|attach cover/.test(lbl) && !/resume|cv|curriculum/.test(lbl)) {
      return { kind: "cover", el: el, label: "Attach cover letter: " + (stored.name || "cover-letter"), value: stored.name || "cover-letter", score: 0.9, editable: false, stored: stored };
    }
  }
  const widgets = aaGformFileWidgets("cover");
  if (widgets.length) {
    const w = widgets[0];
    return { kind: "cover", gform: true, el: w.btn, block: w.block, label: "Attach cover letter: " + (stored.name || "cover-letter"), value: stored.name || "cover-letter", score: 0.9, editable: false, stored: stored };
  }
  return null;
}

// ---- Custom dropdown (non-native select) support --------------------
