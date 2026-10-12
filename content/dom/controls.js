// Open-shadow-root collection and native/ARIA choice updates.
// Classic-script module; dependency order is declared in config/modules.json.
function collectControls(scope, includeWidgets) {
  const acc = [];
  function walk(root) {
    let list;
    try { list = root.querySelectorAll("input, textarea, select" + (includeWidgets ? ", [contenteditable=\"true\"], " + AA_CUSTOM_SELECTOR : "")); } catch (e) { list = []; }
    for (let i = 0; i < list.length; i++) acc.push(list[i]);
    let all;
    try { all = root.querySelectorAll("*"); } catch (e) { all = []; }
    for (let i = 0; i < all.length; i++) { if (all[i].shadowRoot) walk(all[i].shadowRoot); }
  }
  walk(scope || document);
  return Array.from(new Set(acc));
}


function setNativeChecked(el, checked) {
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked");
  if (desc && desc.set) desc.set.call(el, checked);
  else el.checked = checked;
}

function checkEl(el) {
  // Google Forms and similar widgets use role="radio" divs instead of inputs.
  if (el.getAttribute && el.getAttribute("role") === "radio") {
    if (el.getAttribute("aria-checked") !== "true") { try { aaSafeClick(el); } catch (e) { /* ignore */ } }
    el.classList.add(HL_CLASS);
    return el.getAttribute("aria-checked") === "true";
  }
  // Prefer a real click: it toggles the control natively and fires the full
  // event sequence (pointer, click, input, change) custom widgets rely on.
  if (!el.checked) { try { aaSafeClick(el); } catch (e) { /* ignore */ } }
  if (!el.checked) {
    setNativeChecked(el, true);
    el.dispatchEvent(new Event("click", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  el.classList.add(HL_CLASS);
  return !!el.checked;
}

// Label for ONE radio/checkbox option (not the whole question). Unlike
// getLabelText, this never falls back to the surrounding question text,
// which previously made every option in a group look identical and broke
// radio/checkbox matching.
