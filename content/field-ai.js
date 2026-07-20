// AutoApply content module. Loaded into the extension isolated world.
// Per-field AI fill button.
// ---- Per-field AI fill button ---------------------------------------
// One floating button tracks the hovered/focused field (not one DOM node per input).
function aaIsAiField(el) {
  if (!el || aaIsHidden(el)) return false;
  const tag = el.tagName;
  if (tag === "SELECT") return !el.disabled && !el.readOnly;
  if (tag === "TEXTAREA") return isFillable(el);
  if (el.isContentEditable) return true;
  if (tag !== "INPUT") return false;
  const t = (el.type || "text").toLowerCase();
  // Include invalid Bubble type="input" and other text-like types.
  if (["hidden", "submit", "button", "file", "password", "reset", "image", "checkbox", "radio", "range", "color"].indexOf(t) !== -1) return false;
  if (!isFillable(el)) return false;
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
  if (!aaAiBtn || !aaJobFormDetected) return;
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

function aaScheduleHideAiBtn() {
  clearTimeout(aaAiHideTimer);
  aaAiHideTimer = setTimeout(function () {
    if (aaAiField && document.activeElement === aaAiField) return;
    aaHideAiBtn();
  }, 200);
}

function aaSetJobFormDetected(detected) {
  aaJobFormDetected = !!detected;
  if (!aaJobFormDetected) aaHideAiBtn();
  else if (aaAiField && aaIsAiField(aaAiField) && document.activeElement === aaAiField) aaShowAiBtn(aaAiField);
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
  let data;
  try { data = await aaLoadData(); }
  catch (e) { aaAiNote("Could not load your profile.", "error"); return; }
  if (aaAiBtn) aaAiBtn.classList.add("aa-field-ai--busy");
  aaAiNote("Asking AI\u2026");
  const resumeText = await aaGetResumeText((ctx && ctx.profile && ctx.profile.id) || (data && data.activeProfileId));
  const payload = {
    profile: aaGetActiveProfile(data),
    jobText: (typeof aaJobText === "function" ? aaJobText() : ""),
    questions: [question],
    resumeText: resumeText
  };
  chrome.runtime.sendMessage({ action: "aa-answer-questions", payload: payload }, function (resp) {
    if (aaAiBtn) aaAiBtn.classList.remove("aa-field-ai--busy");
    if (chrome.runtime.lastError) { aaAiNote(chrome.runtime.lastError.message, "error"); return; }
    if (!resp || !resp.ok) { aaAiNote((resp && resp.error) || "AI could not answer.", "error"); return; }
    const ans = resp.data && resp.data.answers && resp.data.answers[0];
    if (!ans) { aaAiNote("AI returned no answer.", "error"); return; }
    if (!applyTextValue(field, String(ans), 0.9)) {
      setNativeValue(field, String(ans));
      fireEvents(field);
    }
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
  aaAiBtn.innerHTML = `
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"></path>
      <path d="M19 14l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"></path>
    </svg>
  `;
  aaAiBtn.style.display = "none";
  // Use mousedown so we act before the field loses focus.
  aaAiBtn.addEventListener("mousedown", function (e) {
    e.preventDefault();
    e.stopPropagation();
    const f = aaAiField;
    if (f) aaFillSingleField(f);
  });
  aaAiBtn.addEventListener("mouseenter", function () { clearTimeout(aaAiHideTimer); });
  aaAiBtn.addEventListener("mouseleave", aaScheduleHideAiBtn);
  document.documentElement.appendChild(aaAiBtn);

  document.addEventListener("focusin", function (e) {
    const t = e.target;
    if (aaJobFormDetected && aaIsAiField(t)) aaShowAiBtn(t);
    else if (t !== aaAiBtn) aaHideAiBtn();
  }, true);
  document.addEventListener("focusout", function (e) {
    if (e.target === aaAiField) aaScheduleHideAiBtn();
  }, true);
  // ponytail: one floating btn repositioned on hover — not N icons in the DOM.
  document.addEventListener("mouseover", function (e) {
    if (!aaJobFormDetected) return;
    const t = e.target;
    if (!t || t === aaAiBtn || (aaAiBtn && aaAiBtn.contains(t))) return;
    const field = (t.closest && t.closest("input, textarea, select, [contenteditable='true']")) || null;
    if (aaIsAiField(field)) aaShowAiBtn(field);
  }, true);
  document.addEventListener("mouseout", function (e) {
    if (!aaAiField) return;
    const to = e.relatedTarget;
    if (to === aaAiBtn || (aaAiBtn && aaAiBtn.contains(to))) return;
    if (to === aaAiField || (aaAiField.contains && aaAiField.contains(to))) return;
    const leaving = e.target === aaAiField || (aaAiField.contains && aaAiField.contains(e.target));
    if (leaving) aaScheduleHideAiBtn();
  }, true);
  window.addEventListener("scroll", function () { if (aaAiField) aaPositionAiBtn(); }, true);
  window.addEventListener("resize", function () { if (aaAiField) aaPositionAiBtn(); }, true);
}
