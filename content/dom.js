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
  let digits = v.replace(/[^0-9]/g, "");
  const ph = el.placeholder || "";
  const ccSelect = findCountryCodeSelect(el);
  const maxlen = parseInt(el.getAttribute("maxlength") || "0", 10);
  const wantsCC = /country code|with code|include code|\+/.test((((sig && sig.text) || "") + " " + ph).toLowerCase());
  // Local masks like Bubble "03XXXXXXXXX" — keep leading 0, drop +92 country code.
  if (/^0[\dXx]/.test(ph)) {
    if (digits.length >= 12 && digits.slice(0, 2) === "92") digits = "0" + digits.slice(2);
    else if (digits.length === 10 && digits.charAt(0) === "3") digits = "0" + digits;
    else if (digits.length > 11) digits = digits.slice(-11);
    return digits;
  }
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

// ponytail: fixed PKR/USD; include currency in profile value or set salaryCurrency
var AA_PKR_USD = 280;

function aaParseSalary(value, profileCurrency) {
  const raw = String(value || "");
  const low = norm(raw);
  let currency = profileCurrency ? norm(profileCurrency).toUpperCase().replace(/[^A-Z]/g, "") : "";
  if (currency === "RS") currency = "PKR";
  if (/\busd\b|\$|dollar/.test(low)) currency = "USD";
  else if (/\bpkr\b|₨|rupee|\brs\b/.test(low)) currency = "PKR";
  let period = null;
  if (/month|\/mo\b|per month|monthly/.test(low)) period = "month";
  else if (/year|annual|annum|\/yr|per year|yearly|\bctc\b/.test(low)) period = "year";
  const amount = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return { amount: isNaN(amount) ? null : amount, currency: currency || null, period: period };
}

function aaSalaryFieldWant(sig, el) {
  const hay = norm(((sig && sig.text) || "") + " " + ((sig && sig.attr) || "") + " " + ((el && el.placeholder) || ""));
  let currency = null;
  if (/\busd\b|\$|dollar/.test(hay)) currency = "USD";
  else if (/\bpkr\b|₨|rupee|\brs\b/.test(hay)) currency = "PKR";
  let period = null;
  if (/month|monthly|per month/.test(hay)) period = "month";
  else if (/year|annual|annum|per year|yearly|\bctc\b/.test(hay)) period = "year";
  return { currency: currency, period: period };
}

function aaConvertSalary(amount, from, to) {
  if (!from || !to || from === to) return amount;
  if (from === "PKR" && to === "USD") return amount / AA_PKR_USD;
  if (from === "USD" && to === "PKR") return amount * AA_PKR_USD;
  return amount;
}

function aaGuessSalaryCurrency(amount, wantCur) {
  if (!amount || !wantCur) return null;
  if (wantCur === "USD" && amount >= 50000) return "PKR";
  if (wantCur === "PKR" && amount > 0 && amount <= 500) return "USD";
  return null;
}

function normalizeCurrency(el, sig, value) {
  const meta = aaParseSalary(value, sig && sig.salaryCurrency);
  let n = meta.amount;
  if (n === null) return String(value).replace(/[^0-9.]/g, "") || value;
  const want = aaSalaryFieldWant(sig, el);
  let cur = meta.currency || aaGuessSalaryCurrency(n, want.currency);
  if (!meta.period && n >= 500000 && (!cur || cur === "PKR")) {
    n = n / 12;
    meta.period = "month";
  }
  if (want.period && meta.period && want.period !== meta.period) {
    if (meta.period === "year" && want.period === "month") n = n / 12;
    else if (meta.period === "month" && want.period === "year") n = n * 12;
  }
  if (want.currency && cur) n = aaConvertSalary(n, cur, want.currency);
  n = Math.round(n);
  const t = (el.type || "").toLowerCase();
  if (t === "number" || t === "range") return String(n);
  const hay = norm((el.placeholder || "") + " " + ((sig && sig.attr) || ""));
  if (/amount|number|\bnum\b|digits/.test(hay)) return String(n);
  return String(n);
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
    if (lbl && !lbl.contains(el) && container.querySelectorAll("input,select,textarea").length <= 1 && (!lbl.htmlFor || lbl.htmlFor === el.id)) {
      const t = aaText(lbl);
      if (t && t.length <= 140) return t;
    }
    let sib = node.previousElementSibling;
    while (sib) {
      if (sib.tagName !== "INPUT" && sib.tagName !== "SELECT" && sib.tagName !== "TEXTAREA" &&
          !sib.querySelector("input,select,textarea") && (!sib.htmlFor || sib.htmlFor === el.id)) {
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
  // Skip format-mask placeholders (e.g. Bubble "03XXXXXXXXX") — they are not field identity.
  // Real label text comes from nearestLabel / aria / for= instead.
  if (el.placeholder && !/^[\dXx\s\-()+.]+$/.test(el.placeholder)) parts.push(el.placeholder);
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
  try {
    const propEl = el.closest && el.closest("[cx-prop-label]");
    if (propEl) { const pl = propEl.getAttribute("cx-prop-label"); if (pl) parts.push(pl); }
  } catch (e) { /* ignore */ }
  // Always prefer a nearby visible label (sibling "Phone Number*" in Bubble, Zoho rows, etc.).
  const near = parts.join("").trim() ? "" : nearestLabel(el);
  if (near) parts.unshift(near);
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
      else if (/(label|field|qa|prop-name|propname|automationid|automation-id|testid|test-id|componentkey)/.test(an)) vals.push(av);
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
  // Bubble.io (and similar) listen for InputEvent, not plain Event("input").
  try {
    el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: el.value }));
  } catch (e) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
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
  else { try { el.focus(); } catch (e) { /* ignore */ } setNativeValue(el, v); fireEvents(el); }
  return true;
}

// Commit a <select> choice through the native value setter so framework
// (React/Vue/Angular) controlled selects register the change, then fire the
// events they listen to.
function commitSelect(el, idx) {
  const desc = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
  if (desc && desc.set) desc.set.call(el, el.options[idx].value);
  el.selectedIndex = idx;
  try { el.focus(); } catch (e) { /* ignore */ }
  try {
    el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertReplacementText" }));
  } catch (e) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillSelect(el, value) {
  let rawValue = String(value || "");
  const sigText = norm(getLabelText(el) + " " + getAttrText(el));
  // Day dropdowns use bare numbers (0/7/14/30) — strip "days", don't append them.
  const isNotice = /notice|how soon can you join/.test(sigText);
  if (isNotice) rawValue = rawValue.replace(/\s*days?$/i, "").trim();
  const target = norm(rawValue);
  if (!target) return false;
  const opts = el.options;
  // Notice: exact digit match first (profile "30 days" → option "30").
  if (isNotice) {
    const n = (String(value).match(/\d+/) || [""])[0];
    if (n) {
      for (let i = 0; i < opts.length; i++) {
        if (norm(opts[i].textContent) === n || norm(opts[i].value) === n) {
          commitSelect(el, i);
          return true;
        }
      }
    }
  }
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
  // Notice-period fallback: map "immediate" → 0.
  if (bestIdx === -1 && isNotice) {
    if (/immediate|^0$/.test(target)) {
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
  // Compatibility alias: never inspect broad ancestor substrings.
  return !!aaControlSkipReason(el, {allowFiles:true, actions:true});
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
  if (grp) {
    if (grp.getAttribute("aria-label")) parts.push(grp.getAttribute("aria-label"));
    const labelledby = grp.getAttribute("aria-labelledby");
    if (labelledby) {
      labelledby.split(/\s+/).forEach(function (id) {
        if (!id) return;
        let n = null;
        try { n = document.getElementById(id); } catch (e) { /* ignore */ }
        if (n) {
          const t = (n.innerText || n.textContent || "").trim();
          if (t) parts.push(t);
        }
      });
    }
  }
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

// ---- Shared eligibility policy --------------------------------------
// All fill surfaces use aaEligibleControls; file/action modes are explicit.
function aaTokens(str) {
  return String(str || '').replace(/['\u2019]/g, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
function aaOwnTokens(el) {
  return aaTokens(['id', 'name', 'class', 'data-testid', 'data-qa', 'data-test', 'role']
    .map(function (a) { return el.getAttribute(a) || ''; }).join(' '));
}
var AA_SEARCHY = ['search','searchbox','searchbar','query','keyword','keywords','filter','filters','facet','facets','refine','sortby'];
var AA_WIDGET_NEG = AA_SEARCHY.concat(['newsletter','subscribe','subscription','login','signin','checkout','payment','comment','comments','footer']);
var AA_HONEYPOT = /honeypot|(?:^|[\s_-])(?:hp|trap)(?:$|[\s_-])|leave.?blank|do.?not.?fill|bot.?field|nospam|ohnohoney/i;
var AA_ROOT_CACHE = new WeakMap();
var AA_CUSTOM_SELECTOR = '[role="combobox"],[aria-haspopup="listbox"],[aria-haspopup="menu"],[aria-haspopup="true"],[role="radio"]';
function aaParent(el) { return el.parentElement || (el.getRootNode && el.getRootNode().host) || null; }
function aaAncestorsSafe(el) {
  for (var n = el; n; n = aaParent(n)) {
    if (n.hidden || n.inert || n.getAttribute('aria-hidden') === 'true') return false;
    var s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || Number(s.opacity) === 0) return false;
  }
  return true;
}
function aaReallyVisible(el) {
  if (!el || !el.isConnected || !aaAncestorsSafe(el)) return false;
  var r = el.getBoundingClientRect();
  return r.width >= 2 && r.height >= 2 && r.right >= 0 && r.bottom >= 0 && r.left <= innerWidth + 5000;
}
function aaVisibleCheckProxy(el) {
  if (!/^(radio|checkbox)$/.test(el.type || '')) return false;
  // Native choices may be transparent, but not inside a hidden/inert subtree.
  if (!aaAncestorsSafe(aaParent(el) || el)) return false;
  if (el.hidden || el.inert || el.getAttribute('aria-hidden') === 'true') return false;
  var labels = el.labels ? Array.from(el.labels) : [];
  return labels.some(aaReallyVisible);
}
function aaControlSkipReason(el, opts) {
  opts = opts || {};
  if (el.closest('[id^="aa-"],.aa-panel,.aa-lasso-overlay')) return 'extension-ui';
  if (el.disabled || el.readOnly || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-readonly') === 'true') return 'disabled/readonly';
  var t = (el.type || '').toLowerCase(), role = (el.getAttribute('role') || '').toLowerCase();
  if (['search','password','hidden','submit','reset','image','range','color'].indexOf(t) !== -1) return 'type:' + t;
  if (t === 'file' && !opts.allowFiles) return 'type:file';
  if (t === 'button' && !opts.actions && !el.matches(AA_CUSTOM_SELECTOR)) return 'type:button';
  if (role === 'searchbox' || role === 'search') return 'role:search';
  if ([el.getAttribute('enterkeyhint'), el.getAttribute('inputmode')].some(function (s) { return (s || '').toLowerCase() === 'search'; })) return 'search-hint';
  var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (/(^|\s)(cc-[^\s]*|current-password|new-password|one-time-code)(\s|$)/.test(ac)) return 'sensitive-autocomplete';
  if (AA_HONEYPOT.test([el.name,el.id,el.getAttribute('class')].join(' '))) return 'honeypot-name';
  if (!aaReallyVisible(el) && !aaVisibleCheckProxy(el)) return 'invisible';
  if (aaOwnTokens(el).some(function (k) { return AA_SEARCHY.indexOf(k) !== -1; })) return 'own-token:search/filter';
  if (/^(q|s|kw|term|terms)$/i.test(el.name || '') || /^(q|s)$/i.test(el.id || '')) return 'short-search-name';
  var label = String(getLabelText(el) || '').toLowerCase();
  if (/^\s*(search|find|filter|sort)\b|\bsearch (for|by|jobs|results|keyword)|\bfilter by\b/.test(label)) return 'label:search';
  if (/\b(newsletter|subscribe|subscription|sign in|log in|name on card|cardholder|credit card|payment|leave a comment|post a comment)\b/.test(label)) return 'label:non-application';
  // Only contact/identity fields for other people, not e.g. "Are you a manager?".
  if (/\b(referral|referee|reference|supervisor|manager|spouse|parent|guardian|emergency|recommender|friend|colleague)(?:['’]s)?\b/.test(label)
      && /\b(name|email|phone|contact|address|number)\b/.test(label)) return 'other-person';
  return null;
}
function aaCountVisible(root) {
  return collectControls(root).filter(function (c) {
    return !/^(hidden|submit|button|reset|image|checkbox|radio|password|file)$/.test(c.type || '') && aaReallyVisible(c);
  }).length;
}
function aaNearestRoot(el) {
  if (el.form) return { node: el.form, isForm: true };
  for (var n = aaParent(el), d = 0; n && n !== document.body && d < 8; n = aaParent(n), d++) {
    if (n.tagName === 'FORM') return { node: n, isForm: true };
    if (/^(HEADER|NAV|FOOTER)$/.test(n.tagName) || /^(banner|navigation|contentinfo|search)$/i.test(n.getAttribute('role') || '')) break;
    if (aaCountVisible(n) >= 3 || aaOwnTokens(n).some(function (k) { return ['apply','application','candidate','applicant','resume'].indexOf(k) !== -1; })) return { node: n, isForm: false };
  }
  return null;
}
function aaScoreRoot(root) {
  if (AA_ROOT_CACHE.has(root)) return AA_ROOT_CACHE.get(root);
  var score = 0, why = [], own = aaOwnTokens(root);
  function add(n, reason) { score += n; why.push(reason); }
  if ((root.getAttribute('role') || '').toLowerCase() === 'search') add(-99, 'role=search');
  if (root.tagName === 'FORM' && (root.getAttribute('method') || 'get').toLowerCase() === 'get' && /search|find|results|query|\?q=|jobs\b/i.test(root.getAttribute('action') || '')) add(-3, 'GET search action');
  // Clearly named unrelated widgets are hard exclusions, not offset by file/identity points.
  own.forEach(function (k) { if (AA_WIDGET_NEG.indexOf(k) !== -1) add(-99, 'token:' + k); });
  var all = collectControls(root), ctrls = all.filter(function (c) { return !aaControlSkipReason(c, {allowFiles:true}); });
  var btn = Array.from(root.querySelectorAll('button,[type="submit"],[role="button"]')).filter(aaReallyVisible)
    .map(function (b) { return (b.textContent || b.value || b.getAttribute('aria-label') || '').trim().toLowerCase(); });
  var apply = own.some(function (k) { return ['apply','application','candidate','applicant','resume'].indexOf(k) !== -1; });
  if (btn.some(function (b) { return /^(submit application|apply(?: now| for .+)?|next|continue|send application|save and continue)$/.test(b); })) { add(1, 'apply button'); apply = true; }
  if (apply) add(1, 'application signal');
  if (ctrls.length === 1 && !apply) add(-3, 'single-field');
  if (all.some(function (c) { return c.type === 'password' && aaReallyVisible(c); }) && all.length <= 4) add(-99, 'login-shaped');
  if (btn.some(function (b) { return /^(search|go|find|subscribe|sign up for.*|join|apply filters?|update results|filter|sign in|log in|pay.*|checkout)$/.test(b); })) add(-99, 'non-application button');
  var id = ctrls.filter(function (c) { var m = AutoApplyMatcher.match({text:getLabelText(c),attr:getAttrText(c)}); return m.key && /^(personal|address|links)\./.test(m.key) && m.score >= 0.85; }).length;
  if (id >= 2) add(2, 'identity fields x' + id);
  if (ctrls.some(function (c) { return c.type === 'file'; })) add(2, 'visible file upload');
  var res = {score:score,why:why}; AA_ROOT_CACHE.set(root,res); return res;
}
function aaOrphanBlocked(el, stopRoot) {
  for (var n = aaParent(el), d = 0; n && n !== document.body && d < 8; n = aaParent(n), d++) {
    if (n === stopRoot) break;
    if (/^(HEADER|NAV|FOOTER)$/.test(n.tagName) || /^(banner|navigation|contentinfo|search)$/i.test(n.getAttribute('role') || '')) return 'site-chrome';
    if (aaCountVisible(n) > 6) break;
    if (aaOwnTokens(n).some(function (k) { return AA_WIDGET_NEG.indexOf(k) !== -1; })) return 'widget-token';
  }
  return null;
}
function aaEligibleControls(opts) {
  opts = opts || {}; AA_ROOT_CACHE = new WeakMap();
  var controls = [], skipped = [];
  var candidates = opts.controls || collectControls(document, true);
  candidates.forEach(function (el) {
    var why = aaControlSkipReason(el, opts);
    var root = !why && aaNearestRoot(el);
    if (!why && root) { var s = aaScoreRoot(root.node); if (s.score < 0) why = (root.isForm ? 'form:' : 'group:') + s.why.join('+'); }
    if (!why) why = aaOrphanBlocked(el, root && root.node);
    // Unscoped rich editors/actions must never become comment/chat targets.
    if (!why && !root && (el.isContentEditable || opts.actions || el.type === 'file' || el.matches(AA_CUSTOM_SELECTOR))) why = 'unscoped-widget';
    if (why) { skipped.push({el:el,reason:why}); return; }
    if (opts.box) { var r=el.getBoundingClientRect(),b=opts.box; if (r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom) return; }
    controls.push(el);
  });
  return {controls:controls,skipped:skipped};
}
function aaIsEligible(el, opts) { return !!el && aaEligibleControls(Object.assign({}, opts, {controls:[el]})).controls.length === 1; }
function aaCanSafeClick(el) {
  if (!el || !aaReallyVisible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
  var tag=el.tagName, type=(el.type || '').toLowerCase();
  if (type === 'submit' || type === 'image') return false;
  var ownerButton = el.closest('button');
  if (ownerButton && (ownerButton.getAttribute('type') || '').toLowerCase() !== 'button') return false;
  if (el.closest('input[type="submit"],input[type="image"]')) return false;
  // Refuse default/invalid button types even outside forms (SPA handlers).
  if (tag === 'BUTTON' && (el.getAttribute('type') || '').toLowerCase() !== 'button') return false;
  // No links, including javascript: links; click options only on controls.
  if (el.closest('a[href]')) return false;
  return true;
}
function aaSafeClick(el) { if (!aaCanSafeClick(el)) return false; return aaWithSubmitGuard(function () { el.click(); return true; }); }
var AA_SUBMIT_GUARDS = 0, AA_SUBMIT_BLOCK = function (e) { e.preventDefault(); e.stopImmediatePropagation(); };
function aaWithSubmitGuard(fn) {
  if (AA_SUBMIT_GUARDS++ === 0) document.addEventListener('submit', AA_SUBMIT_BLOCK, true);
  function done() { setTimeout(function () { if (--AA_SUBMIT_GUARDS === 0) document.removeEventListener('submit', AA_SUBMIT_BLOCK, true); }, 1500); }
  try { var r=fn(); if (r && typeof r.then === 'function') return Promise.resolve(r).finally(done); done(); return r; }
  catch (e) { done(); throw e; }
}
