// Scoped custom dropdown discovery and option selection.
// Classic-script module; dependency order is declared in config/modules.json.
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
    if (!aaIsEligible(el, {box:box})) return;
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
      const sig = { text: customSelectLabel(trg), attr: getAttrText(trg), salaryCurrency: ctx.flat["professional.salaryCurrency"] || "" };
      if (!sig.text && !sig.attr) continue;
      if (isSearchField(trg, sig)) continue;
      const best = resolveValue(sig, ctx.flat, ctx.customFields);
      if (best.score < 0.6 || best.value === undefined || best.value === null || best.value === "") continue;
      const want = norm(transformValue(trg, sig, String(best.value)));
      if (!want) continue;
      if (norm(trg.textContent).indexOf(want) !== -1) continue;
      if (!aaIsEligible(trg, {box:box}) || !aaSafeClick(trg)) continue;
      await sleep(240);
      let optionNodes;
      const mid = aaMenuId(trg);
      const scope = trg.getRootNode();
      let menu = mid && scope.querySelector("#" + CSS.escape(mid));
      if (!menu) {
        const popups = Array.from(scope.querySelectorAll('[role="listbox"],[role="menu"]')).filter(aaReallyVisible);
        if (popups.length === 1) menu = popups[0];
      }
      if (!menu) continue; // Ambiguous popup: leave it for manual review.
      optionNodes = menu.querySelectorAll('[role="option"],[role="menuitem"],[class*="option"],[class*="SelectOption"],[data-value]');
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
        let clicked = 0;
        for (let pi = 0; pi < picks.length; pi++) {
          if (!aaIsEligible(trg, {box:box})) break;
          if (aaSafeClick(picks[pi])) clicked++;
          await sleep(90);
        }
        if (!clicked) continue;
        markFilled(trg, best.score);
        filled++;
        if (filledEls) filledEls.push(trg);
      } else {
        aaSafeClick(trg);
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
