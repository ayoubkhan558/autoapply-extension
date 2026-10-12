// AutoApply popup script. Drives the toolbar popup: triggers autofill / field
// selection / job analysis on the active tab, and opens the Google job-search modal.
function setStatus(text, kind) {
  const s = document.getElementById("status");
  s.textContent = text;
  s.className = "aa-status " + (kind ? "aa-" + kind : "");
}

// Send a message to the page's content script. If it is not loaded yet
// (e.g. the tab was open before the extension was installed/updated),
// inject it on demand and retry, so the user never has to reload the tab.
function ensureContentAndSend(tabId, message, onResult) {
  chrome.tabs.sendMessage(tabId, message, function (resp) {
    if (!chrome.runtime.lastError) { onResult(resp, null); return; }
    // allFrames matches the manifest content_scripts (job forms often live in iframes).
    chrome.scripting.insertCSS({ target: { tabId: tabId, allFrames: true }, files: AutoApplyModules.css }, function () {
      void chrome.runtime.lastError;
      chrome.scripting.executeScript(
        { target: { tabId: tabId, allFrames: true }, files: AutoApplyModules.js },
        function () {
          if (chrome.runtime.lastError) { onResult(null, chrome.runtime.lastError.message); return; }
          chrome.tabs.sendMessage(tabId, message, function (resp2) {
            if (chrome.runtime.lastError) { onResult(null, chrome.runtime.lastError.message); return; }
            onResult(resp2, null);
          });
        }
      );
    });
  });
}

function withActiveTab(fn) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (!tab || tab.id === undefined) { setStatus("No active tab.", "error"); return; }
    fn(tab);
  });
}

function openJobSearch() {
  chrome.runtime.sendMessage({ action: "aa-open-job-search" }, function () {
    void chrome.runtime.lastError;
    window.close();
  });
}

async function init() {
  const data = await aaLoadData();
  const sel = document.getElementById("profileSelect");
  sel.innerHTML = "";
  data.profiles.forEach(function (p) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label || p.id;
    if (p.id === data.activeProfileId) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", async function () {
    data.activeProfileId = sel.value;
    await aaSaveData(data);
  });
  // Email/phone quick rows are intentionally hidden in the compact popup.
  const editBtn = document.getElementById("editProfileBtn");
  if (editBtn) editBtn.addEventListener("click", function () { chrome.runtime.openOptionsPage(); });
  const settingsBtn = document.getElementById("openSettingsBtn");
  if (settingsBtn) settingsBtn.addEventListener("click", function () { chrome.runtime.openOptionsPage(); });

  // Tell the user whether the current page has a detectable form.
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (!tab || tab.id === undefined) return;
    chrome.tabs.sendMessage(tab.id, { action: "aa-detect" }, function (resp) {
      let host = (resp && resp.host) || "";
      if (!host) { try { host = new URL(tab.url).hostname; } catch (e) { host = ""; } }
      const lf = document.getElementById("lastFilled");
      if (lf && host) {
        aaGetFillRecord(host).then(function (rec) {
          if (rec && rec.ts) { lf.textContent = "Last filled here " + aaRelativeTime(rec.ts) + " \u00b7 " + (rec.count || 0) + " field" + (rec.count === 1 ? "" : "s"); lf.style.display = "block"; }
          else { lf.style.display = "none"; }
        }).catch(function () { /* ignore */ });
      }
      if (chrome.runtime.lastError || !resp) return;
      if (!resp.allowed) setStatus("Detection is off for this site (change in Options).", "");
      else if (resp.has) setStatus("\u2713 Form detected \u2014 " + resp.count + " fillable field(s).", "success");
      else setStatus("No form detected on this page.", "");
    });
  });
}

document.getElementById("fillBtn").addEventListener("click", function () {
  setStatus("Filling\u2026", "");
  withActiveTab(function (tab) {
    ensureContentAndSend(tab.id, { action: "autoapply-fill" }, function (resp, err) {
      if (err || !resp) { setStatus("Open a normal webpage, then retry.", "error"); return; }
      if (resp.error === "no-profile") { setStatus("Add your data in options first.", "error"); return; }
      setStatus("Filled " + resp.filled + " field(s).", "success");
    });
  });
});

document.getElementById("analyzeBtn").addEventListener("click", function () {
  setStatus("Analyzing\u2026", "");
  withActiveTab(function (tab) {
    ensureContentAndSend(tab.id, { action: "autoapply-analyze" }, function (resp, err) {
      if (err) { setStatus("Open a job posting page, then retry.", "error"); return; }
      setStatus("See the panel on the page.", "success");
      window.close();
    });
  });
});

// Generate a tailored application email + cover letter for the current job page.
document.getElementById("coverLetterBtn").addEventListener("click", function () {
  setStatus("Generating email & cover letter\u2026", "");
  withActiveTab(function (tab) {
    ensureContentAndSend(tab.id, { action: "autoapply-generate" }, function (resp, err) {
      if (err) { setStatus("Open a job posting page, then retry.", "error"); return; }
      setStatus("See the panel on the page.", "success");
      window.close();
    });
  });
});

document.getElementById("selectFieldsBtn").addEventListener("click", function () {
  setStatus("Draw a box over the fields to fill…", "");
  withActiveTab(function (tab) {
    ensureContentAndSend(tab.id, { action: "autoapply-lasso" }, function (resp, err) {
      if (err) { setStatus("Open a normal webpage, then retry.", "error"); return; }
      setStatus("Drag to select the fields on the page.", "success");
      window.close();
    });
  });
});

document.getElementById("findJobsBtn").addEventListener("click", openJobSearch);

function setupTabs() {
  const tabs = document.querySelectorAll(".aa-tab");
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      if (t.getAttribute("data-tab") === "jobs") {
        openJobSearch();
        return;
      }
      tabs.forEach(function (x) { x.classList.remove("aa-active"); });
      t.classList.add("aa-active");
      document.getElementById("panel-apply").classList.toggle("aa-hidden", false);
      document.getElementById("panel-jobs").classList.toggle("aa-hidden", true);
    });
  });
}

setupTabs();
init();
