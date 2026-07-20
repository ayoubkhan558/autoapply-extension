// AutoApply content module. Loaded into the extension isolated world.
// Per-field AI fill button.
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

function aaSetJobFormDetected(detected) {
  aaJobFormDetected = !!detected;
  if (!aaJobFormDetected) aaHideAiBtn();
  else if (aaAiField && aaIsAiTextField(aaAiField) && document.activeElement === aaAiField) aaShowAiBtn(aaAiField);
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
  const payload = {
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
    if (aaJobFormDetected && aaIsAiTextField(t)) aaShowAiBtn(t);
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