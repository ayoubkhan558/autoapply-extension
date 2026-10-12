// Stored job-search preferences and automatic modal startup.
// Classic-script module; dependency order is declared in config/modules.json.
function aaOpenJobSearchFromStorage() {
  if (window !== window.top || !aaIsGoogleHost()) return;
  try {
    chrome.storage.local.get("autoapplyAI", function (res) {
      var jobs = (res && res.autoapplyAI && res.autoapplyAI.jobs) || {};
      aaShowJobSearchModal(jobs);
    });
  } catch (e) {
    aaShowJobSearchModal(null);
  }
}

function aaMaybeAutoOpenJobSearch() {
  if (window !== window.top || !aaIsGoogleHost()) return;
  if (!/[?&#]aa_jobs=1(?:&|$)/.test(location.search + location.hash) && location.search.indexOf("aa_jobs=1") === -1) return;
  aaOpenJobSearchFromStorage();
}

try { aaMaybeAutoOpenJobSearch(); } catch (e) { /* ignore */ }
