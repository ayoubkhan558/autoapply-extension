// Single shared eligibility gate for every fill surface.
// Classic-script module; dependency order is declared in config/modules.json.
function aaEligibleControls(opts) {
  opts = opts || {}; AA_ROOT_CACHE = new WeakMap();
  var controls = [], skipped = [];
  var candidates = opts.controls || collectControls(document, true);
  candidates.forEach(function (el) {
    var why = aaControlSkipReason(el, opts);
    var root = !why && aaNearestRoot(el);
    if (!why && root) { var s = aaScoreRoot(root.node); if (s.score < 0) why = (root.isForm ? 'form:' : 'group:') + s.why.join('+'); }
    if (!why) why = aaOrphanBlocked(el, root && root.node);
    // Unscoped rich editors/actions must never become comment/chat targets.
    if (!why && !root && (el.isContentEditable || opts.actions || el.type === 'file' || el.matches(AA_CUSTOM_SELECTOR))) why = 'unscoped-widget';
    if (why) { skipped.push({el:el,reason:why}); return; }
    if (opts.box) { var r=el.getBoundingClientRect(),b=opts.box; if (r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom) return; }
    controls.push(el);
  });
  return {controls:controls,skipped:skipped};
}
function aaIsEligible(el, opts) { return !!el && aaEligibleControls(Object.assign({}, opts, {controls:[el]})).controls.length === 1; }
