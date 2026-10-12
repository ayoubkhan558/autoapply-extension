// Generated email/cover-letter presentation and invocation.
// Classic-script module; dependency order is declared in config/modules.json.
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
  const payload = { jobText: aaJobText(), profile: profile, resumeText: await aaGetResumeText(data.activeProfileId) };
  chrome.runtime.sendMessage({ action: "aa-generate-application", payload: payload }, function (resp) {
    if (chrome.runtime.lastError) { aaRenderError(body, chrome.runtime.lastError.message); return; }
    if (!resp || !resp.ok) { aaRenderError(body, (resp && resp.error) || "Generation failed."); return; }
    aaRenderApplication(body, resp.data);
  });
}
