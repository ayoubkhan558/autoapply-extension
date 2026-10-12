// Eligibility tokens, visibility, and per-control exclusions.
// Classic-script module; dependency order is declared in config/modules.json.
// All fill surfaces use aaEligibleControls; file/action modes are explicit.
function aaTokens(str) {
  return String(str || '').replace(/['\u2019]/g, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
function aaOwnTokens(el) {
  return aaTokens(['id', 'name', 'class', 'data-testid', 'data-qa', 'data-test', 'role']
    .map(function (a) { return el.getAttribute(a) || ''; }).join(' '));
}
var AA_SEARCHY = ['search','searchbox','searchbar','query','keyword','keywords','filter','filters','facet','facets','refine','sortby'];
var AA_WIDGET_NEG = AA_SEARCHY.concat(['newsletter','subscribe','subscription','login','signin','checkout','payment','comment','comments','footer']);
var AA_HONEYPOT = /honeypot|(?:^|[\s_-])(?:hp|trap)(?:$|[\s_-])|leave.?blank|do.?not.?fill|bot.?field|nospam|ohnohoney/i;
var AA_ROOT_CACHE = new WeakMap();
var AA_CUSTOM_SELECTOR = '[role="combobox"],[aria-haspopup="listbox"],[aria-haspopup="menu"],[aria-haspopup="true"],[role="radio"]';
function aaParent(el) { return el.parentElement || (el.getRootNode && el.getRootNode().host) || null; }
function aaAncestorsSafe(el) {
  for (var n = el; n; n = aaParent(n)) {
    if (n.hidden || n.inert || n.getAttribute('aria-hidden') === 'true') return false;
    var s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || Number(s.opacity) === 0) return false;
  }
  return true;
}
function aaReallyVisible(el) {
  if (!el || !el.isConnected || !aaAncestorsSafe(el)) return false;
  var r = el.getBoundingClientRect();
  return r.width >= 2 && r.height >= 2 && r.right >= 0 && r.bottom >= 0 && r.left <= innerWidth + 5000;
}
function aaVisibleCheckProxy(el) {
  if (!/^(radio|checkbox)$/.test(el.type || '')) return false;
  // Native choices may be transparent, but not inside a hidden/inert subtree.
  if (!aaAncestorsSafe(aaParent(el) || el)) return false;
  if (el.hidden || el.inert || el.getAttribute('aria-hidden') === 'true') return false;
  var labels = el.labels ? Array.from(el.labels) : [];
  return labels.some(aaReallyVisible);
}
function aaControlSkipReason(el, opts) {
  opts = opts || {};
  if (el.closest('[id^="aa-"],.aa-panel,.aa-lasso-overlay')) return 'extension-ui';
  if (el.disabled || el.readOnly || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-readonly') === 'true') return 'disabled/readonly';
  var t = (el.type || '').toLowerCase(), role = (el.getAttribute('role') || '').toLowerCase();
  if (['search','password','hidden','submit','reset','image','range','color'].indexOf(t) !== -1) return 'type:' + t;
  if (t === 'file' && !opts.allowFiles) return 'type:file';
  if (t === 'button' && !opts.actions && !el.matches(AA_CUSTOM_SELECTOR)) return 'type:button';
  if (role === 'searchbox' || role === 'search') return 'role:search';
  if ([el.getAttribute('enterkeyhint'), el.getAttribute('inputmode')].some(function (s) { return (s || '').toLowerCase() === 'search'; })) return 'search-hint';
  var ac = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (/(^|\s)(cc-[^\s]*|current-password|new-password|one-time-code)(\s|$)/.test(ac)) return 'sensitive-autocomplete';
  if (AA_HONEYPOT.test([el.name,el.id,el.getAttribute('class')].join(' '))) return 'honeypot-name';
  if (!aaReallyVisible(el) && !aaVisibleCheckProxy(el)) return 'invisible';
  if (aaOwnTokens(el).some(function (k) { return AA_SEARCHY.indexOf(k) !== -1; })) return 'own-token:search/filter';
  if (/^(q|s|kw|term|terms)$/i.test(el.name || '') || /^(q|s)$/i.test(el.id || '')) return 'short-search-name';
  var label = String(getLabelText(el) || '').toLowerCase();
  if (/^\s*(search|find|filter|sort)\b|\bsearch (for|by|jobs|results|keyword)|\bfilter by\b/.test(label)) return 'label:search';
  if (/\b(newsletter|subscribe|subscription|sign in|log in|name on card|cardholder|credit card|payment|leave a comment|post a comment)\b/.test(label)) return 'label:non-application';
  // Only contact/identity fields for other people, not e.g. "Are you a manager?".
  if (/\b(referral|referee|reference|supervisor|manager|spouse|parent|guardian|emergency|recommender|friend|colleague)(?:['’]s)?\b/.test(label)
      && /\b(name|email|phone|contact|address|number)\b/.test(label)) return 'other-person';
  return null;
}
