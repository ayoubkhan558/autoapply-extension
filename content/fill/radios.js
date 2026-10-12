// Native and ARIA radio-group value/option planning.
// Classic-script module; dependency order is declared in config/modules.json.
function noticeOptionDays(lbl) {
  const low = norm(lbl);
  if (/more than a month|over a month|1\+ month|greater than a month/.test(low)) return 35;
  if (/immediate|none|^0\s*days?/.test(low)) return 0;
  const m = low.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function pickNoticeRadio(group, value) {
  let n = parseInt((String(value).match(/\d+/) || [""])[0], 10);
  if (!n && /immediate|^0$/.test(norm(String(value)))) n = 0;
  if (isNaN(n)) return null;
  let best = null;
  let bestDiff = Infinity;
  group.forEach(function (r) {
    const days = noticeOptionDays(optionLabel(r));
    if (days === null) return;
    const diff = Math.abs(days - n);
    if (diff < bestDiff) { bestDiff = diff; best = r; }
  });
  return best;
}

function pickExperienceRadio(group, value) {
  const m = String(value).match(/[\d.]+/);
  if (!m) return null;
  const yrs = parseFloat(m[0]);
  if (isNaN(yrs)) return null;
  let best = null;
  let bestDist = Infinity;
  group.forEach(function (r) {
    const range = experienceOptionRange(optionLabel(r));
    if (!range) return;
    let dist = 0;
    if (yrs < range.min) dist = range.min - yrs;
    else if (yrs > range.max) dist = yrs - range.max;
    if (dist < bestDist) { bestDist = dist; best = r; }
  });
  return best;
}

function experienceOptionRange(lbl) {
  const low = norm(lbl);
  const plus = low.match(/^(\d+)\s*\+|^(\d+)\s*plus|more than\s*(\d+)/);
  if (plus) {
    const n = parseInt(plus[1] || plus[2] || plus[3], 10);
    return n <= 100 ? { min: n, max: 999 } : null;
  }
  const range = low.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!range) return null;
  const min = parseInt(range[1], 10);
  const max = parseInt(range[2], 10);
  return max <= 100 ? { min: min, max: max } : null;
}

function groupIsYearRanges(group) {
  let n = 0;
  group.forEach(function (r) { if (experienceOptionRange(optionLabel(r))) n++; });
  return n >= 2 && n >= group.length * 0.5;
}

function pickRadio(group, value, sig) {
  const q = norm(((sig && sig.text) || "") + " " + questionText(group[0]));
  if (/notice|how soon can you join/.test(q)) {
    const hit = pickNoticeRadio(group, value);
    if (hit) return hit;
  }
  if (groupIsYearRanges(group)) {
    const hit = pickExperienceRadio(group, value);
    if (hit) return hit;
  }
  const tokens = valTokens(value);
  let chosen = null;
  group.forEach(function (r) {
    const rl = norm(optionLabel(r));
    if (!rl || chosen) return;
    const hit = tokens.some(function (tk) { return tk.length >= 2 && (rl === tk || rl.indexOf(tk) !== -1 || tk.indexOf(rl) !== -1); });
    if (hit) chosen = r;
  });
  if (!chosen && (isYes(value) || isNo(value))) {
    // Prefix match so "Yes, I am authorized" still matches a "yes" value.
    const want = isYes(value) ? /^y(es)?\b/ : /^no?\b/;
    group.forEach(function (r) { const rl = norm(optionLabel(r)); if (!chosen && want.test(rl)) chosen = r; });
  }
  return chosen;
}

function planRadios(controls, flat, customFields) {
  controls = aaEligibleControls({controls:controls}).controls;
  const out = [];
  const groups = {};
  controls.forEach(function (el) {
    if ((el.type || "").toLowerCase() !== "radio" || el.disabled) return;
    const key = el.name || ("__nn_" + (el.id || ""));
    (groups[key] = groups[key] || []).push(el);
  });
  try {
    document.querySelectorAll('[role="radiogroup"]').forEach(function (rg, idx) {
      if (aaIsHidden(rg)) return;
      const radios = [];
      rg.querySelectorAll('[role="radio"]').forEach(function (r) {
        if (r.getAttribute("aria-disabled") === "true" || controls.indexOf(r) === -1) return;
        radios.push(r);
      });
      if (!radios.length) return;
      const key = "__rg_" + idx + "_" + (rg.getAttribute("aria-labelledby") || rg.id || "");
      groups[key] = radios;
    });
  } catch (e) { /* ignore */ }
  Object.keys(groups).forEach(function (key) {
    const group = groups[key];
    const isWidget = key.indexOf("__rg_") === 0;
    if (isWidget) {
      if (group.some(function (r) { return r.getAttribute("aria-checked") === "true"; })) return;
    } else if (group.some(function (r) { return r.checked; })) return;
    const sig = { text: questionText(group[0]), attr: getAttrText(group[0]) + " " + key, salaryCurrency: flat["professional.salaryCurrency"] || "" };
    if (isSearchField(group[0], sig)) return;
    const best = resolveValue(sig, flat, customFields);
    if (best.score < 0.6 || best.value === undefined || best.value === null || best.value === "") return;
    const value = transformValue(group[0], sig, String(best.value));
    const chosen = pickRadio(group, value, sig);
    if (chosen) out.push({ kind: "radio", el: chosen, label: displayLabel(sig, chosen), value: (optionLabel(chosen) || chosen.value || "Selected"), score: best.score, editable: false });
  });
  return out;
}
