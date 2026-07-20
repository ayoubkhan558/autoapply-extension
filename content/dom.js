// AutoApply content module. Loaded into the extension isolated world.
// DOM helpers, value transforms, fill primitives.
var HL_CLASS = "autoapply-filled";

// ---- Confidence indicators ------------------------------------------
function confClass(score) { return score >= 0.85 ? "aa-conf-high" : "aa-conf-guess"; }

function markFilled(el, score) {
  el.classList.remove("aa-conf-high");
  el.classList.remove("aa-conf-guess");
  el.classList.add(confClass(typeof score === "number" ? score : 0.9));
  el.classList.add(HL_CLASS);
  setTimeout(function () { el.classList.remove(HL_CLASS); }, 2500);
}

// ---- Date format auto-detection -------------------------------------
function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

function parseDateParts(value) {
  const v = String(value).trim();
  let m = v.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (m) return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
  m = v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (m) return { y: Number(m[3]), mo: Number(m[1]), d: Number(m[2]) };
  const dt = new Date(v);
  if (!isNaN(dt.getTime())) return { y: dt.getFullYear(), mo: dt.getMonth() + 1, d: dt.getDate() };
  return null;
}

function formatDate(parts, order, sep) {
  const y = String(parts.y);
  const mo = pad2(parts.mo);
  const d = pad2(parts.d);
  if (order === "mdy") return mo + sep + d + sep + y;
  if (order === "dmy") return d + sep + mo + sep + y;
  return y + sep + mo + sep + d;
}

function detectDatePattern(el, sig) {
  const attrPat = (el.getAttribute("date-pattern") || el.getAttribute("date-format") || el.getAttribute("data-date-format") || "").toLowerCase();
  const hay = (attrPat + " " + (el.placeholder || "") + " " + (el.title || "") + " " + ((sig && sig.text) || "")).toLowerCase();
  let sep = "/";
  if (hay.indexOf("-") !== -1 && /(dd|mm|yyyy)/.test(hay)) sep = "-";
  else if (/dd\.mm|mm\.dd/.test(hay)) sep = ".";
  if (/mm[\/\-.]dd[\/\-.](yyyy|yy)/.test(hay)) return { order: "mdy", sep: sep };
  if (/dd[\/\-.]mm[\/\-.](yyyy|yy)/.test(hay)) return { order: "dmy", sep: sep };
  if (/(yyyy|yy)[\/\-.]mm[\/\-.]dd/.test(hay)) return { order: "iso", sep: sep === "/" ? "-" : sep };
  return null;
}

function isDateField(el, sig) {
  const t = (el.type || "").toLowerCase();
  if (t === "date") return true;
  if (t === "number" || t === "email" || t === "tel" || t === "url") return false;
  const hay = (((sig && sig.text) || "") + " " + ((sig && sig.attr) || "") + " " + (el.placeholder || "")).toLowerCase();
  return /date of birth|\bdob\b|birth|\bdate\b|mm\/dd|dd\/mm|dd-mm|mm-dd|yyyy/.test(hay);
}

function normalizeDate(el, sig, value) {
  const parts = parseDateParts(value);
  if (!parts) return value;
  if ((el.type || "").toLowerCase() === "date") return formatDate(parts, "iso", "-");
  const pat = detectDatePattern(el, sig);
  if (!pat) return value;
  return formatDate(parts, pat.order, pat.sep);
}

// ---- Phone normalization --------------------------------------------
function isPhoneField(el, sig) {
  if ((el.type || "").toLowerCase() === "tel") return true;
  const hay = (((sig && sig.text) || "") + " " + ((sig && sig.attr) || "")).toLowerCase();
  return /phone|mobile|\btel\b|cell|contact number|whatsapp/.test(hay);
}

function findCountryCodeSelect(el) {
  let scope = el.parentElement;
  for (let up = 0; up < 4 && scope; up++) {
    let sels;
    try { sels = scope.querySelectorAll("select"); } catch (e) { sels = []; }
    for (let i = 0; i < sels.length; i++) {
      const s = sels[i];
      const hay = norm((s.name || "") + " " + (s.id || "") + " " + (s.getAttribute("aria-label") || ""));
      if (/country.?code|dial.?code|phone.?code|countrycode|isd/.test(hay)) return s;
      for (let o = 0; o < Math.min(s.options.length, 6); o++) {
        if (/^\+?\d{1,4}$/.test((s.options[o].textContent || "").trim())) return s;
      }
    }
    scope = scope.parentElement;
  }
  return null;
}

function normalizePhone(el, sig, value) {
  const v = String(value).trim();
  const digits = v.replace(/[^0-9]/g, "");
  const ccSelect = findCountryCodeSelect(el);
  const maxlen = parseInt(el.getAttribute("maxlength") || "0", 10);
  const wantsCC = /country code|with code|include code|\+/.test((((sig && sig.text) || "") + " " + (el.placeholder || "")).toLowerCase());
  if (ccSelect || (maxlen > 0 && maxlen <= 11)) {
    let nat = digits;
    if (nat.length > 10) nat = nat.slice(nat.length - 10);
    return nat;
  }
  if (wantsCC && v.charAt(0) !== "+") return "+" + digits;
  return v;
}

// ---- Currency normalization -----------------------------------------
function isSalaryField(el, sig) {
  const hay = (((sig && sig.text) || "") + " " + ((sig && sig.attr) || "")).toLowerCase();
  return /salary|compensation|\bctc\b|\bpay\b|wage|remuneration/.test(hay);
}

function normalizeCurrency(el, sig, value) {
  const t = (el.type || "").toLowerCase();
  if (t === "number" || t === "range") return String(value).replace(/[^0-9.]/g, "");
  const hay = norm((el.placeholder || "") + " " + ((sig && sig.attr) || ""));
  if (/amount|number|\bnum\b|digits/.test(hay)) return String(value).replace(/[^0-9.]/g, "");
  return value;
}

function transformValue(el, sig, value) {
  try {
    if (isDateField(el, sig)) return normalizeDate(el, sig, value);
    if (isPhoneField(el, sig)) return normalizePhone(el, sig, value);
    if (isSalaryField(el, sig)) return normalizeCurrency(el, sig, value);
  } catch (e) { /* ignore */ }
  return value;
}

// ---- Appliers -------------------------------------------------------
function applyTextValue(el, value, score) {
  let ok;
  if (el.tagName === "SELECT") ok = fillSelect(el, value);
  else ok = fillTextLike(el, String(value));
  if (ok) markFilled(el, score);
  return ok;
}

function applyCheck(el, score) {
  const ok = checkEl(el);
  if (ok) markFilled(el, score);
  return ok;
}

async function applyResume(item) {
  const stored = item.stored;
  const el = item.el;
  if (!stored || !stored.dataUrl) return false;
  const blob = await (await fetch(stored.dataUrl)).blob();
  const file = new File([blob], stored.name || "resume.pdf", { type: stored.type || blob.type || "application/pdf" });
  const dt = new DataTransfer();
  dt.items.add(file);
  el.files = dt.files;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  markFilled(el, item.score);
  return true;
}

function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

// Flatten the structured profile into dotted keys (e.g. "personal.email")
// that the matcher resolves against. Array values (languages/tools/etc.) are
// joined into comma-separated text so they can be typed into a single field.
function buildFlat(profile) {
  const flat = {};
  function put(key, val) { flat[key] = Array.isArray(val) ? val.filter(Boolean).join(", ") : val; }
  // Flat sections.
  ["personal", "address", "links", "professional"].forEach(function (sec) {
    const obj = profile[sec];
    if (obj && typeof obj === "object") {
      for (const k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) put(sec + "." + k, obj[k]); }
    }
  });
  // Profiles saved before v1.25 keep address values under personal.*; alias
  // them so address.* matcher keys still resolve without a migration pass.
  ["address1", "address2", "currentAddress", "permanentAddress", "city", "state", "zip", "country"].forEach(function (k) {
    if (!flat["address." + k] && flat["personal." + k]) flat["address." + k] = flat["personal." + k];
  });
  // Repeating sections: only the first entry is auto-filled.
  ["experience", "education", "projects", "certifications", "awards", "volunteering"].forEach(function (sec) {
    const list = Array.isArray(profile[sec]) ? profile[sec] : (profile[sec] ? [profile[sec]] : []);
    const first = list[0] || {};
    for (const k in first) { if (Object.prototype.hasOwnProperty.call(first, k)) put(sec + "." + k, first[k]); }
  });
  if (profile.personal) {
    flat["personal.fullName"] = [profile.personal.firstName, profile.personal.lastName].filter(Boolean).join(" ");
  }
  if (!flat["experience.company"] && flat["professional.currentCompany"]) flat["experience.company"] = flat["professional.currentCompany"];
  if (!flat["experience.title"] && flat["professional.currentTitle"]) flat["experience.title"] = flat["professional.currentTitle"];
  if (!flat["links.portfolio"] && flat["links.website"]) flat["links.portfolio"] = flat["links.website"];
  if (!flat["links.website"] && flat["links.portfolio"]) flat["links.website"] = flat["links.portfolio"];
  if (!flat["professional.availableStartDate"]) flat["professional.availableStartDate"] = aaNextMonthFirstDate();
  if (!flat["professional.currentCompany"] && flat["experience.company"]) flat["professional.currentCompany"] = flat["experience.company"];
  if (!flat["professional.currentTitle"] && flat["experience.title"]) flat["professional.currentTitle"] = flat["experience.title"];
  return flat;
}

function aaNextMonthFirstDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
}

function aaText(el) {
  if (!el) return "";
  return (el.innerText || el.textContent || "").trim();
}

// Walk up the DOM looking for the closest descriptive label/legend or
// preceding text node. Handles custom widgets (Zoho, etc.) that don't wire
// <label for> to the actual <input>.
function nearestLabel(el) {
  let node = el;
  for (let d = 0; d < 7 && node; d++) {
    const container = node.parentElement;
    if (!container) break;
    let lbl = null;
    try { lbl = container.querySelector("label, legend, .crm-from-label, [class*='label'], [class*='Label']"); } catch (e) { lbl = null; }
    if (lbl && !lbl.contains(el)) {
      const t = aaText(lbl);
      if (t && t.length <= 140) return t;
    }
    let sib = node.previousElementSibling;
    while (sib) {
      if (sib.tagName !== "INPUT" && sib.tagName !== "SELECT" && sib.tagName !== "TEXTAREA") {
        const t = aaText(sib);
        if (t && t.length <= 140 && /[a-z]/i.test(t)) return t;
      }
      sib = sib.previousElementSibling;
    }
    node = container;
    if (/^(FORM|BODY|MAIN)$/.test(node.tagName || "")) break;
  }
  return "";
}

function getLabelText(el) {
  const parts = [];
  const root = (el.getRootNode && el.getRootNode()) || document;
  const scope = root && root.querySelector ? root : document;
  if (el.id) {
    try { const lbl = scope.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (lbl) parts.push(lbl.textContent); } catch (e) { /* ignore */ }
  }
  const wrap = el.closest("label");
  if (wrap) parts.push(wrap.textContent);
  if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
  const labelledby = el.getAttribute("aria-labelledby");
  if (labelledby) {
    labelledby.split(/\s+/).forEach(function (id) {
      let n = null;
      try { n = scope.querySelector("#" + CSS.escape(id)); } catch (e) { n = document.getElementById(id); }
      if (n) parts.push(n.textContent);
    });
  }
  if (el.placeholder) parts.push(el.placeholder);
  if (el.title) parts.push(el.title);
  // Custom label attributes on the field or its widget wrappers,
  // e.g. cx-prop-label="Last Name", data-label, aria-roledescription.
  let node = el;
  for (let d = 0; d < 6 && node && node.attributes; d++) {
    for (let i = 0; i < node.attributes.length; i++) {
      const a = node.attributes[i];
      const an = (a.name || "").toLowerCase();
      if (a.value && /label/.test(an) && an !== "aria-labelledby" && an !== "aria-label") parts.push(a.value);
    }
    node = node.parentElement;
    if (node && /^(FORM|BODY|MAIN)$/.test(node.tagName || "")) break;
  }
  // Custom-widget wrappers (Zoho CRUX, etc.) carry the real label on an
  // ancestor many levels above the raw <input>, out of reach of the fixed-
  // depth walk above. closest() reaches it at any depth.
  try {
    const propEl = el.closest && el.closest("[cx-prop-label]");
    if (propEl) { const pl = propEl.getAttribute("cx-prop-label"); if (pl) parts.push(pl); }
  } catch (e) { /* ignore */ }
  // Fallback: nearest descriptive text in the surrounding row/group.
  if (parts.join("").replace(/[^a-z0-9]/gi, "").length < 2) {
    const near = nearestLabel(el);
    if (near) parts.push(near);
  }
  return parts.join(" ");
}

// Gather identifying attribute values from the field AND its widget
// wrappers. Many apps put the real field identity on a custom element
// (data-zcqa="rec_Last_Name", cx-prop-name, automationid, etc.) while the
// raw <input> only has an opaque name/id.
function getAttrText(el) {
  const vals = [];
  let node = el;
  for (let d = 0; d < 6 && node && node.attributes; d++) {
    for (let i = 0; i < node.attributes.length; i++) {
      const a = node.attributes[i];
      const an = (a.name || "").toLowerCase();
      const av = a.value;
      if (!av) continue;
      if (an === "name" || an === "id" || an === "autocomplete" || an === "placeholder" || an === "title" || an === "for") vals.push(av);
      else if (/(label|field|qa|prop-name|propname|automationid|automation-id|testid|test-id)/.test(an)) vals.push(av);
      else if (an.indexOf("data-") === 0 && av.length <= 60) vals.push(av);
    }
    node = node.parentElement;
    if (node && /^(FORM|BODY|MAIN|SECTION)$/.test(node.tagName || "")) break;
  }
  // Custom-widget identity attrs live on an ancestor far above the input
  // (Zoho CRUX: data-zcqa="rec_Zip_Code", cx-prop-name, cx-prop-zcqa).
  try {
    const idEl = el.closest && el.closest("[data-zcqa], [cx-prop-zcqa], [cx-prop-name]");
    if (idEl) {
      ["data-zcqa", "cx-prop-zcqa", "cx-prop-name"].forEach(function (a) {
        const v = idEl.getAttribute(a); if (v) vals.push(v);
      });
    }
  } catch (e) { /* ignore */ }
  return vals.join(" ");
}

function setNativeValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc && desc.set) { desc.set.call(el, value); }
  else { el.value = value; }
}

function setRichTextValue(el, value) {
  const v = String(value || "");
  el.focus();
  try { document.execCommand("selectAll", false, null); document.execCommand("insertText", false, v); } catch (e) { /* fallback below */ }
  if ((el.innerText || el.textContent || "").trim() !== v.trim()) {
    el.innerHTML = "";
    v.split(/\n/).forEach(function (line) {
      const block = document.createElement("div");
      block.className = "ql-block";
      block.textContent = line || " ";
      el.appendChild(block);
    });
  }
  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: v }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

function fireEvents(el) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

function fillTextLike(el, value) {
  let v = String(value);
  const t = (el.type || "").toLowerCase();
  if (t === "number" || t === "range") {
    const num = v.replace(/[^0-9.\-]/g, "");
    if (num === "" || isNaN(Number(num))) return false;
    v = num;
  }
  if (el.isContentEditable) setRichTextValue(el, v);
  else { setNativeValue(el, v); fireEvents(el); }
  return true;
}

// Commit a <select> choice through the native value setter so framework
// (React/Vue/Angular) controlled selects register the change, then fire the
// events they listen to.
function commitSelect(el, idx) {
  const desc = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
  if (desc && desc.set) desc.set.call(el, el.options[idx].value);
  el.selectedIndex = idx;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillSelect(el, value) {
  let rawValue = String(value || "");
  const sigText = norm(getLabelText(el) + " " + getAttrText(el));
  if (/notice/.test(sigText)) rawValue = rawValue.replace(/\s*days?$/i, " days");
  const target = norm(rawValue);
  if (!target) return false;
  const opts = el.options;
  for (let i = 0; i < opts.length; i++) {
    if (norm(opts[i].textContent) === target || norm(opts[i].value) === target) {
      commitSelect(el, i);
      return true;
    }
  }
  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < opts.length; i++) {
    const tx = norm(opts[i].textContent);
    if (!tx || /^(--|select|choose|please|no answer|none|any)\b/.test(tx)) continue;
    if (target.length >= 3 && (tx.indexOf(target) !== -1 || target.indexOf(tx) !== -1)) {
      const diff = Math.abs(tx.length - target.length);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
  }
  // Token-overlap fallback, e.g. profile "Bachelor's Degree, Computer Science"
  // vs option "Bachelors".
  if (bestIdx === -1) {
    const tokens = valTokens(value);
    for (let i = 0; i < opts.length && bestIdx === -1; i++) {
      const tx = norm(opts[i].textContent);
      if (!tx || /^(--|select|choose|please|no answer|none|any)\b/.test(tx)) continue;
      if (tokens.some(function (tk) { return tk.length >= 3 && (tx === tk || tx.indexOf(tk) !== -1); })) bestIdx = i;
    }
  }
  // Notice-period fallback: map "30" to "30 days" / value "30 00:00:00".
  if (bestIdx === -1 && /notice/.test(sigText)) {
    const n = (String(value).match(/\d+/) || [""])[0];
    if (n) {
      for (let i = 0; i < opts.length; i++) {
        const tx = norm(opts[i].textContent + " " + opts[i].value);
        if (tx.indexOf(n) !== -1) { bestIdx = i; break; }
      }
    }
    if (bestIdx === -1 && /immediate|0/.test(target)) {
      for (let i = 0; i < opts.length; i++) if (/immediate|^0$/.test(norm(opts[i].textContent + " " + opts[i].value))) { bestIdx = i; break; }
    }
  }
  // Boolean fallback: map yes/no-ish profile values onto "Yes ..." / "No ..." options.
  if (bestIdx === -1 && (isYes(value) || isNo(value))) {
    const want = isYes(value) ? /^y(es)?\b/ : /^no?\b/;
    for (let i = 0; i < opts.length && bestIdx === -1; i++) {
      if (want.test(norm(opts[i].textContent))) bestIdx = i;
    }
  }
  if (bestIdx !== -1) {
    commitSelect(el, bestIdx);
    return true;
  }
  return false;
}

function isSearchField(el, sig) {
  const t = (el.type || "").toLowerCase();
  if (t === "search") return true;
  const role = (el.getAttribute("role") || "").toLowerCase();
  if (role === "searchbox" || role === "search") return true;
  if (el.closest('[role="search"], form[role="search"], form.search, .search-form, [class*="searchbox"], [class*="search-bar"], [class*="search-box"]')) return true;
  const hay = ((sig && sig.text) || "") + " " + ((sig && sig.attr) || "");
  const low = hay.toLowerCase();
  if (/search/.test(low) && !/research/.test(low)) return true;
  return false;
}

function isFillable(el) {
  if (el.disabled || el.readOnly) return false;
  const t = (el.type || "").toLowerCase();
  if (["hidden", "submit", "button", "file", "password", "reset", "image"].indexOf(t) !== -1) return false;
  return true;
}

function customScore(sig, cf) {
  const normText = AutoApplyMatcher.normalize(sig.text);
  const normAttr = AutoApplyMatcher.normalize(sig.attr).replace(/ /g, "");
  const raw = cf.match || cf.label || "";
  const kws = raw.split(",").map(function (s) { return AutoApplyMatcher.normalize(s); }).filter(Boolean);
  let score = 0;
  kws.forEach(function (kw) {
    if (kw.length < 3) return;
    const kwAttr = kw.replace(/ /g, "");
    if (normText === kw || (kwAttr && normAttr === kwAttr)) score = Math.max(score, 0.95);
    else if (kw.length >= 4 && normText.indexOf(kw) !== -1) score = Math.max(score, 0.8);
    else if (kwAttr.length >= 5 && normAttr.indexOf(kwAttr) !== -1) score = Math.max(score, 0.78);
  });
  return score;
}

function resolveValue(sig, flat, customFields) {
  const m = AutoApplyMatcher.match(sig);
  let best = { value: m.key ? flat[m.key] : undefined, score: m.key ? m.score : 0 };
  customFields.forEach(function (cf) {
    if (cf.value === undefined || cf.value === null || cf.value === "") return;
    const s = customScore(sig, cf);
    if (s > best.score) best = { value: cf.value, score: s };
  });
  return best;
}

function collectControls() {
  const acc = [];
  function walk(root) {
    let list;
    try { list = root.querySelectorAll("input, textarea, select"); } catch (e) { list = []; }
    for (let i = 0; i < list.length; i++) acc.push(list[i]);
    let all;
    try { all = root.querySelectorAll("*"); } catch (e) { all = []; }
    for (let i = 0; i < all.length; i++) { if (all[i].shadowRoot) walk(all[i].shadowRoot); }
  }
  walk(document);
  return acc;
}

function valTokens(v) {
  return norm(v).split(/[,/|]+|\band\b/).map(function (s) { return s.trim(); }).filter(Boolean);
}

function isYes(v) { return /^(yes|y|true|1)$/.test(norm(v)); }
function isNo(v) { return /^(no|n|false|0)$/.test(norm(v)); }

function questionText(el) {
  const parts = [];
  const fs = el.closest("fieldset");
  if (fs) { const lg = fs.querySelector("legend"); if (lg) parts.push(lg.textContent); }
  const grp = el.closest('[role="radiogroup"], [role="group"]');
  if (grp && grp.getAttribute("aria-label")) parts.push(grp.getAttribute("aria-label"));
  let node = el;
  for (let depth = 0; depth < 4 && node; depth++) {
    let sib = node.previousElementSibling;
    while (sib) {
      if (/^(LABEL|LEGEND|H1|H2|H3|H4|H5|P|SPAN|DIV|STRONG|B)$/.test(sib.tagName)) {
        const txt = (sib.innerText || sib.textContent || "").trim();
        if (txt && txt.length <= 200) { parts.push(txt); break; }
      }
      sib = sib.previousElementSibling;
    }
    if (parts.join("").trim()) break;
    node = node.parentElement;
  }
  parts.push(el.name || "");
  return parts.join(" ");
}

// Set `checked` through the native property setter so framework-controlled
// inputs (React/Vue/Angular) register the change.
function setNativeChecked(el, checked) {
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked");
  if (desc && desc.set) desc.set.call(el, checked);
  else el.checked = checked;
}

function checkEl(el) {
  // Prefer a real click: it toggles the control natively and fires the full
  // event sequence (pointer, click, input, change) custom widgets rely on.
  if (!el.checked) { try { el.click(); } catch (e) { /* ignore */ } }
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
function optionLabel(el) {
  const root = (el.getRootNode && el.getRootNode()) || document;
  const scope = root && root.querySelector ? root : document;
  const parts = [];
  if (el.id) {
    try { const lbl = scope.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (lbl) parts.push(aaText(lbl)); } catch (e) { /* ignore */ }
  }
  const wrap = el.closest("label");
  if (wrap) parts.push(aaText(wrap));
  if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
  if (!parts.join("").trim()) {
    const sib = el.nextElementSibling;
    if (sib && /^(LABEL|SPAN|DIV|P|B|STRONG)$/.test(sib.tagName)) {
      const t = aaText(sib);
      if (t && t.length <= 120) parts.push(t);
    }
  }
  if (!parts.join("").trim() && el.value && el.value !== "on") parts.push(el.value);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
