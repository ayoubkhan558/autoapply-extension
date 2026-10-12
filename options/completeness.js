// Profile completeness reporting.
// Classic-script module; dependency order is declared in config/modules.json.
function renderCompleteness(prof) {
  const host = document.getElementById("completenessBody");
  if (!host || !prof) return;
  const missing = [];
  let total = 0;
  SECTIONS.forEach(function (section) {
    const sec = prof[section.key] || {};
    section.fields.forEach(function (fd) {
      total++;
      const v = sec[fd.name];
      if (v === null || v === undefined || String(v).trim() === "") missing.push(fd.label);
    });
  });
  const filled = total - missing.length;
  const pct = total ? Math.round((filled / total) * 100) : 0;
  host.innerHTML = "";
  const bar = document.createElement("div");
  bar.className = "aa-completeness__bar";
  const fill = document.createElement("div");
  fill.className = "aa-completeness__fill";
  fill.style.width = pct + "%";
  bar.appendChild(fill);
  host.appendChild(bar);
  const pctEl = document.createElement("p");
  pctEl.className = "aa-completeness__pct";
  pctEl.textContent = pct + "% complete — " + filled + " of " + total + " profile fields filled";
  host.appendChild(pctEl);
  if (missing.length) {
    const wrap = document.createElement("div");
    wrap.className = "aa-completeness__missing";
    missing.forEach(function (m) {
      const chip = document.createElement("span");
      chip.className = "aa-completeness__chip";
      chip.textContent = m;
      wrap.appendChild(chip);
    });
    host.appendChild(wrap);
  } else {
    const done = document.createElement("div");
    done.className = "aa-completeness__done";
    done.textContent = "✓ All profile fields are filled.";
    host.appendChild(done);
  }
}
