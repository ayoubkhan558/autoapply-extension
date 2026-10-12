// Education/experience section addition and record filling.
// Classic-script module; dependency order is declared in config/modules.json.
function aaRepeaterEmpties(groupKey) {
  const out = [];
  aaEligibleControls({allowFiles:true}).controls.forEach(function (el) {
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
    if (!aaIsEligible(el, {actions:true}) || !aaCanSafeClick(el)) continue;
    const t = norm(aaText(el) || el.value || el.getAttribute("aria-label") || "");
    if (t && t.length <= 60 && re.test(t)) return el;
  }
  return null;
}

async function fillRepeaterSections(ctx) {
  const groups = [
    { key: "education", re: /^(?:add|new|\+)\s*(?:another\s+)?(?:education|educational details|qualification|academic record|degree|school)(?:\s+(?:entry|record|details))?$/ },
    { key: "experience", re: /^(?:add|new|\+)\s*(?:another\s+)?(?:experience|employment|position|job|work experience|work history)(?:\s+(?:entry|record|details))?$/ }
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
    const hasFields = aaEligibleControls().controls.some(function (el) {
      const m = AutoApplyMatcher.match({ text: getLabelText(el), attr: getAttrText(el) });
      return m.key && m.score >= 0.6 && m.key.indexOf(grp.key + ".") === 0;
    });
    for (let i = hasFields ? 1 : 0; i < entries.length && i < 10; i++) {
      const btn = aaFindAddButton(grp.re);
      if (!btn) break;
      try { if (!aaSafeClick(btn)) break; } catch (e) { break; }
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
