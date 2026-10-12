// Field identity, question text, and option-label extraction.
// Classic-script module; dependency order is declared in config/modules.json.
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
