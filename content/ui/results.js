// Fill-result summary and follow-up actions.
// Classic-script module; dependency order is declared in config/modules.json.
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
