// AutoApply content module. Loaded into the extension isolated world.
// Profile flatten, planners, custom selects, repeaters, main fill run.
// ---- Fill context + planners ----------------------------------------
async function aaFillContext() {
  const data = await aaLoadData();
  const profile = aaGetActiveProfile(data);
  if (!profile) return null;
  const flat = buildFlat(profile);
  const customFields = Array.isArray(profile.customFields) ? profile.customFields : [];
  let skillsRaw = (profile.professional && profile.professional.skills) || "";
  if (Array.isArray(skillsRaw)) skillsRaw = skillsRaw.join(", ");
  const skillTokens = valTokens(skillsRaw);
  return { profile: profile, flat: flat, customFields: customFields, skillTokens: skillTokens };
}

// Load the CV/resume saved for the currently active profile (per-profile storage).
async function aaLoadActiveResume() {
  try {
    const data = await aaLoadData();
    return await aaGetResume(data && data.activeProfileId);
  } catch (e) { return null; }
}

async function aaLoadActivePhoto() {
  try {
    const data = await aaLoadData();
    return await aaGetPhoto(data && data.activeProfileId);
  } catch (e) { return null; }
}

async function aaLoadActiveCoverLetter() {
  try {
    const data = await aaLoadData();
    return await aaGetCoverLetter(data && data.activeProfileId);
  } catch (e) { return null; }
}

async function aaLoadActiveResumeText() {
  try {
    const data = await aaLoadData();
    return await aaGetResumeText(data && data.activeProfileId);
  } catch (e) { return ""; }
}

function displayLabel(sig, el) {
  let t = ((sig && sig.text) || "").trim();
  if (!t) t = ((sig && sig.attr) || "").trim();
  t = t.replace(/\s+/g, " ");
  if (t.length > 64) t = t.slice(0, 61) + "\u2026";
  return t || "Field";
}

function planText(controls, flat, customFields) {
  const out = [];
  controls.forEach(function (el) {
    const t = (el.type || "").toLowerCase();
    if (t === "radio" || t === "checkbox") return;
    if (!isFillable(el) && !el.isContentEditable) return;
    if (el.isContentEditable && (el.innerText || el.textContent || "").trim()) return;
    if (!el.isContentEditable && el.tagName !== "SELECT" && el.value && el.value.trim()) return;
    const sig = { text: getLabelText(el), attr: getAttrText(el) };
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

function pickRadio(group, value) {
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
  const out = [];
  const groups = {};
  controls.forEach(function (el) {
    if ((el.type || "").toLowerCase() !== "radio" || el.disabled) return;
    const key = el.name || ("__nn_" + (el.id || ""));
    (groups[key] = groups[key] || []).push(el);
  });
  Object.keys(groups).forEach(function (key) {
    const group = groups[key];
    if (group.some(function (r) { return r.checked; })) return;
    const sig = { text: questionText(group[0]), attr: key };
    if (isSearchField(group[0], sig)) return;
    const best = resolveValue(sig, flat, customFields);
    if (best.score < 0.6 || best.value === undefined || best.value === null || best.value === "") return;
    const chosen = pickRadio(group, best.value);
    if (chosen) out.push({ kind: "radio", el: chosen, label: displayLabel(sig, chosen), value: (optionLabel(chosen) || chosen.value || "Selected"), score: best.score, editable: false });
  });
  return out;
}

function planCheckboxes(controls, skillTokens) {
  const out = [];
  controls.forEach(function (el) {
    if ((el.type || "").toLowerCase() !== "checkbox" || el.disabled || el.checked) return;
    const lbl = norm(optionLabel(el) || getLabelText(el));
    if (!lbl) return;
    if (/newsletter|subscribe|marketing|promotional|mailing list/.test(lbl)) return;
    if (/none of/.test(lbl)) return;
    if (/\bagree\b|terms|privacy|consent|i have read|gdpr|authori[sz]e|certify|acknowledge|declare/.test(lbl)) {
      out.push({ kind: "checkbox", el: el, label: "Agree: " + (getLabelText(el) || lbl), value: "check", score: 0.95, editable: false });
      return;
    }
    const hit = skillTokens.some(function (tk) { return tk.length >= 2 && (lbl === tk || lbl.indexOf(tk) !== -1 || tk.indexOf(lbl) !== -1); });
    if (hit) out.push({ kind: "checkbox", el: el, label: "Skill: " + (getLabelText(el) || lbl), value: "check", score: 0.9, editable: false });
  });
  return out;
}

async function planResume() {
  const inputs = [];
  collectControls().forEach(function (el) { if ((el.type || "").toLowerCase() === "file" && !el.disabled) inputs.push(el); });
  if (!inputs.length) return null;
  let stored = null;
  try { stored = await aaLoadActiveResume(); } catch (e) { stored = null; }
  if (!stored || !stored.dataUrl) return null;
  let target = null;
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i];
    const lbl = norm(getLabelText(el) + " " + getAttrText(el));
    if (/cover letter|coverletter|cover note|covernote/.test(lbl) && !/resume|cv|curriculum/.test(lbl)) continue;
    if (/resume|cv|curriculum/.test(lbl) || inputs.length === 1) { target = el; break; }
  }
  if (!target) return null;
  return { kind: "resume", el: target, label: "Attach CV: " + (stored.name || "resume"), value: (stored.name || "resume"), score: 0.9, editable: false, stored: stored };
}

// Attach the profile photo to photo/picture/avatar upload fields.
async function planPhoto() {
  let stored = null;
  try { stored = await aaLoadActivePhoto(); } catch (e) { stored = null; }
  if (!stored || !stored.dataUrl) return null;
  const inputs = collectControls().filter(function (el) { return (el.type || "").toLowerCase() === "file" && !el.disabled; });
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
  const inputs = collectControls().filter(function (el) { return (el.type || "").toLowerCase() === "file" && !el.disabled; });
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i];
    const lbl = norm(getLabelText(el) + " " + getAttrText(el));
    if (/cover letter|coverletter|cover note|covernote|upload cover|attach cover/.test(lbl) && !/resume|cv|curriculum/.test(lbl)) {
      return { kind: "resume", el: el, label: "Attach cover letter: " + (stored.name || "cover-letter"), value: stored.name || "cover-letter", score: 0.9, editable: false, stored: stored };
    }
  }
  return null;
}

// ---- Custom dropdown (non-native select) support --------------------
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function aaIsHidden(el) {
  const st = window.getComputedStyle(el);
  if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity || "1") === 0) return true;
  if (el.offsetParent === null && st.position !== "fixed") return true;
  return false;
}

function customSelectLabel(el) {
  let t = (el.getAttribute("aria-label") || "") + " " + (el.id || "") + " " + (el.getAttribute("name") || "") + " " + (el.getAttribute("data-name") || "");
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    labelledby.split(/\s+/).forEach(function (id) { const n = document.getElementById(id); if (n) t += " " + n.textContent; });
  }
  if (el.id) {
    try {
      const sel = 'label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]';
      const lab = document.querySelector(sel);
      if (lab) t += " " + lab.textContent;
    } catch (e) { /* ignore */ }
  }
  const wrapLabel = el.closest("label");
  if (wrapLabel) t += " " + wrapLabel.textContent;
  const propEl = el.closest && el.closest("[cx-prop-label]");
  if (propEl) t += " " + (propEl.getAttribute("cx-prop-label") || "");
  const near = nearestLabel(el);
  if (near) t += " " + near;
  return t.replace(/\s+/g, " ").trim();
}

function aaMenuId(el) { return el.getAttribute("aria-controls") || el.getAttribute("aria-owns") || el.getAttribute("data-menu-id") || ""; }

async function fillCustomSelects(ctx, box, filledEls) {
  let filled = 0;
  const triggers = [];
  let nodes;
  try { nodes = document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"], [aria-haspopup="true"]'); } catch (e) { nodes = []; }
  nodes.forEach(function (el) {
    const tag = el.tagName;
    if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
    const ariaDisabled = el.getAttribute("aria-disabled");
    if (ariaDisabled === "true") return;
    if (el.disabled || aaIsHidden(el)) return;
    // When a lasso box is supplied, only consider widgets inside it.
    if (box) {
      let r;
      try { r = el.getBoundingClientRect(); } catch (e2) { return; }
      if (r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom) return;
    }
    triggers.push(el);
  });
  for (let i = 0; i < triggers.length && i < 30; i++) {
    const trg = triggers[i];
    try {
      const sig = { text: customSelectLabel(trg), attr: getAttrText(trg) };
      if (!sig.text && !sig.attr) continue;
      if (isSearchField(trg, sig)) continue;
      const best = resolveValue(sig, ctx.flat, ctx.customFields);
      if (best.score < 0.6 || best.value === undefined || best.value === null || best.value === "") continue;
      const want = norm(transformValue(trg, sig, String(best.value)));
      if (!want) continue;
      if (norm(trg.textContent).indexOf(want) !== -1) continue;
      trg.click();
      await sleep(240);
      let optionNodes;
      const mid = aaMenuId(trg);
      try { optionNodes = document.querySelectorAll((mid ? ("#" + (window.CSS && CSS.escape ? CSS.escape(mid) : mid) + " ") : "") + '[role="option"], [role="option"], li[role="option"], [role="menuitem"], [class*="option"], [class*="SelectOption"], [data-value]'); } catch (e) { optionNodes = []; }
      let picked = null;
      let exact = null;
      optionNodes.forEach(function (o) {
        if (exact || aaIsHidden(o)) return;
        const ot = norm(o.textContent);
        if (!ot || ot.length > 60) return;
        if (ot === want) exact = o;
        else if (!picked && want.length >= 2 && (ot.indexOf(want) !== -1 || want.indexOf(ot) !== -1)) picked = o;
        else if (!picked && /country/.test(norm(sig.text + " " + sig.attr))) {
          const pv = norm(String(best.value));
          if (pv && (ot.indexOf(pv) !== -1 || pv.indexOf(ot) !== -1)) picked = o;
        }
      });
      const picks = [];
      if (exact || picked) picks.push(exact || picked);
      else {
        // Token fallback: "PHP, Laravel" picks each matching option (covers
        // multi-selects like Zoho's "Preferred Team / Department (Pick up to 2)").
        const tokens = valTokens(best.value);
        optionNodes.forEach(function (o) {
          if (picks.length >= 3 || aaIsHidden(o)) return;
          const ot = norm(o.textContent);
          if (!ot || ot.length > 60) return;
          const hit = tokens.some(function (tk) { return tk.length >= 3 && (ot === tk || ot.indexOf(tk) !== -1 || tk.indexOf(ot) !== -1); });
          if (hit && picks.indexOf(o) === -1) picks.push(o);
        });
      }
      if (picks.length) {
        for (let pi = 0; pi < picks.length; pi++) { picks[pi].click(); await sleep(90); }
        markFilled(trg, best.score);
        filled++;
        if (filledEls) filledEls.push(trg);
      } else {
        trg.click();
        await sleep(60);
      }
    } catch (e) { /* ignore */ }
  }
  return filled;
}

// ---- Repeating sections (education / experience) ---------------------
// Some forms hide these behind an "Add Educational Details" style button and
// let you add multiple rows. Click the button per saved record, then fill
// the newly-revealed empty fields from that record.
function aaRepeaterEmpties(groupKey) {
  const out = [];
  collectControls().forEach(function (el) {
    const t = (el.type || "").toLowerCase();
    if (t === "radio" || t === "checkbox" || !isFillable(el)) return;
    if (el.tagName !== "SELECT" && el.value && el.value.trim()) return;
    if (el.tagName === "SELECT" && el.selectedIndex > 0) return;
    const sig = { text: getLabelText(el), attr: getAttrText(el) };
    const m = AutoApplyMatcher.match(sig);
    if (m.key && m.score >= 0.6 && m.key.indexOf(groupKey + ".") === 0) {
      out.push({ el: el, name: m.key.slice(groupKey.length + 1), sig: sig });
    }
  });
  return out;
}

function aaFindAddButton(re) {
  let nodes;
  try { nodes = document.querySelectorAll('button, a, [role="button"], input[type="button"]'); } catch (e) { nodes = []; }
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (aaIsHidden(el)) continue;
    const t = norm(aaText(el) || el.value || el.getAttribute("aria-label") || "");
    if (t && t.length <= 60 && re.test(t)) return el;
  }
  return null;
}

async function fillRepeaterSections(ctx) {
  const groups = [
    { key: "education", re: /(add|new|\+).{0,20}(education|qualification|academic|degree|school)|educational details/ },
    { key: "experience", re: /(add|new|\+).{0,20}(experience|employment|position|job|work)|employment details|work history/ }
  ];
  let filled = 0;
  for (let g = 0; g < groups.length; g++) {
    const grp = groups[g];
    const list = Array.isArray(ctx.profile[grp.key]) ? ctx.profile[grp.key] : [];
    const entries = list.filter(function (e) {
      return e && Object.keys(e).some(function (k) { return String(e[k] || "").trim(); });
    });
    if (!entries.length) continue;
    // If the section's fields are already on the page, the main pass filled
    // entry 0 into them; each further entry needs one click of the add
    // button. If no fields exist yet, the whole section is behind the
    // button, so entry 0 needs a click too.
    const hasFields = collectControls().some(function (el) {
      const m = AutoApplyMatcher.match({ text: getLabelText(el), attr: getAttrText(el) });
      return m.key && m.score >= 0.6 && m.key.indexOf(grp.key + ".") === 0;
    });
    for (let i = hasFields ? 1 : 0; i < entries.length && i < 10; i++) {
      const btn = aaFindAddButton(grp.re);
      if (!btn) break;
      try { btn.click(); } catch (e) { break; }
      await sleep(700);
      const empties = aaRepeaterEmpties(grp.key);
      if (!empties.length) break;
      let any = false;
      const entry = entries[i];
      empties.forEach(function (c) {
        let v = entry[c.name];
        if (Array.isArray(v)) v = v.filter(Boolean).join(", ");
        if (v === undefined || v === null || String(v).trim() === "") return;
        v = transformValue(c.el, c.sig, String(v));
        if (applyTextValue(c.el, String(v), 0.85)) { filled++; any = true; }
      });
      if (!any) break; // nothing matched this round; stop instead of clicking forever
    }
  }
  return filled;
}

async function run() {
  const ctx = await aaFillContext();
  if (!ctx) return { filled: 0, error: "no-profile" };
  const controls = collectControls();
  document.querySelectorAll('[contenteditable="true"], .ql-editor[contenteditable="true"], [role="textbox"][contenteditable="true"]').forEach(function (ed) { if (controls.indexOf(ed) === -1) controls.push(ed); });
  let filled = 0;
  planText(controls, ctx.flat, ctx.customFields).forEach(function (p) {
    if (applyTextValue(p.el, p.value, p.score)) filled++;
  });
  planRadios(controls, ctx.flat, ctx.customFields).forEach(function (p) {
    if (applyCheck(p.el, p.score)) filled++;
  });
  planCheckboxes(controls, ctx.skillTokens).forEach(function (p) {
    if (applyCheck(p.el, p.score)) filled++;
  });
  try { filled += await fillCustomSelects(ctx); } catch (e) { /* ignore */ }
  try { filled += await fillRepeaterSections(ctx); } catch (e) { /* ignore */ }
  const resume = await planResume();
  if (resume) { try { if (await applyResume(resume)) filled++; } catch (e) { /* ignore */ } }
  const photo = await planPhoto();
  if (photo) { try { if (await applyResume(photo)) filled++; } catch (e) { /* ignore */ } }
  const cover = await planCoverLetter();
  if (cover) { try { if (await applyResume(cover)) filled++; } catch (e) { /* ignore */ } }
  try { aaShowFillResult(filled, aaUnfilledFields(controls, true)); } catch (e) { /* ignore */ }
  if (filled > 0) { try { aaRecordFill(aaTopHost(), filled); } catch (e) { /* ignore */ } }
  return { filled: filled };
}
