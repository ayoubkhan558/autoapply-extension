// AutoApply content script: detect and fill form fields.
(function () {
  if (window.__autoApplyContentLoaded) return;
  window.__autoApplyContentLoaded = true;
  const STORAGE_KEY = "autoapplyData";
  const HL_CLASS = "autoapply-filled";

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
    el.checked = true;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    markFilled(el, score);
    return true;
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
    ["personal", "links", "professional"].forEach(function (sec) {
      const obj = profile[sec];
      if (obj && typeof obj === "object") {
        for (const k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) put(sec + "." + k, obj[k]); }
      }
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
    if (!flat["professional.currentCompany"] && flat["experience.company"]) flat["professional.currentCompany"] = flat["experience.company"];
    if (!flat["professional.currentTitle"] && flat["experience.title"]) flat["professional.currentTitle"] = flat["experience.title"];
    return flat;
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
    return vals.join(" ");
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) { desc.set.call(el, value); }
    else { el.value = value; }
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
    setNativeValue(el, v);
    fireEvents(el);
    return true;
  }

  function fillSelect(el, value) {
    const target = norm(value);
    if (!target) return false;
    const opts = el.options;
    for (let i = 0; i < opts.length; i++) {
      if (norm(opts[i].textContent) === target || norm(opts[i].value) === target) {
        el.selectedIndex = i;
        el.dispatchEvent(new Event("change", { bubbles: true }));
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
    if (bestIdx !== -1) {
      el.selectedIndex = bestIdx;
      el.dispatchEvent(new Event("change", { bubbles: true }));
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

  function checkEl(el) {
    el.checked = true;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.classList.add(HL_CLASS);
  }

  function fillForms(controls, flat, customFields) {
    let filled = 0;
    controls.forEach(function (el) {
      const t = (el.type || "").toLowerCase();
      if (t === "radio" || t === "checkbox") return;
      if (!isFillable(el)) return;
      if (el.tagName !== "SELECT" && el.value && el.value.trim()) return;
      const sig = { text: getLabelText(el), attr: getAttrText(el) };
      if (isSearchField(el, sig)) return;
      const best = resolveValue(sig, flat, customFields);
      if (best.score < 0.6) return;
      const value = best.value;
      if (value === undefined || value === null || value === "") return;
      let ok = false;
      if (el.tagName === "SELECT") { ok = fillSelect(el, value); }
      else { ok = fillTextLike(el, String(value)); }
      if (ok) {
        filled++;
        el.classList.add(HL_CLASS);
        setTimeout(function () { el.classList.remove(HL_CLASS); }, 3000);
      }
    });
    return filled;
  }

  function fillRadios(controls, flat, customFields) {
    let n = 0;
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
      const tokens = valTokens(best.value);
      let chosen = null;
      group.forEach(function (r) {
        const rl = norm(getLabelText(r) || r.value);
        if (!rl || chosen) return;
        const hit = tokens.some(function (tk) { return tk.length >= 2 && (rl === tk || rl.indexOf(tk) !== -1 || tk.indexOf(rl) !== -1); });
        if (hit) chosen = r;
      });
      if (!chosen && (isYes(best.value) || isNo(best.value))) {
        const want = isYes(best.value) ? /^(yes|y)$/ : /^(no|n)$/;
        group.forEach(function (r) { const rl = norm(getLabelText(r) || r.value); if (!chosen && want.test(rl)) chosen = r; });
      }
      if (chosen) { checkEl(chosen); n++; }
    });
    return n;
  }

  function fillCheckboxes(controls, skillTokens) {
    let n = 0;
    controls.forEach(function (el) {
      if ((el.type || "").toLowerCase() !== "checkbox" || el.disabled || el.checked) return;
      const lbl = norm(getLabelText(el));
      if (!lbl) return;
      if (/agree|terms|privacy|consent|newsletter|subscribe|none of/.test(lbl)) return;
      const hit = skillTokens.some(function (tk) {
        if (tk.length < 2) return false;
        return lbl === tk || lbl.indexOf(tk) !== -1 || tk.indexOf(lbl) !== -1;
      });
      if (hit) { checkEl(el); n++; }
    });
    return n;
  }

  async function attachResume() {
    const inputs = [];
    collectControls().forEach(function (el) { if ((el.type || "").toLowerCase() === "file" && !el.disabled) inputs.push(el); });
    if (!inputs.length) return 0;
    let stored = null;
    try { stored = await aaLoadActiveResume(); } catch (e) { stored = null; }
    if (!stored || !stored.dataUrl) return 0;
    let n = 0;
    for (let i = 0; i < inputs.length; i++) {
      const el = inputs[i];
      const lbl = norm(getLabelText(el) + " " + getAttrText(el));
      const wanted = /resume|cv|curriculum/.test(lbl) || inputs.length === 1;
      if (!wanted) continue;
      try {
        const blob = await (await fetch(stored.dataUrl)).blob();
        const file = new File([blob], stored.name || "resume.pdf", { type: stored.type || blob.type || "application/pdf" });
        const dt = new DataTransfer();
        dt.items.add(file);
        el.files = dt.files;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.classList.add(HL_CLASS);
        n++;
      } catch (e) { /* ignore */ }
    }
    return n;
  }

  // ---- Fill context + planners ----------------------------------------
  async function aaFillContext() {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const data = res && res[STORAGE_KEY];
    if (!data || !data.profiles) return null;
    const profile = data.profiles.find(function (p) { return p.id === data.activeProfileId; }) || data.profiles[0];
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
      const res = await chrome.storage.local.get(STORAGE_KEY);
      const data = res && res[STORAGE_KEY];
      const pid = data && data.activeProfileId;
      return await aaGetResume(pid);
    } catch (e) { return null; }
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
      if (!isFillable(el)) return;
      if (el.tagName !== "SELECT" && el.value && el.value.trim()) return;
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
      const rl = norm(getLabelText(r) || r.value);
      if (!rl || chosen) return;
      const hit = tokens.some(function (tk) { return tk.length >= 2 && (rl === tk || rl.indexOf(tk) !== -1 || tk.indexOf(rl) !== -1); });
      if (hit) chosen = r;
    });
    if (!chosen && (isYes(value) || isNo(value))) {
      const want = isYes(value) ? /^(yes|y)$/ : /^(no|n)$/;
      group.forEach(function (r) { const rl = norm(getLabelText(r) || r.value); if (!chosen && want.test(rl)) chosen = r; });
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
      if (chosen) out.push({ kind: "radio", el: chosen, label: displayLabel(sig, chosen), value: (getLabelText(chosen) || chosen.value || "Selected"), score: best.score, editable: false });
    });
    return out;
  }

  function planCheckboxes(controls, skillTokens) {
    const out = [];
    controls.forEach(function (el) {
      if ((el.type || "").toLowerCase() !== "checkbox" || el.disabled || el.checked) return;
      const lbl = norm(getLabelText(el));
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
      if (/resume|cv|curriculum/.test(lbl) || inputs.length === 1) { target = el; break; }
    }
    if (!target) return null;
    return { kind: "resume", el: target, label: "Attach CV: " + (stored.name || "resume"), value: (stored.name || "resume"), score: 0.9, editable: false, stored: stored };
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
    return t.replace(/\s+/g, " ").trim();
  }

  async function fillCustomSelects(ctx, box, filledEls) {
    let filled = 0;
    const triggers = [];
    let nodes;
    try { nodes = document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"], [aria-haspopup="true"]'); } catch (e) { nodes = []; }
    nodes.forEach(function (el) {
      const tag = el.tagName;
      if (tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA") return;
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
        try { optionNodes = document.querySelectorAll('[role="option"], li[role="option"], [role="menuitem"], [class*="option"]'); } catch (e) { optionNodes = []; }
        let picked = null;
        let exact = null;
        optionNodes.forEach(function (o) {
          if (exact || aaIsHidden(o)) return;
          const ot = norm(o.textContent);
          if (!ot || ot.length > 60) return;
          if (ot === want) exact = o;
          else if (!picked && want.length >= 2 && (ot.indexOf(want) !== -1 || want.indexOf(ot) !== -1)) picked = o;
        });
        const choose = exact || picked;
        if (choose) {
          choose.click();
          markFilled(trg, best.score);
          filled++;
          if (filledEls) filledEls.push(trg);
          await sleep(90);
        } else {
          trg.click();
          await sleep(60);
        }
      } catch (e) { /* ignore */ }
    }
    return filled;
  }

  async function run() {
    const ctx = await aaFillContext();
    if (!ctx) return { filled: 0, error: "no-profile" };
    const controls = collectControls();
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
    const resume = await planResume();
    if (resume) { try { if (await applyResume(resume)) filled++; } catch (e) { /* ignore */ } }
    try { aaShowFillResult(filled, aaUnfilledFields(controls, true)); } catch (e) { /* ignore */ }
    if (filled > 0) { try { aaRecordFill(aaTopHost(), filled); } catch (e) { /* ignore */ } }
    return { filled: filled };
  }

  // ---- Job fit analysis ------------------------------------------------
  function aaEl(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function aaRemovePanel() {
    const old = document.getElementById("autoapply-panel");
    if (old) old.remove();
  }

  function aaShowPanel(title) {
    aaRemovePanel();
    const panel = aaEl("div");
    panel.id = "autoapply-panel";
    const head = aaEl("div", "aa-head");
    head.appendChild(aaEl("span", "aa-head-title", "AutoApply \u2022 " + (title || "Job fit")));
    const close = aaEl("button", "aa-close", "\u00d7");
    close.addEventListener("click", aaRemovePanel);
    head.appendChild(close);
    panel.appendChild(head);
    const body = aaEl("div", "aa-body");
    body.id = "autoapply-panel-body";
    panel.appendChild(body);
    document.documentElement.appendChild(panel);
    return body;
  }

  function aaEffortScore() {
    const els = document.querySelectorAll("input, select, textarea");
    let count = 0;
    let files = 0;
    els.forEach(function (el) {
      const t = (el.type || "").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].indexOf(t) !== -1) return;
      if (t === "file") { files++; return; }
      if (el.disabled) return;
      count++;
    });
    // Estimate hands-on minutes assuming AutoApply fills most fields for you.
    let level, minutes;
    if (count <= 3 && files === 0) { level = "instant"; minutes = 1; }
    else if (count <= 7) { level = "easy"; minutes = 2; }
    else if (count <= 13) { level = "medium"; minutes = 4; }
    else if (count <= 22) { level = "long"; minutes = 7; }
    else { level = "very_long"; minutes = 12; }
    if (files >= 2) minutes += 2;
    return { level: level, minutes: minutes, count: count, files: files };
  }

  // ---- Inline-SVG icons (replace emojis in on-page panels) ------------
  const AA_ICONS = {
    check: '<svg class="aa-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    warn: '<svg class="aa-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    pen: '<svg class="aa-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
    money: '<svg class="aa-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>'
  };
  // Build a small inline-SVG icon element (themable via currentColor).
  function aaIcon(name) {
    const span = document.createElement("span");
    span.className = "aa-ico-wrap";
    span.innerHTML = AA_ICONS[name] || "";
    return span;
  }
  // Build a colored status dot as inline SVG (used for effort levels).
  function aaDot(color) {
    const span = document.createElement("span");
    span.className = "aa-ico-wrap";
    span.innerHTML = '<svg class="aa-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="' + color + '"></circle></svg>';
    return span;
  }
  // Section heading with a leading inline-SVG icon.
  function aaSectionTitle(iconName, text) {
    const d = aaEl("div", "aa-section-title");
    d.appendChild(aaIcon(iconName));
    d.appendChild(document.createTextNode(text));
    return d;
  }

  function aaRenderEffort(body, effort) {
    const map = {
      instant: { color: "#16a34a", label: "Instant Apply" },
      easy: { color: "#16a34a", label: "Easy Apply" },
      medium: { color: "#eab308", label: "Medium" },
      long: { color: "#f97316", label: "Long Application" },
      very_long: { color: "#dc2626", label: "Very Long" }
    };
    const m = map[effort.level] || map.medium;
    const box = aaEl("div", "aa-effort");
    const dotWrap = aaEl("span", "aa-effort-dot");
    dotWrap.appendChild(aaDot(m.color));
    box.appendChild(dotWrap);
    const txt = aaEl("div");
    txt.appendChild(aaEl("div", "aa-effort-label", m.label + " (~" + effort.minutes + " min)"));
    txt.appendChild(aaEl("div", "aa-effort-sub", effort.count + " fields" + (effort.files ? ", " + effort.files + " upload(s)" : "")));
    box.appendChild(txt);
    body.appendChild(box);
  }

  let aaLoadingTimer = null;

  function aaRenderLoading(body, customSteps) {
    const wrap = aaEl("div", "aa-loading");
    wrap.id = "aa-loading";
    wrap.appendChild(aaEl("div", "aa-spinner"));
    // Callers may pass their own rotating status messages; default to the
    // job-analysis sequence.
    const steps = (customSteps && customSteps.length) ? customSteps : ["Reading the job posting\u2026", "Comparing with your profile\u2026", "Scoring your fit\u2026", "Estimating salary\u2026", "Almost there\u2026"];
    const msg = aaEl("div", "aa-loading-msg", steps[0]);
    msg.id = "aa-loading-msg";
    wrap.appendChild(msg);
    body.appendChild(wrap);
    let i = 0;
    aaLoadingTimer = setInterval(function () {
      i = (i + 1) % steps.length;
      const m = document.getElementById("aa-loading-msg");
      if (m) m.textContent = steps[i];
    }, 1600);
  }

  function aaStopLoading() {
    if (aaLoadingTimer) { clearInterval(aaLoadingTimer); aaLoadingTimer = null; }
    const l = document.getElementById("aa-loading");
    if (l) l.remove();
  }

  function aaRenderError(body, msg) {
    aaStopLoading();
    body.appendChild(aaEl("div", "aa-error", msg));
  }

  function aaScoreColor(score) {
    if (score >= 75) return "#059669";
    if (score >= 50) return "#d97706";
    return "#dc2626";
  }

  function aaRenderList(body, iconName, title, items, fallback) {
    body.appendChild(aaSectionTitle(iconName, title));
    const list = (items && items.length) ? items : (fallback ? [fallback] : []);
    if (!list.length) { body.appendChild(aaEl("div", "aa-summary", "\u2014")); return; }
    const ul = aaEl("ul", "aa-list");
    list.forEach(function (it) { ul.appendChild(aaEl("li", null, String(it))); });
    body.appendChild(ul);
  }

  function aaRenderAnalysis(body, data) {
    aaStopLoading();
    const score = Math.max(0, Math.min(100, parseInt(data.matchScore, 10) || 0));
    const scoreBox = aaEl("div", "aa-score");
    const num = aaEl("div", "aa-score-num", score + "%");
    num.style.color = aaScoreColor(score);
    scoreBox.appendChild(num);
    scoreBox.appendChild(aaEl("div", "aa-score-label", "Match score"));
    body.appendChild(scoreBox);
    const bar = aaEl("div", "aa-bar");
    const fill = aaEl("div", "aa-bar-fill");
    fill.style.width = score + "%";
    fill.style.background = aaScoreColor(score);
    bar.appendChild(fill);
    body.appendChild(bar);
    if (data.summary) body.appendChild(aaEl("div", "aa-summary", String(data.summary)));
    aaRenderList(body, "warn", "Missing / weak requirements", data.missing, "No major gaps detected for this role.");
    aaRenderList(body, "pen", "Resume tips for this job", data.resumeTips, "No specific resume changes suggested.");
    body.appendChild(aaSectionTitle("money", "Salary intelligence"));
    const sal = data.salary || {};
    const s = aaEl("div", "aa-salary");
    s.appendChild(aaEl("div", "aa-salary-est", sal.estimate ? String(sal.estimate) : "No estimate available."));
    const meta = [];
    if (sal.vsDesired && sal.vsDesired !== "unknown") meta.push("vs your target: " + sal.vsDesired);
    if (sal.basis) meta.push(String(sal.basis));
    if (meta.length) s.appendChild(aaEl("div", "aa-salary-meta", meta.join(" \u2022 ")));
    body.appendChild(s);
    body.appendChild(aaEl("div", "aa-foot", "Estimates by AI \u2014 verify before relying on them."));
  }

  function aaPickJobText() {
    const descSel = "[class*='job-description'],[class*='jobDescription'],[class*='job_description'],[class*='description'],[data-testid*='description'],[id*='job-description'],[id*='description'],[class*='posting'],[class*='vacancy'],[class*='job-details'],[class*='jobDetails']";
    let best = "", bestLen = 0;
    let nodes = [];
    try { nodes = document.querySelectorAll(descSel); } catch (e) { nodes = []; }
    for (let j = 0; j < nodes.length; j++) {
      const txt = (nodes[j].innerText || "").trim();
      if (txt.length > bestLen) { bestLen = txt.length; best = txt; }
    }
    if (bestLen >= 200) return best;
    const main = document.querySelector("main, article, [role=main]");
    if (main && (main.innerText || "").trim().length >= 200) return main.innerText;
    return document.body.innerText || "";
  }

  function aaJobText() {
    return aaPickJobText().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12000);
  }

  async function runAnalysis() {
    const body = aaShowPanel();
    aaRenderEffort(body, aaEffortScore());
    let settings, data;
    try { settings = await aaLoadSettings(); data = await aaLoadData(); }
    catch (e) { aaRenderError(body, "Could not load your profile or settings."); return; }
    const provider = settings.provider;
    const key = settings.keys && settings.keys[provider];
    if (!key) { aaRenderError(body, "Add an AI key in AutoApply Options to analyze jobs."); return; }
    const profile = aaGetActiveProfile(data);
    aaRenderLoading(body);
    const payload = { provider: provider, apiKey: key, model: settings.model, jobText: aaJobText(), profile: profile };
    chrome.runtime.sendMessage({ action: "aa-analyze-job", payload: payload }, function (resp) {
      if (chrome.runtime.lastError) { aaRenderError(body, chrome.runtime.lastError.message); return; }
      if (!resp || !resp.ok) { aaRenderError(body, (resp && resp.error) || "Analysis failed."); return; }
      aaRenderAnalysis(body, resp.data);
    });
  }

  // ---- Email + cover-letter generation ----
  // Copy a block of text to the clipboard, flashing the button label as feedback.
  function aaCopyText(btn, text) {
    navigator.clipboard.writeText(text).then(function () {
      const old = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(function () { btn.textContent = old; }, 1400);
    }).catch(function () { btn.textContent = "Copy failed"; });
  }

  // Render one labelled, editable text block with its own Copy button.
  function aaAppBlock(body, label, text) {
    const wrap = aaEl("div", "aa-app-block");
    const head = aaEl("div", "aa-app-head");
    head.appendChild(aaEl("span", "aa-app-label", label));
    const copy = aaEl("button", "aa-app-copy", "Copy");
    copy.addEventListener("click", function () { aaCopyText(copy, ta.value); });
    head.appendChild(copy);
    wrap.appendChild(head);
    const ta = aaEl("textarea", "aa-app-text");
    ta.value = text;
    ta.rows = Math.min(16, Math.max(3, String(text).split("\n").length + 1));
    wrap.appendChild(ta);
    body.appendChild(wrap);
  }

  // Show the generated subject / email / cover letter in the panel.
  function aaRenderApplication(body, data) {
    aaStopLoading();
    data = data || {};
    const meta = [];
    if (data.role) meta.push(String(data.role));
    if (data.company) meta.push(String(data.company));
    if (meta.length) body.appendChild(aaEl("div", "aa-summary", "For: " + meta.join(" \u2022 ")));
    if (data.subject) aaAppBlock(body, "Email subject", String(data.subject));
    if (data.email) aaAppBlock(body, "Application email", String(data.email));
    if (data.coverLetter) aaAppBlock(body, "Cover letter", String(data.coverLetter));
    if (!data.email && !data.coverLetter) { aaRenderError(body, "The AI did not return any text. Please try again."); return; }
    body.appendChild(aaEl("div", "aa-foot", "Drafted by AI from your profile \u2014 review and personalize before sending."));
  }

  // Entry point: gather settings + profile + job text, ask the AI, render result.
  async function runGenerateApplication() {
    const body = aaShowPanel("Email & cover letter");
    let settings, data;
    try { settings = await aaLoadSettings(); data = await aaLoadData(); }
    catch (e) { aaRenderError(body, "Could not load your profile or settings."); return; }
    const provider = settings.provider;
    const key = settings.keys && settings.keys[provider];
    if (!key) { aaRenderError(body, "Add an AI key in AutoApply Options to generate an email and cover letter."); return; }
    const profile = aaGetActiveProfile(data);
    aaRenderLoading(body, ["Reading the job posting\u2026", "Matching your experience\u2026", "Drafting your email\u2026", "Writing your cover letter\u2026", "Polishing the wording\u2026"]);
    const payload = { provider: provider, apiKey: key, model: settings.model, jobText: aaJobText(), profile: profile };
    chrome.runtime.sendMessage({ action: "aa-generate-application", payload: payload }, function (resp) {
      if (chrome.runtime.lastError) { aaRenderError(body, chrome.runtime.lastError.message); return; }
      if (!resp || !resp.ok) { aaRenderError(body, (resp && resp.error) || "Generation failed."); return; }
      aaRenderApplication(body, resp.data);
    });
  }

  function aaIsQuestionField(el) {
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag !== "INPUT") return false;
    const t = (el.type || "text").toLowerCase();
    if (["text", "search", ""].indexOf(t) === -1) return false;
    const sig = norm(getLabelText(el) + " " + getAttrText(el));
    if (isSearchField(el, sig)) return false;
    return /\?|why|describe|tell us|explain|cover letter|motivat|reason|what makes|experience with|how (would|do|did)|strength|weakness|challeng|proud|interest/.test(sig);
  }

  function aaCollectQuestions() {
    const els = document.querySelectorAll("textarea, input");
    const out = [];
    els.forEach(function (el) {
      if (el.disabled || el.readOnly) return;
      if (el.offsetParent === null && (el.type || "").toLowerCase() !== "hidden") return;
      if ((el.value || "").trim()) return;
      if (!aaIsQuestionField(el)) return;
      const q = (getLabelText(el) || el.placeholder || el.name || "").replace(/\s+/g, " ").trim();
      if (!q) return;
      out.push({ el: el, q: q });
    });
    return out;
  }

  async function runAnswerQuestions() {
    const body = aaShowPanel();
    body.appendChild(aaSectionTitle("pen", "AI question autofill"));
    let settings, data;
    try { settings = await aaLoadSettings(); data = await aaLoadData(); }
    catch (e) { aaRenderError(body, "Could not load your profile or settings."); return; }
    const provider = settings.provider;
    const key = settings.keys && settings.keys[provider];
    if (!key) { aaRenderError(body, "Add an AI key in AutoApply Options first."); return; }
    const fields = aaCollectQuestions();
    if (!fields.length) { aaRenderError(body, "No open-ended questions found on this page."); return; }
    aaRenderLoading(body);
    const payload = {
      provider: provider,
      apiKey: key,
      model: settings.model,
      profile: aaGetActiveProfile(data),
      jobText: aaJobText(),
      questions: fields.map(function (f) { return f.q; })
    };
    chrome.runtime.sendMessage({ action: "aa-answer-questions", payload: payload }, function (resp) {
      aaStopLoading();
      if (chrome.runtime.lastError) { aaRenderError(body, chrome.runtime.lastError.message); return; }
      if (!resp || !resp.ok) { aaRenderError(body, (resp && resp.error) || "Could not generate answers."); return; }
      const answers = (resp.data && resp.data.answers) || [];
      let filled = 0;
      fields.forEach(function (f, i) {
        const ans = answers[i];
        if (!ans) return;
        setNativeValue(f.el, String(ans));
        fireEvents(f.el);
        f.el.classList.add(HL_CLASS);
        filled++;
      });
      body.appendChild(aaEl("div", "aa-summary", "Filled " + filled + " of " + fields.length + " question(s). Review before submitting."));
    });
  }

  // ---- Post-fill result modal -----------------------------------------
  function aaFieldLabelOf(el) {
    const t = (getLabelText(el) || el.placeholder || el.name || "").replace(/\s+/g, " ").trim();
    return t.length > 48 ? t.slice(0, 45) + "…" : t;
  }

  function aaRequiredHint(el) {
    if (!el) return false;
    if (el.required || el.getAttribute("aria-required") === "true") return true;
    return /\*|\brequired\b/i.test(getLabelText(el) || "");
  }

  // Collect every field that was NOT filled so the result panel can show it:
  // empty text inputs, unselected dropdowns (native + custom widgets),
  // unanswered required radio groups, and required checkboxes.
  function aaUnfilledFields(controls, includeCustom) {
    const list = controls || collectControls();
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
      if (el.offsetParent === null) return;
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
      if ((el.value || "").trim()) return;
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
        if (el.disabled || aaIsHidden(el)) return;
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

  function aaShowFillResult(filled, unfilled) {
    const body = aaShowPanel("Autofill result");
    const fc = aaEl("div", "aa-fill-count");
    fc.appendChild(aaIcon("check"));
    fc.appendChild(document.createTextNode("Filled " + filled + " field" + (filled === 1 ? "" : "s")));
    body.appendChild(fc);
    if (!unfilled || !unfilled.length) {
      body.appendChild(aaEl("div", "aa-summary", "No empty fields detected. Review and submit when ready."));
      return;
    }
    const reqCount = unfilled.filter(function (u) { return u.required; }).length;
    body.appendChild(aaEl("div", "aa-section-title", unfilled.length + " field(s) still need attention" + (reqCount ? " (" + reqCount + " required)" : "")));
    const wrap = aaEl("div", "aa-left-list");
    unfilled.forEach(function (l) {
      wrap.appendChild(aaEl("span", "aa-left-chip" + (l.required ? " aa-left-chip-req" : ""), l.label + (l.required ? " *" : "")));
    });
    body.appendChild(wrap);
    const btn = aaEl("button", "aa-btn-fix");
    btn.appendChild(aaIcon("pen"));
    btn.appendChild(document.createTextNode("Fix remaining with AI"));
    btn.addEventListener("click", function () { runAnswerQuestions(); });
    body.appendChild(btn);
    body.appendChild(aaEl("div", "aa-foot", "AI answers open-ended questions using your profile. Review before submitting."));
  }

  // ---- Drag-to-select (lasso) fill ------------------------------------
  let aaLassoActive = false;
  function startLasso() {
    if (aaLassoActive) return;
    aaLassoActive = true;
    const overlay = document.createElement("div");
    overlay.id = "aa-lasso-overlay";
    const hint = document.createElement("div");
    hint.id = "aa-lasso-hint";
    hint.textContent = "Drag a box over the fields you want to fill • Esc to cancel";
    const rect = document.createElement("div");
    rect.id = "aa-lasso-rect";
    rect.style.display = "none";
    overlay.appendChild(rect);
    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(hint);
    let sx = 0, sy = 0, dragging = false;
    function cleanup() {
      aaLassoActive = false;
      if (overlay.parentNode) overlay.remove();
      if (hint.parentNode) hint.remove();
      document.removeEventListener("keydown", onKey, true);
    }
    function onKey(e) { if (e.key === "Escape") { e.preventDefault(); cleanup(); } }
    document.addEventListener("keydown", onKey, true);
    overlay.addEventListener("mousedown", function (e) {
      dragging = true; sx = e.clientX; sy = e.clientY;
      rect.style.display = "block";
      rect.style.left = sx + "px"; rect.style.top = sy + "px"; rect.style.width = "0px"; rect.style.height = "0px";
      e.preventDefault();
    });
    overlay.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      const x = Math.min(e.clientX, sx), y = Math.min(e.clientY, sy);
      rect.style.left = x + "px"; rect.style.top = y + "px";
      rect.style.width = Math.abs(e.clientX - sx) + "px"; rect.style.height = Math.abs(e.clientY - sy) + "px";
    });
    overlay.addEventListener("mouseup", function (e) {
      if (!dragging) return;
      dragging = false;
      const box = { left: Math.min(e.clientX, sx), top: Math.min(e.clientY, sy), right: Math.max(e.clientX, sx), bottom: Math.max(e.clientY, sy) };
      cleanup();
      if (box.right - box.left < 6 && box.bottom - box.top < 6) return;
      fillWithinBox(box);
    });
  }

  async function fillWithinBox(box) {
    const ctx = await aaFillContext();
    if (!ctx) { aaShowFillResult(0, []); return; }
    const selected = collectControls().filter(function (el) {
      const t = (el.type || "").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].indexOf(t) !== -1) return false;
      if (el.disabled) return false;
      let r;
      try { r = el.getBoundingClientRect(); } catch (e) { return false; }
      if (r.width === 0 && r.height === 0) return false;
      return !(r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom);
    });
    let filled = 0;
    // Track the exact elements we successfully filled so the "still needs
    // attention" list can report every OTHER selected field accurately,
    // instead of relying on the temporary highlight class or label text.
    const filledEls = [];
    planText(selected, ctx.flat, ctx.customFields).forEach(function (p) { if (applyTextValue(p.el, p.value, p.score)) { filled++; filledEls.push(p.el); } });
    planRadios(selected, ctx.flat, ctx.customFields).forEach(function (p) { if (applyCheck(p.el, p.score)) { filled++; filledEls.push(p.el); } });
    planCheckboxes(selected, ctx.skillTokens).forEach(function (p) { if (applyCheck(p.el, p.score)) { filled++; filledEls.push(p.el); } });
    // Custom (non-native) dropdown widgets inside the box, e.g. React/Workday.
    try { filled += await fillCustomSelects(ctx, box, filledEls); } catch (e) { /* ignore */ }
    // Report empty fields across the WHOLE form (not just the boxed selection),
    // so a partially-completed form is never shown as "ready to submit". The
    // fields we just filled carry the highlight class and are skipped.
    aaShowFillResult(filled, aaUnfilledFields(collectControls(), true));
  }

  // Within a lasso selection, list every chosen field we could NOT fill and
  // that is still empty. Unlike aaUnfilledFields this is scoped strictly to the
  // selected elements, uses the actually-filled set (not the fading highlight),
  // and never silently drops a field just because its label is blank.
  function aaSelectedUnfilled(selected, filledEls, box) {
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
      if ((el.value || "").trim()) return;
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
        if (el.disabled || aaIsHidden(el)) return;
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

  // ---- Form detection (gated by settings) -----------------------------
  function aaCleanHost(s) {
    return String(s || "").trim().toLowerCase()
      .replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").replace(/^\.+/, "");
  }
  function aaHostList(v) {
    let arr = [];
    if (Array.isArray(v)) arr = v;
    else if (typeof v === "string") arr = v.split(/[\s,\n]+/);
    return arr.map(aaCleanHost).filter(Boolean);
  }
  function aaHostAllowed(host, allow, block) {
    host = aaCleanHost(host);
    function hit(list) { return list.some(function (e) { return host === e || host.endsWith("." + e); }); }
    if (block.length && hit(block)) return false;
    if (allow.length) return hit(allow);
    return true;
  }
  function aaDetectionAllowed(settings) {
    const d = (settings && settings.detect) || {};
    if (d.enabled === false) return false;
    return aaHostAllowed(location.hostname, aaHostList(d.allowlist), aaHostList(d.blocklist));
  }
  function aaCountFillable() {
    let count = 0;
    collectControls().forEach(function (el) {
      if (!isFillable(el)) return;
      if (aaIsHidden(el)) return;
      const sig = { text: getLabelText(el), attr: getAttrText(el) };
      if (isSearchField(el, sig)) return;
      count++;
    });
    return count;
  }
  function aaPageHasForm() {
    const count = aaCountFillable();
    const hasFormEl = !!document.querySelector("form");
    return { has: count >= 2 || (count >= 1 && hasFormEl), count: count };
  }
  var aaDetectToastShown = false;
  function aaJobSignal() {
    var hosts = ["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "indeed.com", "myworkdayjobs.com", "smartrecruiters.com", "jobvite.com", "icims.com", "taleo.net", "bamboohr.com", "breezy.hr", "recruitee.com"];
    var h = location.hostname.toLowerCase();
    if (hosts.some(function (e) { return h.indexOf(e) !== -1; })) return true;
    if (/(^|\.)jobs\.|(^|\.)careers\./.test(h)) return true;
    var body = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 4000) : "";
    var hay = ((document.title || "") + " " + location.href + " " + body).toLowerCase();
    return /(apply now|job application|cover letter|work authorization|we['\u2019]re hiring|resume\/cv|curriculum vitae|equal opportunity employer)/.test(hay);
  }
  function aaShowDetectToast(count, isJob, profileName) {
    var old = document.getElementById("aa-detect-toast");
    if (old) old.remove();
    var toast = aaEl("div");
    toast.id = "aa-detect-toast";
    var head = aaEl("div", "aa-detect-toast__head");
    head.appendChild(aaEl("span", "aa-detect-toast__title", "AutoApply"));
    var close = aaEl("button", "aa-detect-toast__close", "\u00d7");
    close.setAttribute("aria-label", "Dismiss");
    close.addEventListener("click", function () { toast.remove(); });
    head.appendChild(close);
    toast.appendChild(head);
    var mins = Math.max(1, Math.round(count * 20 / 60));
    toast.appendChild(aaEl("div", "aa-detect-toast__msg", isJob ? "Job application form detected" : "Form detected"));
    toast.appendChild(aaEl("div", "aa-detect-toast__sub", count + " fillable field" + (count === 1 ? "" : "s") + " \u00b7 ~" + mins + " min to apply manually"));
    // Show which profile AutoApply will fill from, so the user can switch first if needed.
    if (profileName) toast.appendChild(aaEl("div", "aa-detect-toast__profile", "Will fill using: " + profileName));
    var fill = aaEl("button", "aa-detect-toast__btn", isJob ? "\u26a1 Apply now \u2014 fill form" : "\u26a1 Fill form now");
    fill.addEventListener("click", function () { toast.remove(); try { run(); } catch (e) { /* ignore */ } });
    toast.appendChild(fill);
    document.documentElement.appendChild(toast);
    setTimeout(function () {
      if (!toast.parentNode) return;
      toast.classList.add("aa-detect-toast--out");
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 400);
    }, 9000);
  }
  function aaReportDetection() {
    aaLoadSettings().then(function (settings) {
      const allowed = aaDetectionAllowed(settings);
      let count = 0;
      if (allowed) { const r = aaPageHasForm(); count = r.has ? r.count : 0; }
      // Report this frame's count; the background aggregates across all frames for the badge.
      try { chrome.runtime.sendMessage({ action: "aa-form-detected", count: count, allowed: allowed }); } catch (e) { /* ignore */ }
      // Show the in-page toast in whichever frame actually holds the form. Job application
      // forms (Greenhouse, Lever, Ashby, Workday, etc.) are frequently embedded in an iframe.
      if (allowed && count > 0 && !aaDetectToastShown) {
        aaDetectToastShown = true;
        var isJob = aaJobSignal();
        // Resolve the active profile name so the toast can show which profile will be used.
        aaLoadData().then(function (data) {
          var name = "";
          try { var p = aaGetActiveProfile(data); name = (p && (p.label || (p.personal && p.personal.firstName))) || ""; } catch (e) { /* ignore */ }
          try { aaShowDetectToast(count, isJob, name); } catch (e) { /* ignore */ }
        }).catch(function () { try { aaShowDetectToast(count, isJob, ""); } catch (e) { /* ignore */ } });
      }
    }).catch(function () { /* ignore */ });
  }
  // Re-check several times to catch late-rendering (SPA / iframe) forms.
  try { [400, 1200, 2500, 4500, 7000].forEach(function (ms) { setTimeout(aaReportDetection, ms); }); } catch (e) { /* ignore */ }

  function aaTopHost() {
    try { return window.top.location.hostname; } catch (e) { return location.hostname; }
  }

  // ---- Per-field AI fill button ---------------------------------------
  // A small floating button appears next to the focused field so the user can
  // fill just that one field (from their profile, or via AI for open questions).
  function aaIsAiTextField(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return isFillable(el) && !aaIsHidden(el);
    if (tag !== "INPUT") return false;
    const t = (el.type || "text").toLowerCase();
    if (["text", "email", "tel", "url", "number"].indexOf(t) === -1) return false;
    if (!isFillable(el) || aaIsHidden(el)) return false;
    const sig = { text: getLabelText(el), attr: getAttrText(el) };
    if (isSearchField(el, sig)) return false;
    return true;
  }

  var aaAiBtn = null;
  var aaAiField = null;
  var aaAiHideTimer = null;

  function aaPositionAiBtn() {
    if (!aaAiBtn || !aaAiField) return;
    if (!aaAiField.isConnected || aaIsHidden(aaAiField)) { aaHideAiBtn(); return; }
    const r = aaAiField.getBoundingClientRect();
    if (r.width < 40 || r.height < 12) { aaHideAiBtn(); return; }
    const size = 22;
    aaAiBtn.style.top = (r.top + Math.max(2, (r.height - size) / 2)) + "px";
    aaAiBtn.style.left = (r.right - size - 6) + "px";
  }

  function aaShowAiBtn(field) {
    if (!aaAiBtn) return;
    aaAiField = field;
    clearTimeout(aaAiHideTimer);
    aaAiBtn.classList.remove("aa-field-ai--busy");
    aaAiBtn.style.display = "flex";
    aaPositionAiBtn();
  }

  function aaHideAiBtn() {
    if (!aaAiBtn) return;
    aaAiBtn.style.display = "none";
    aaAiField = null;
  }

  function aaAiNote(text, kind) {
    var note = document.getElementById("aa-field-ai-note");
    if (!note) {
      note = aaEl("div");
      note.id = "aa-field-ai-note";
      document.documentElement.appendChild(note);
    }
    note.textContent = text;
    note.className = kind === "error" ? "aa-field-ai-note--error" : "";
    note.style.display = "block";
    clearTimeout(note._t);
    note._t = setTimeout(function () { if (note) note.style.display = "none"; }, 3400);
  }

  async function aaFillSingleField(field) {
    if (!field) return;
    const sig = { text: getLabelText(field), attr: getAttrText(field) };
    const question = (questionText(field) || displayLabel(sig, field) || "this field");
    // 1) Try the local profile first (instant, no API call).
    let ctx = null;
    try { ctx = await aaFillContext(); } catch (e) { ctx = null; }
    if (ctx) {
      const best = resolveValue(sig, ctx.flat, ctx.customFields);
      if (best && best.score >= 0.8 && best.value !== undefined && best.value !== null && String(best.value) !== "") {
        if (applyTextValue(field, String(best.value), best.score)) { aaAiNote("Filled from your profile"); return; }
      }
    }
    // 2) Fall back to the AI provider for open-ended fields.
    let settings, data;
    try { settings = await aaLoadSettings(); data = await aaLoadData(); }
    catch (e) { aaAiNote("Could not load your profile.", "error"); return; }
    const provider = settings.provider;
    const key = settings.keys && settings.keys[provider];
    if (!key) { aaAiNote("Add an AI key in Options to use AI fill.", "error"); return; }
    if (aaAiBtn) aaAiBtn.classList.add("aa-field-ai--busy");
    aaAiNote("Asking AI\u2026");
    const payload = {
      provider: provider,
      apiKey: key,
      model: settings.model,
      profile: aaGetActiveProfile(data),
      jobText: (typeof aaJobText === "function" ? aaJobText() : ""),
      questions: [question]
    };
    chrome.runtime.sendMessage({ action: "aa-answer-questions", payload: payload }, function (resp) {
      if (aaAiBtn) aaAiBtn.classList.remove("aa-field-ai--busy");
      if (chrome.runtime.lastError) { aaAiNote(chrome.runtime.lastError.message, "error"); return; }
      if (!resp || !resp.ok) { aaAiNote((resp && resp.error) || "AI could not answer.", "error"); return; }
      const ans = resp.data && resp.data.answers && resp.data.answers[0];
      if (!ans) { aaAiNote("AI returned no answer.", "error"); return; }
      setNativeValue(field, String(ans));
      fireEvents(field);
      field.classList.add(HL_CLASS);
      setTimeout(function () { field.classList.remove(HL_CLASS); }, 2500);
      aaAiNote("Filled with AI \u2014 review before submitting");
    });
  }

  function aaSetupFieldAi() {
    if (aaAiBtn) return;
    aaAiBtn = aaEl("button");
    aaAiBtn.id = "aa-field-ai";
    aaAiBtn.type = "button";
    aaAiBtn.title = "Fill this field with AI";
    aaAiBtn.setAttribute("aria-label", "Fill this field with AI");
    aaAiBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"></path><path d="M19 14l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"></path></svg>';
    aaAiBtn.style.display = "none";
    // Use mousedown so we act before the field loses focus.
    aaAiBtn.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const f = aaAiField;
      if (f) aaFillSingleField(f);
    });
    document.documentElement.appendChild(aaAiBtn);

    document.addEventListener("focusin", function (e) {
      const t = e.target;
      if (aaIsAiTextField(t)) aaShowAiBtn(t);
      else if (t !== aaAiBtn) aaHideAiBtn();
    }, true);
    document.addEventListener("focusout", function (e) {
      if (e.target === aaAiField) {
        clearTimeout(aaAiHideTimer);
        aaAiHideTimer = setTimeout(aaHideAiBtn, 200);
      }
    }, true);
    window.addEventListener("scroll", function () { if (aaAiField) aaPositionAiBtn(); }, true);
    window.addEventListener("resize", function () { if (aaAiField) aaPositionAiBtn(); }, true);
  }
  try { aaSetupFieldAi(); } catch (e) { /* ignore */ }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.action === "aa-detect") {
      aaLoadSettings().then(function (settings) {
        const allowed = aaDetectionAllowed(settings);
        const r = allowed ? aaPageHasForm() : { has: false, count: 0 };
        sendResponse({ allowed: allowed, has: r.has, count: r.count, host: aaTopHost() });
      }).catch(function () { sendResponse({ allowed: false, has: false, count: 0 }); });
      return true;
    }
    if (msg && msg.action === "autoapply-fill") {
      run().then(function (r) { sendResponse(r); });
      return true;
    }
    if (msg && msg.action === "autoapply-lasso") {
      startLasso();
      sendResponse({ ok: true });
      return false;
    }
    if (msg && msg.action === "autoapply-analyze") {
      runAnalysis();
      sendResponse({ ok: true });
      return false;
    }
    if (msg && msg.action === "autoapply-answer") {
      runAnswerQuestions();
      sendResponse({ ok: true });
      return false;
    }
    if (msg && msg.action === "autoapply-generate") {
      runGenerateApplication();
      sendResponse({ ok: true });
      return false;
    }
  });
})();
