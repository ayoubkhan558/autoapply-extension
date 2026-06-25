// AutoApply popup script. Drives the toolbar popup: triggers autofill / field
// selection / job analysis on the active tab, shows quick copy tools and the
// "last filled here" reminder, and manages the job-board search shortcuts.
//
// Known job boards used by the "Find jobs" shortcuts (host per provider key).
const BOARDS = {
  lever: "jobs.lever.co",
  greenhouse: "boards.greenhouse.io",
  ashby: "jobs.ashbyhq.com",
  workable: "apply.workable.com",
  indeed: "indeed.com"
};

function setStatus(text, kind) {
  const s = document.getElementById("status");
  s.textContent = text;
  s.className = "status " + (kind || "");
}

// Send a message to the page's content script. If it is not loaded yet
// (e.g. the tab was open before the extension was installed/updated),
// inject it on demand and retry, so the user never has to reload the tab.
function ensureContentAndSend(tabId, message, onResult) {
  chrome.tabs.sendMessage(tabId, message, function (resp) {
    if (!chrome.runtime.lastError) { onResult(resp, null); return; }
    chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ["content.css"] }, function () {
      void chrome.runtime.lastError;
      chrome.scripting.executeScript(
        { target: { tabId: tabId }, files: ["lib/fields.js", "lib/matcher.js", "lib/storage.js", "content.js"] },
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
  function aaActiveProfile() { return aaGetActiveProfile(data); }
  function refreshCv(pid) {
    aaGetResume(pid).then(function (cv) {
      const b = document.getElementById("cvBadge");
      if (!b) return;
      if (cv && cv.name) { b.textContent = cv.name; b.title = cv.name; b.className = "quick__cv-name quick__cv-name--set"; }
      else { b.textContent = "No CV attached"; b.title = ""; b.className = "quick__cv-name"; }
    }).catch(function () { /* ignore */ });
  }
  function refreshQuick() {
    const p = aaActiveProfile() || {};
    const per = p.personal || {};
    const email = per.email || "";
    const phone = per.phone || "";
    const eq = document.getElementById("qEmail");
    const pq = document.getElementById("qPhone");
    if (eq) { eq.textContent = email || "\u2014"; eq.title = email; }
    if (pq) { pq.textContent = phone || "\u2014"; pq.title = phone; }
    const ce = document.getElementById("copyEmail");
    const cp = document.getElementById("copyPhone");
    if (ce) ce.disabled = !email;
    if (cp) cp.disabled = !phone;
    refreshCv(p.id);
  }
  sel.addEventListener("change", async function () {
    data.activeProfileId = sel.value;
    await aaSaveData(data);
    refreshQuick();
  });
  refreshQuick();
  (function () {
    const ce = document.getElementById("copyEmail");
    const cp = document.getElementById("copyPhone");
    if (ce) ce.addEventListener("click", function () {
      const v = ((aaActiveProfile() || {}).personal || {}).email || "";
      if (!v) return;
      navigator.clipboard.writeText(v).then(function () { setStatus("Email copied.", "success"); }).catch(function () { setStatus("Copy failed.", "error"); });
    });
    if (cp) cp.addEventListener("click", function () {
      const v = ((aaActiveProfile() || {}).personal || {}).phone || "";
      if (!v) return;
      navigator.clipboard.writeText(v).then(function () { setStatus("Phone copied.", "success"); }).catch(function () { setStatus("Copy failed.", "error"); });
    });
  })();
  const editBtn = document.getElementById("editProfileBtn");
  if (editBtn) editBtn.addEventListener("click", function () { chrome.runtime.openOptionsPage(); });
  const settingsBtn = document.getElementById("openSettingsBtn");
  if (settingsBtn) settingsBtn.addEventListener("click", function () { chrome.runtime.openOptionsPage(); });

  const settings = await aaLoadSettings();
  const jobs = settings.jobs || {};
  document.getElementById("jobRole").value = jobs.role || "";
  document.getElementById("jobLocation").value = jobs.location || "";
  const sites = jobs.sites || { lever: true, greenhouse: true, ashby: true };
  Object.keys(BOARDS).forEach(function (k) {
    const cb = document.getElementById("site-" + k);
    if (cb) cb.checked = !!sites[k];
  });

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

document.getElementById("findJobsBtn").addEventListener("click", async function () {
  const role = document.getElementById("jobRole").value.trim();
  const location = document.getElementById("jobLocation").value.trim();
  const sites = {};
  const selected = [];
  Object.keys(BOARDS).forEach(function (k) {
    const cb = document.getElementById("site-" + k);
    sites[k] = !!(cb && cb.checked);
    if (sites[k]) selected.push(BOARDS[k]);
  });

  const settings = await aaLoadSettings();
  settings.jobs = { role: role, location: location, sites: sites };
  await aaSaveSettings(settings);

  if (!role && !selected.length) { setStatus("Enter a role or pick a site.", "error"); return; }
  const base = (role + " " + location).trim();
  const queries = selected.length
    ? selected.map(function (d) { return ("site:" + d + " " + base).trim(); })
    : [base];
  queries.forEach(function (q, idx) {
    chrome.tabs.create({ url: "https://www.google.com/search?q=" + encodeURIComponent(q), active: idx === 0 });
  });
  setStatus("Opened " + queries.length + " search tab(s).", "success");
  setTimeout(function () { window.close(); }, 400);
});

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      const name = t.getAttribute("data-tab");
      document.getElementById("panel-apply").classList.toggle("hidden", name !== "apply");
      document.getElementById("panel-jobs").classList.toggle("hidden", name !== "jobs");
    });
  });
}

setupTabs();
init();
