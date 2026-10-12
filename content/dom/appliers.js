// Eligibility-checked text, choice, and file application.
// Classic-script module; dependency order is declared in config/modules.json.
function applyTextValue(el, value, score) {
  if (!aaIsEligible(el) || (!el.matches("input,select,textarea") && !el.isContentEditable)) return false;
  let ok;
  if (el.tagName === "SELECT") ok = fillSelect(el, value);
  else ok = fillTextLike(el, String(value));
  if (ok) markFilled(el, score);
  return ok;
}

function applyCheck(el, score) {
  if (!aaIsEligible(el)) return false;
  const ok = checkEl(el);
  if (ok) markFilled(el, score);
  return ok;
}

async function aaSetFileInput(el, stored, score) {
  if (!el || !stored || !stored.dataUrl || !aaIsEligible(el, {allowFiles:true})) return false;
  const blob = await (await fetch(stored.dataUrl)).blob();
  const file = new File([blob], stored.name || "resume.pdf", { type: stored.type || blob.type || "application/pdf" });
  const dt = new DataTransfer();
  dt.items.add(file);
  if (!aaIsEligible(el, {allowFiles:true})) return false;
  el.files = dt.files;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  if (score !== undefined) markFilled(el, score);
  return true;
}

async function applyResume(item) {
  return aaSetFileInput(item.el, item.stored, item.score);
}
