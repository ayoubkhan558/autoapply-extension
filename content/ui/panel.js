// Panel shell, icons, loading, and common presentation helpers.
// Classic-script module; dependency order is declared in config/modules.json.
// AutoApply content module. Loaded into the extension isolated world.
// On-page panels: analysis, answers, application draft, fill result, lasso.
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
var AA_ICONS = {
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
  span.innerHTML = `
    <svg class="aa-ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" fill="${color}"></circle>
    </svg>
  `;
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

var aaLoadingTimer = null;

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
