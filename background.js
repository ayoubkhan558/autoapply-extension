// AutoApply background service worker.
importScripts("lib/ai.js");

const STORAGE_KEY = "autoapplyData";

// Per-tab, per-frame fillable-field counts so the toolbar badge reflects forms that
// live inside iframes (common for embedded job applications), not just the top frame.
const aaTabFrameCounts = {};
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  if (changeInfo && changeInfo.status === "loading") { delete aaTabFrameCounts[tabId]; }
});
chrome.tabs.onRemoved.addListener(function (tabId) { delete aaTabFrameCounts[tabId]; });

async function seedIfEmpty() {
  const res = await chrome.storage.local.get(STORAGE_KEY);
  if (!res || !res[STORAGE_KEY]) {
    const url = chrome.runtime.getURL("data/profile.default.json");
    const def = await fetch(url).then(function (r) { return r.json(); });
    await chrome.storage.local.set({ [STORAGE_KEY]: def });
  }
}

// Build the context-menu label so it names the active profile, e.g.
// "Autofill this form with My Profile". Falls back to a generic label.
async function aaActiveProfileLabel() {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const data = res && res[STORAGE_KEY];
    if (!data || !data.profiles) return "";
    const p = data.profiles.find(function (x) { return x.id === data.activeProfileId; }) || data.profiles[0];
    return (p && (p.label || (p.personal && p.personal.firstName))) || "";
  } catch (e) { return ""; }
}
function aaUpdateMenuTitle() {
  aaActiveProfileLabel().then(function (name) {
    const title = name ? ("Autofill this form with " + name) : "AutoApply: fill this form";
    try { chrome.contextMenus.update("autoapply-fill", { title: title }, function () { void chrome.runtime.lastError; }); } catch (e) { /* ignore */ }
  });
}

chrome.runtime.onInstalled.addListener(function () {
  seedIfEmpty();
  chrome.contextMenus.create({
    id: "autoapply-fill",
    title: "AutoApply: fill this form",
    contexts: ["page", "editable"]
  }, function () { void chrome.runtime.lastError; aaUpdateMenuTitle(); });
});

// Keep the menu label in sync with the active profile across service-worker
// restarts and whenever the user switches or renames a profile.
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(aaUpdateMenuTitle);
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === "local" && changes[STORAGE_KEY]) aaUpdateMenuTitle();
});
aaUpdateMenuTitle();

function fillActiveTab(tab) {
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { action: "autoapply-fill" }, function () {
    void chrome.runtime.lastError;
  });
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === "autoapply-fill") fillActiveTab(tab);
});

chrome.commands.onCommand.addListener(function (command) {
  if (command === "fill-form") {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      fillActiveTab(tabs[0]);
    });
  }
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.action === "aa-parse-resume") {
    aaCallProvider(msg.payload)
      .then(function (json) { sendResponse({ ok: true, data: json }); })
      .catch(function (err) { sendResponse({ ok: false, error: String((err && err.message) || err) }); });
    return true;
  }
  if (msg && msg.action === "aa-analyze-job") {
    aaAnalyzeJob(msg.payload)
      .then(function (json) { sendResponse({ ok: true, data: json }); })
      .catch(function (err) { sendResponse({ ok: false, error: String((err && err.message) || err) }); });
    return true;
  }
  if (msg && msg.action === "aa-answer-questions") {
    aaAnswerQuestions(msg.payload)
      .then(function (json) { sendResponse({ ok: true, data: json }); })
      .catch(function (err) { sendResponse({ ok: false, error: String((err && err.message) || err) }); });
    return true;
  }
  // Draft an application email + cover letter for the current job posting.
  if (msg && msg.action === "aa-generate-application") {
    aaGenerateApplication(msg.payload)
      .then(function (json) { sendResponse({ ok: true, data: json }); })
      .catch(function (err) { sendResponse({ ok: false, error: String((err && err.message) || err) }); });
    return true;
  }
  if (msg && msg.action === "aa-form-detected") {
    const tabId = sender && sender.tab && sender.tab.id;
    const frameId = (sender && typeof sender.frameId === "number") ? sender.frameId : 0;
    if (tabId !== undefined && tabId !== null) {
      if (!aaTabFrameCounts[tabId]) aaTabFrameCounts[tabId] = {};
      aaTabFrameCounts[tabId][frameId] = msg.count || 0;
      // Badge with the largest single form found across the tab's frames.
      let max = 0;
      const frames = aaTabFrameCounts[tabId];
      for (const f in frames) { if (frames[f] > max) max = frames[f]; }
      const txt = max > 0 ? (max > 99 ? "99+" : String(max)) : "";
      try {
        chrome.action.setBadgeText({ tabId: tabId, text: txt });
        if (txt) chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#4f46e5" });
      } catch (e) { /* ignore */ }
    }
    return false;
  }
  if (msg && msg.action === "aa-list-models") {
    aaListModels(msg.payload)
      .then(function (models) { sendResponse({ ok: true, models: models }); })
      .catch(function (err) { sendResponse({ ok: false, error: String((err && err.message) || err) }); });
    return true;
  }
});
