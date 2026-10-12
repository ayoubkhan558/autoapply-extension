// Eligible open-ended questions and batch AI filling.
// Classic-script module; dependency order is declared in config/modules.json.
function aaIsQuestionField(el) {
  if (!aaIsEligible(el)) return false;
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
  const els = aaEligibleControls().controls;
  const out = [];
  els.forEach(function (el) {
    if (el.disabled || el.readOnly) return;

    if ((el.isContentEditable ? el.textContent : (el.value || "")).trim()) return;
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
    questions: fields.map(function (f) { return f.q; }),
    resumeText: await aaGetResumeText(data.activeProfileId)
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
      if (!aaWithSubmitGuard(function () { return applyTextValue(f.el, String(ans), 0.9); })) return;
      f.el.classList.add(HL_CLASS);
      filled++;
    });
    body.appendChild(aaEl("div", "aa-summary", "Filled " + filled + " of " + fields.length + " question(s). Review before submitting."));
  });
}

// ---- Post-fill result modal -----------------------------------------
