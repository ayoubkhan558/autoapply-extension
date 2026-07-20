// AutoApply content module. Loaded into the extension isolated world.
// Boot: register listeners once. Sibling modules only define helpers.
if (!window.__autoApplyContentLoaded) {
  window.__autoApplyContentLoaded = true;
  try { aaSetupFieldAi(); } catch (e) { /* ignore */ }
  try { [400, 1200, 2500, 4500, 7000].forEach(function (ms) { setTimeout(aaReportDetection, ms); }); } catch (e) { /* ignore */ }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.action === "aa-detect") {
      aaLoadSettings().then(function (settings) {
        const allowed = aaDetectionAllowed(settings);
        const r = allowed ? aaPageHasForm(settings) : { has: false, count: 0 };
        aaSetJobFormDetected(!!(allowed && r.has));
        sendResponse({ allowed: allowed, has: r.has, count: r.count, host: aaTopHost() });
      }).catch(function () { sendResponse({ allowed: false, has: false, count: 0 }); });
      return true;
    }
    if (msg && msg.action === "autoapply-fill") {
      run().then(function (r) { sendResponse(r); });
      return true;
    }
    if (msg && msg.action === "autoapply-lasso") {
      startLasso();
      sendResponse({ ok: true });
      return false;
    }
    if (msg && msg.action === "autoapply-analyze") {
      runAnalysis();
      sendResponse({ ok: true });
      return false;
    }
    if (msg && msg.action === "autoapply-answer") {
      runAnswerQuestions();
      sendResponse({ ok: true });
      return false;
    }
    if (msg && msg.action === "autoapply-generate") {
      runGenerateApplication();
      sendResponse({ ok: true });
      return false;
    }
  });

}
