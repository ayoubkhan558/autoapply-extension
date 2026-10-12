// Lasso interaction and box-scoped fill coordinator.
// Classic-script module; dependency order is declared in config/modules.json.
var aaLassoActive = false;
function startLasso() {
  if (aaLassoActive) return;
  aaLassoActive = true;
  const overlay = document.createElement("div");
  overlay.id = "aa-lasso-overlay";
  const hint = document.createElement("div");
  hint.id = "aa-lasso-hint";
  hint.textContent = "Drag a box over the fields you want to fill • Esc to cancel";
  const rect = document.createElement("div");
  rect.id = "aa-lasso-rect";
  rect.style.display = "none";
  overlay.appendChild(rect);
  document.documentElement.appendChild(overlay);
  document.documentElement.appendChild(hint);
  let sx = 0, sy = 0, dragging = false;
  function cleanup() {
    aaLassoActive = false;
    if (overlay.parentNode) overlay.remove();
    if (hint.parentNode) hint.remove();
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); cleanup(); } }
  document.addEventListener("keydown", onKey, true);
  overlay.addEventListener("mousedown", function (e) {
    dragging = true; sx = e.clientX; sy = e.clientY;
    rect.style.display = "block";
    rect.style.left = sx + "px"; rect.style.top = sy + "px"; rect.style.width = "0px"; rect.style.height = "0px";
    e.preventDefault();
  });
  overlay.addEventListener("mousemove", function (e) {
    if (!dragging) return;
    const x = Math.min(e.clientX, sx), y = Math.min(e.clientY, sy);
    rect.style.left = x + "px"; rect.style.top = y + "px";
    rect.style.width = Math.abs(e.clientX - sx) + "px"; rect.style.height = Math.abs(e.clientY - sy) + "px";
  });
  overlay.addEventListener("mouseup", function (e) {
    if (!dragging) return;
    dragging = false;
    const box = { left: Math.min(e.clientX, sx), top: Math.min(e.clientY, sy), right: Math.max(e.clientX, sx), bottom: Math.max(e.clientY, sy) };
    cleanup();
    if (box.right - box.left < 6 && box.bottom - box.top < 6) return;
    fillWithinBox(box);
  });
}

function fillWithinBox(box) { return aaWithSubmitGuard(function () { return aaFillWithinBox(box); }); }
async function aaFillWithinBox(box) {
  const ctx = await aaFillContext();
  if (!ctx) { aaShowFillResult(0, []); return; }
  const selected = aaEligibleControls({box:box}).controls;
  let filled = 0;
  // Track the exact elements we successfully filled so the "still needs
  // attention" list can report every OTHER selected field accurately,
  // instead of relying on the temporary highlight class or label text.
  const filledEls = [];
  planText(selected, ctx.flat, ctx.customFields).forEach(function (p) { if (applyTextValue(p.el, p.value, p.score)) { filled++; filledEls.push(p.el); } });
  planRadios(selected, ctx.flat, ctx.customFields).forEach(function (p) { if (applyCheck(p.el, p.score)) { filled++; filledEls.push(p.el); } });
  planCheckboxes(selected, ctx.skillTokens).forEach(function (p) { if (applyCheck(p.el, p.score)) { filled++; filledEls.push(p.el); } });
  // Custom (non-native) dropdown widgets inside the box, e.g. React/Workday.
  try { filled += await fillCustomSelects(ctx, box, filledEls); } catch (e) { /* ignore */ }
  // Report empty fields across the WHOLE form (not just the boxed selection),
  // so a partially-completed form is never shown as "ready to submit". The
  // fields we just filled carry the highlight class and are skipped.
  aaShowFillResult(filled, aaUnfilledFields(null, true));
}

// Within a lasso selection, list every chosen field we could NOT fill and
// that is still empty. Unlike aaUnfilledFields this is scoped strictly to the
// selected elements, uses the actually-filled set (not the fading highlight),
// and never silently drops a field just because its label is blank.
