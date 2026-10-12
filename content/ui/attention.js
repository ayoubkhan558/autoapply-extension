// Remaining eligible fields, required hints, and selected-field reporting.
// Classic-script module; dependency order is declared in config/modules.json.
function aaRequiredHint(el) {
  if (!el) return false;
  if (el.required || el.getAttribute("aria-required") === "true") return true;
  return /\*|\brequired\b/i.test(getLabelText(el) || "");
}

// Collect every field that was NOT filled so the result panel can show it:
// empty text inputs, unselected dropdowns (native + custom widgets),
// unanswered required radio groups, and required checkboxes.
function aaUnfilledFields(controls, includeCustom) {
  const list = aaEligibleControls(controls ? {controls:controls} : {}).controls;
  const seen = {};
  const out = [];
  const radioGroups = {};
  function add(label, required) {
    let lab = (label || "").replace(/\s+/g, " ").replace(/\*+/g, "").trim();
    // Never drop a genuinely-empty field just because we couldn't read a
    // label; otherwise the result panel would falsely report "no empty
    // fields detected" when the form is only partially filled.
    if (!lab) lab = "Unlabeled field";
    if (lab.length > 48) lab = lab.slice(0, 45) + "…";
    const k = lab.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    out.push({ label: lab, required: !!required });
  }
  list.forEach(function (el) {
    if (el.disabled || el.readOnly) return;

    if (el.classList && el.classList.contains(HL_CLASS)) return;
    const tag = el.tagName;
    const t = (el.type || "").toLowerCase();
    const sig = { text: getLabelText(el), attr: getAttrText(el) };
    if (isSearchField(el, sig)) return;
    if (t === "radio") {
      const key = el.name || ("__nn_" + (el.id || ""));
      (radioGroups[key] = radioGroups[key] || []).push(el);
      return;
    }
    if (t === "checkbox") {
      if (!el.checked && aaRequiredHint(el)) add(sig.text || sig.attr, true);
      return;
    }
    if (["hidden", "submit", "button", "reset", "image", "file", "password"].indexOf(t) !== -1) return;
    if (tag === "SELECT") {
      const opt = el.options[el.selectedIndex];
      const ov = opt ? norm(opt.textContent) : "";
      const empty = !el.value || el.selectedIndex <= 0 || /^(--|select|choose|please|none|any|pick)/.test(ov);
      if (empty) add(sig.text || sig.attr, aaRequiredHint(el));
      return;
    }
    if ((el.isContentEditable ? el.textContent : (el.value || "")).trim()) return;
    add(sig.text || sig.attr, aaRequiredHint(el));
  });
  Object.keys(radioGroups).forEach(function (key) {
    const g = radioGroups[key];
    if (g.some(function (r) { return r.checked; })) return;
    add(questionText(g[0]) || key, g.some(aaRequiredHint));
  });
  if (includeCustom) {
    let nodes;
    try { nodes = document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"], [aria-haspopup="true"]'); } catch (e) { nodes = []; }
    Array.prototype.forEach.call(nodes, function (el) {
      const tg = el.tagName;
      if (tg === "SELECT" || tg === "INPUT" || tg === "TEXTAREA") return;
      if (!aaIsEligible(el)) return;
      if (el.classList && el.classList.contains(HL_CLASS)) return;
      const sig = { text: customSelectLabel(el), attr: getAttrText(el) };
      if (isSearchField(el, sig)) return;
      const txt = norm(el.textContent);
      const looksEmpty = !txt || txt.length > 80 || /^(select|choose|please|none|any|pick|--)/.test(txt);
      if (looksEmpty) add(sig.text || sig.attr, aaRequiredHint(el));
    });
  }
  out.sort(function (a, b) { return (b.required ? 1 : 0) - (a.required ? 1 : 0); });
  return out.slice(0, 20);
}


function aaSelectedUnfilled(selected, filledEls, box) {
  selected = aaEligibleControls({controls:selected,box:box}).controls;
  const seen = {};
  const out = [];
  const radioGroups = {};
  function add(label, required) {
    let lab = (label || "").replace(/\s+/g, " ").replace(/\*+/g, "").trim();
    if (!lab) lab = "Unlabeled field";
    if (lab.length > 48) lab = lab.slice(0, 45) + "\u2026";
    const k = lab.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    out.push({ label: lab, required: !!required });
  }
  selected.forEach(function (el) {
    if (filledEls.indexOf(el) !== -1) return;
    if (el.disabled || el.readOnly) return;
    const tag = el.tagName;
    const t = (el.type || "").toLowerCase();
    const sig = { text: getLabelText(el), attr: getAttrText(el) };
    if (isSearchField(el, sig)) return;
    if (t === "radio") {
      const key = el.name || ("__nn_" + (el.id || ""));
      (radioGroups[key] = radioGroups[key] || []).push(el);
      return;
    }
    if (t === "checkbox") { if (!el.checked) add(sig.text || sig.attr, aaRequiredHint(el)); return; }
    if (["hidden", "submit", "button", "reset", "image", "file", "password"].indexOf(t) !== -1) return;
    if (tag === "SELECT") {
      const opt = el.options[el.selectedIndex];
      const ov = opt ? norm(opt.textContent) : "";
      const empty = !el.value || el.selectedIndex <= 0 || /^(--|select|choose|please|none|any|pick)/.test(ov);
      if (empty) add(sig.text || sig.attr, aaRequiredHint(el));
      return;
    }
    if ((el.isContentEditable ? el.textContent : (el.value || "")).trim()) return;
    add(sig.text || sig.attr, aaRequiredHint(el));
  });
  Object.keys(radioGroups).forEach(function (key) {
    const g = radioGroups[key];
    if (g.some(function (r) { return r.checked; })) return;
    add(questionText(g[0]) || key, g.some(aaRequiredHint));
  });
  // Also surface custom (non-native) dropdown widgets inside the box that are
  // still empty, so nothing the user selected is silently ignored.
  if (box) {
    let widgets;
    try { widgets = document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"], [aria-haspopup="true"]'); } catch (e) { widgets = []; }
    Array.prototype.forEach.call(widgets, function (el) {
      const tg = el.tagName;
      if (tg === "SELECT" || tg === "INPUT" || tg === "TEXTAREA") return;
      if (!aaIsEligible(el, {box:box})) return;
      if (filledEls.indexOf(el) !== -1) return;
      let r;
      try { r = el.getBoundingClientRect(); } catch (e2) { return; }
      if (r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom) return;
      const sig = { text: customSelectLabel(el), attr: getAttrText(el) };
      if (isSearchField(el, sig)) return;
      const txt = norm(el.textContent);
      const looksEmpty = !txt || txt.length > 80 || /^(--|select|choose|please|none|any|pick)/.test(txt);
      if (looksEmpty) add(sig.text || sig.attr, aaRequiredHint(el));
    });
  }
  out.sort(function (a, b) { return (b.required ? 1 : 0) - (a.required ? 1 : 0); });
  return out.slice(0, 30);
}
