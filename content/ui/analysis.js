// Job-fit analysis rendering and invocation.
// Classic-script module; dependency order is declared in config/modules.json.
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
  const payload = { jobText: aaJobText(), profile: profile, resumeText: await aaGetResumeText(data.activeProfileId) };
  chrome.runtime.sendMessage({ action: "aa-analyze-job", payload: payload }, function (resp) {
    if (chrome.runtime.lastError) { aaRenderError(body, chrome.runtime.lastError.message); return; }
    if (!resp || !resp.ok) { aaRenderError(body, (resp && resp.error) || "Analysis failed."); return; }
    aaRenderAnalysis(body, resp.data);
  });
}
function runJobAnalysis() { return runAnalysis(); }

// ---- Email + cover-letter generation ----
// Copy a block of text to the clipboard, flashing the button label as feedback.
