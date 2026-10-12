// Safe-click checks and reference-counted submit-event guards.
// Classic-script module; dependency order is declared in config/modules.json.
function aaCanSafeClick(el) {
  if (!el || !aaReallyVisible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
  var tag=el.tagName, type=(el.type || '').toLowerCase();
  if (type === 'submit' || type === 'image') return false;
  var ownerButton = el.closest('button');
  if (ownerButton && (ownerButton.getAttribute('type') || '').toLowerCase() !== 'button') return false;
  if (el.closest('input[type="submit"],input[type="image"]')) return false;
  // Refuse default/invalid button types even outside forms (SPA handlers).
  if (tag === 'BUTTON' && (el.getAttribute('type') || '').toLowerCase() !== 'button') return false;
  // No links, including javascript: links; click options only on controls.
  if (el.closest('a[href]')) return false;
  return true;
}
function aaSafeClick(el) { if (!aaCanSafeClick(el)) return false; return aaWithSubmitGuard(function () { el.click(); return true; }); }
var AA_SUBMIT_GUARDS = 0, AA_SUBMIT_BLOCK = function (e) { e.preventDefault(); e.stopImmediatePropagation(); };
function aaWithSubmitGuard(fn) {
  if (AA_SUBMIT_GUARDS++ === 0) document.addEventListener('submit', AA_SUBMIT_BLOCK, true);
  function done() { setTimeout(function () { if (--AA_SUBMIT_GUARDS === 0) document.removeEventListener('submit', AA_SUBMIT_BLOCK, true); }, 1500); }
  try { var r=fn(); if (r && typeof r.then === 'function') return Promise.resolve(r).finally(done); done(); return r; }
  catch (e) { done(); throw e; }
}
