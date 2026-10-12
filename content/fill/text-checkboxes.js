// Text and skill-checkbox fill planning; consent remains manual.
// Classic-script module; dependency order is declared in config/modules.json.
function planText(controls, flat, customFields) {
  controls = aaEligibleControls({controls:controls}).controls;
  const out = [];
  controls.forEach(function (el) {
    const t = (el.type || "").toLowerCase();
    if (t === "radio" || t === "checkbox" || (!el.matches("input,select,textarea") && !el.isContentEditable)) return;
    if (!isFillable(el) && !el.isContentEditable) return;
    if (el.isContentEditable && (el.innerText || el.textContent || "").trim()) return;
    if (!el.isContentEditable && el.tagName !== "SELECT" && el.value && el.value.trim()) return;
    const sig = { text: getLabelText(el), attr: getAttrText(el), salaryCurrency: flat["professional.salaryCurrency"] || "" };
    if (isSearchField(el, sig)) return;
    const best = resolveValue(sig, flat, customFields);
    if (best.score < 0.6) return;
    let value = best.value;
    if (value === undefined || value === null || value === "") return;
    value = transformValue(el, sig, String(value));
    out.push({ kind: el.tagName === "SELECT" ? "select" : "text", el: el, label: displayLabel(sig, el), value: String(value), score: best.score, editable: true });
  });
  return out;
}


function planCheckboxes(controls, skillTokens) {
  controls = aaEligibleControls({controls:controls}).controls;
  const out = [];
  controls.forEach(function (el) {
    if ((el.type || "").toLowerCase() !== "checkbox" || el.disabled || el.checked) return;
    const lbl = norm(optionLabel(el) || getLabelText(el));
    if (!lbl) return;
    if (/newsletter|subscribe|marketing|promotional|mailing list/.test(lbl)) return;
    if (/none of/.test(lbl)) return;
    if (/\bagree\b|terms|privacy|consent|i have read|gdpr|authori[sz]e|certify|acknowledge|declare/.test(lbl)) return; // Human review required.
    const hit = skillTokens.some(function (tk) { return tk.length >= 2 && (lbl === tk || lbl.indexOf(tk) !== -1 || tk.indexOf(lbl) !== -1); });
    if (hit) out.push({ kind: "checkbox", el: el, label: "Skill: " + (getLabelText(el) || lbl), value: "check", score: 0.9, editable: false });
  });
  return out;
}
