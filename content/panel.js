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
  let data;
  try { data = await aaLoadData(); }
  catch (e) { aaRenderError(body, "Could not load your profile or settings."); return; }
  const profile = aaGetActiveProfile(data);
  aaRenderLoading(body);
  // The API key never leaves the background worker; it resolves provider/key itself.
  const payload = { jobText: aaJobText(), profile: profile };
  chrome.runtime.sendMessage({ action: "aa-analyze-job", payload: payload }, function (resp) {
    if (chrome.runtime.lastError) { aaRenderError(body, chrome.runtime.lastError.message); return; }
    if (!resp || !resp.ok) { aaRenderError(body, (resp && resp.error) || "Analysis failed."); return; }
    aaRenderAnalysis(body, resp.data);
  });
}
function runJobAnalysis() { return runAnalysis(); }

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
  let data;
  try { data = await aaLoadData(); }
  catch (e) { aaRenderError(body, "Could not load your profile or settings."); return; }
  const profile = aaGetActiveProfile(data);
  aaRenderLoading(body, ["Reading the job posting\u2026", "Matching your experience\u2026", "Drafting your email\u2026", "Writing your cover letter\u2026", "Polishing the wording\u2026"]);
  const payload = { jobText: aaJobText(), profile: profile };
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
  let data;
  try { data = await aaLoadData(); }
  catch (e) { aaRenderError(body, "Could not load your profile or settings."); return; }
  const fields = aaCollectQuestions();
  if (!fields.length) { aaRenderError(body, "No open-ended questions found on this page."); return; }
  aaRenderLoading(body);
  const payload = {
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
  if (!aaPageHasForm({ detect: { keywords: "", minFields: 4 } }).isJob) btn.style.display = "none";
  btn.addEventListener("click", function () { runAnswerQuestions(); });
  body.appendChild(btn);
  const analyzeBtn = aaEl("button", "aa-btn-fix aa-btn-analyze");
  analyzeBtn.appendChild(aaIcon("target"));
  analyzeBtn.appendChild(document.createTextNode("Analyze this job"));
  analyzeBtn.addEventListener("click", function () { runJobAnalysis(); });
  body.appendChild(analyzeBtn);
  body.appendChild(aaEl("div", "aa-foot", "AI answers open-ended questions using your profile. Review before submitting."));
}

// ---- Drag-to-select (lasso) fill ------------------------------------
var aaLassoActive = false;
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
