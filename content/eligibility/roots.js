// Form/pseudo-form discovery, scoring, and widget boundaries.
// Classic-script module; dependency order is declared in config/modules.json.
function aaCountVisible(root) {
  return collectControls(root).filter(function (c) {
    return !/^(hidden|submit|button|reset|image|checkbox|radio|password|file)$/.test(c.type || '') && aaReallyVisible(c);
  }).length;
}
function aaNearestRoot(el) {
  if (el.form) return { node: el.form, isForm: true };
  for (var n = aaParent(el), d = 0; n && n !== document.body && d < 8; n = aaParent(n), d++) {
    if (n.tagName === 'FORM') return { node: n, isForm: true };
    if (/^(HEADER|NAV|FOOTER)$/.test(n.tagName) || /^(banner|navigation|contentinfo|search)$/i.test(n.getAttribute('role') || '')) break;
    if (aaCountVisible(n) >= 3 || aaOwnTokens(n).some(function (k) { return ['apply','application','candidate','applicant','resume'].indexOf(k) !== -1; })) return { node: n, isForm: false };
  }
  return null;
}
function aaScoreRoot(root) {
  if (AA_ROOT_CACHE.has(root)) return AA_ROOT_CACHE.get(root);
  var score = 0, why = [], own = aaOwnTokens(root);
  function add(n, reason) { score += n; why.push(reason); }
  if ((root.getAttribute('role') || '').toLowerCase() === 'search') add(-99, 'role=search');
  if (root.tagName === 'FORM' && (root.getAttribute('method') || 'get').toLowerCase() === 'get' && /search|find|results|query|\?q=|jobs\b/i.test(root.getAttribute('action') || '')) add(-3, 'GET search action');
  // Clearly named unrelated widgets are hard exclusions, not offset by file/identity points.
  own.forEach(function (k) { if (AA_WIDGET_NEG.indexOf(k) !== -1) add(-99, 'token:' + k); });
  var all = collectControls(root), ctrls = all.filter(function (c) { return !aaControlSkipReason(c, {allowFiles:true}); });
  var btn = Array.from(root.querySelectorAll('button,[type="submit"],[role="button"]')).filter(aaReallyVisible)
    .map(function (b) { return (b.textContent || b.value || b.getAttribute('aria-label') || '').trim().toLowerCase(); });
  var apply = own.some(function (k) { return ['apply','application','candidate','applicant','resume'].indexOf(k) !== -1; });
  if (btn.some(function (b) { return /^(submit application|apply(?: now| for .+)?|next|continue|send application|save and continue)$/.test(b); })) { add(1, 'apply button'); apply = true; }
  if (apply) add(1, 'application signal');
  if (ctrls.length === 1 && !apply) add(-3, 'single-field');
  if (all.some(function (c) { return c.type === 'password' && aaReallyVisible(c); }) && all.length <= 4) add(-99, 'login-shaped');
  if (btn.some(function (b) { return /^(search|go|find|subscribe|sign up for.*|join|apply filters?|update results|filter|sign in|log in|pay.*|checkout)$/.test(b); })) add(-99, 'non-application button');
  var id = ctrls.filter(function (c) { var m = AutoApplyMatcher.match({text:getLabelText(c),attr:getAttrText(c)}); return m.key && /^(personal|address|links)\./.test(m.key) && m.score >= 0.85; }).length;
  if (id >= 2) add(2, 'identity fields x' + id);
  if (ctrls.some(function (c) { return c.type === 'file'; })) add(2, 'visible file upload');
  var res = {score:score,why:why}; AA_ROOT_CACHE.set(root,res); return res;
}
function aaOrphanBlocked(el, stopRoot) {
  for (var n = aaParent(el), d = 0; n && n !== document.body && d < 8; n = aaParent(n), d++) {
    if (n === stopRoot) break;
    if (/^(HEADER|NAV|FOOTER)$/.test(n.tagName) || /^(banner|navigation|contentinfo|search)$/i.test(n.getAttribute('role') || '')) return 'site-chrome';
    if (aaCountVisible(n) > 6) break;
    if (aaOwnTokens(n).some(function (k) { return AA_WIDGET_NEG.indexOf(k) !== -1; })) return 'widget-token';
  }
  return null;
}
