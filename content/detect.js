// AutoApply content module. Loaded into the extension isolated world.
// Form detection + toolbar toast.
// ---- Form detection (gated by settings) -----------------------------
function aaCleanHost(s) {
  return String(s || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").replace(/^\.+/, "");
}
function aaHostList(v) {
  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string") arr = v.split(/[\s,\n]+/);
  return arr.map(aaCleanHost).filter(Boolean);
}
function aaHostAllowed(host, allow, block) {
  host = aaCleanHost(host);
  function hit(list) { return list.some(function (e) { return host === e || host.endsWith("." + e); }); }
  if (block.length && hit(block)) return false;
  if (allow.length) return hit(allow);
  return true;
}
function aaDetectionAllowed(settings) {
  const d = (settings && settings.detect) || {};
  if (d.enabled === false) return false;
  // Fall back to the shared defaults (lib/storage.js) when the user has not
  // saved a blocklist; previously the default list was defined but never used.
  const block = aaHostList(d.blocklist);
  return aaHostAllowed(location.hostname, aaHostList(d.allowlist), block.length ? block : aaHostList(AA_DEFAULT_BLOCKED_SITES));
}
function aaCountFillable() {
  let count = 0;
  collectControls().forEach(function (el) {
    if (!isFillable(el)) return;
    if (aaIsHidden(el)) return;
    const sig = { text: getLabelText(el), attr: getAttrText(el) };
    if (isSearchField(el, sig)) return;
    count++;
  });
  return count;
}
// Built-in phrases/roles come from lib/storage.js
// (AA_DEFAULT_JOB_KEYWORDS, AA_DEFAULT_JOB_ROLES).
function aaSplitDetectList(raw) {
  // Comma or newline separated → lowercased tokens (shared by keywords + roles).
  return String(raw || "").split(/[\n,]+/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
}
function aaCustomKeywords(settings) {
  return aaSplitDetectList(settings && settings.detect && settings.detect.keywords);
}
function aaCustomRoles(settings) {
  // User extras from Options; empty means "use built-ins only".
  return aaSplitDetectList(settings && settings.detect && (settings.detect.roles || settings.detect.jobTitles));
}
function aaMinFields(settings) {
  var n = parseInt(settings && settings.detect && settings.detect.minFields, 10);
  return (isNaN(n) || n < 1) ? 4 : n;
}
function aaPageText() {
  var body = (document.body && document.body.innerText) ? document.body.innerText.slice(0, 8000) : "";
  return ((document.title || "") + " " + location.href + " " + body).toLowerCase();
}
function aaJobSignal(settings) {
  var hosts = ["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "indeed.com", "myworkdayjobs.com", "smartrecruiters.com", "jobvite.com", "icims.com", "taleo.net", "bamboohr.com", "breezy.hr", "recruitee.com"];
  var h = location.hostname.toLowerCase();
  if (hosts.some(function (e) { return h.indexOf(e) !== -1; })) return true;
  if (/(^|\.)jobs\.|(^|\.)careers\./.test(h)) return true;
  var hay = aaPageText();
  // Any user-added keyword is a strong signal on its own.
  if (aaCustomKeywords(settings).some(function (kw) { return hay.indexOf(kw) !== -1; })) return true;
  // Built-in job titles always apply; user Options roles are extras on top.
  if (AA_DEFAULT_JOB_ROLES.some(function (role) { return role.length >= 3 && hay.indexOf(role) !== -1; })) return true;
  if (aaCustomRoles(settings).some(function (role) { return role.length >= 3 && hay.indexOf(role) !== -1; })) return true;
  // Require at least two built-in phrases so generic pages (search boxes,
  // logins, newsletters) are not mistaken for job application forms.
  var hits = 0;
  for (var i = 0; i < AA_DEFAULT_JOB_KEYWORDS.length && hits < 2; i++) {
    if (hay.indexOf(AA_DEFAULT_JOB_KEYWORDS[i]) !== -1) hits++;
  }
  return hits >= 2;
}
function aaPageHasForm(settings) {
  const count = aaCountFillable();
  // A page only counts as a job form when it has at least `minFields`
  // fillable fields AND its content looks like a job application.
  const isJob = count >= aaMinFields(settings) && aaJobSignal(settings);
  return { has: isJob, count: count, isJob: isJob };
}
var aaDetectToastShown = false;
var aaJobFormDetected = false;
function aaShowDetectToast(count, isJob, profileName) {
  var old = document.getElementById("aa-detect-toast");
  if (old) old.remove();
  var toast = aaEl("div");
  toast.id = "aa-detect-toast";
  var head = aaEl("div", "aa-detect-toast__head");
  head.appendChild(aaEl("span", "aa-detect-toast__title", "AutoApply"));
  var close = aaEl("button", "aa-detect-toast__close", "\u00d7");
  close.setAttribute("aria-label", "Dismiss");
  close.addEventListener("click", function () { toast.remove(); });
  head.appendChild(close);
  toast.appendChild(head);
  var mins = Math.max(1, Math.round(count * 20 / 60));
  toast.appendChild(aaEl("div", "aa-detect-toast__msg", isJob ? "Job application form detected" : "Form detected"));
  toast.appendChild(aaEl("div", "aa-detect-toast__sub", count + " fillable field" + (count === 1 ? "" : "s") + " \u00b7 ~" + mins + " min to apply manually"));
  // Show which profile AutoApply will fill from, so the user can switch first if needed.
  if (profileName) toast.appendChild(aaEl("div", "aa-detect-toast__profile", "Will fill using: " + profileName));
  var actions = aaEl("div", "aa-detect-toast__actions");
  var fill = aaEl("button", "aa-detect-toast__btn", "Fill form");
  fill.addEventListener("click", function () { toast.remove(); try { run(); } catch (e) { /* ignore */ } });
  var analyze = aaEl("button", "aa-detect-toast__btn aa-detect-toast__btn--ghost", "Analyze job");
  analyze.addEventListener("click", function () { toast.remove(); try { runJobAnalysis(); } catch (e) { /* ignore */ } });
  actions.appendChild(fill); actions.appendChild(analyze); toast.appendChild(actions);
  document.documentElement.appendChild(toast);
  setTimeout(function () {
    if (!toast.parentNode) return;
    toast.classList.add("aa-detect-toast--out");
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 400);
  }, 10000);
}
function aaReportDetection() {
  aaLoadSettings().then(function (settings) {
    const allowed = aaDetectionAllowed(settings);
    let count = 0;
    if (allowed) { const r = aaPageHasForm(settings); count = r.has ? r.count : 0; aaSetJobFormDetected(!!r.has); }
    else { aaSetJobFormDetected(false); }
    // Report this frame's count; the background aggregates across all frames for the badge.
    try { chrome.runtime.sendMessage({ action: "aa-form-detected", count: count, allowed: allowed }); } catch (e) { /* ignore */ }
    // Show the in-page toast in whichever frame actually holds the form. Job application
    // forms (Greenhouse, Lever, Ashby, Workday, etc.) are frequently embedded in an iframe.
    if (allowed && count > 0 && !aaDetectToastShown) {
      aaDetectToastShown = true;
      var isJob = true; // detection now only fires for job-application forms
      // Resolve the active profile name so the toast can show which profile will be used.
      aaLoadData().then(function (data) {
        var name = "";
        try { var p = aaGetActiveProfile(data); name = (p && (p.label || (p.personal && p.personal.firstName))) || ""; } catch (e) { /* ignore */ }
        try { aaShowDetectToast(count, isJob, name); } catch (e) { /* ignore */ }
      }).catch(function () { try { aaShowDetectToast(count, isJob, ""); } catch (e) { /* ignore */ } });
    }
  }).catch(function () { /* ignore */ });
}
