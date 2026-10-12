// Full-fill coordinator; delegates to focused planners and appliers.
// Classic-script module; dependency order is declared in config/modules.json.
function run() { return aaWithSubmitGuard(aaRunFill); }
async function aaRunFill() {
  const ctx = await aaFillContext();
  if (!ctx) return { filled: 0, error: "no-profile" };
  const controls = aaEligibleControls().controls;
  let filled = 0;
  planText(controls, ctx.flat, ctx.customFields).forEach(function (p) {
    if (applyTextValue(p.el, p.value, p.score)) filled++;
  });
  planRadios(controls, ctx.flat, ctx.customFields).forEach(function (p) {
    if (applyCheck(p.el, p.score)) filled++;
  });
  planCheckboxes(controls, ctx.skillTokens).forEach(function (p) {
    if (applyCheck(p.el, p.score)) filled++;
  });
  try { filled += await fillCustomSelects(ctx); } catch (e) { /* ignore */ }
  try { filled += await fillRepeaterSections(ctx); } catch (e) { /* ignore */ }
  const resume = await planResume();
  if (resume) { try { if (await (resume.gform ? applyGformFile(resume) : applyResume(resume))) filled++; } catch (e) { /* ignore */ } }
  const photo = await planPhoto();
  if (photo) { try { if (await (photo.gform ? applyGformFile(photo) : applyResume(photo))) filled++; } catch (e) { /* ignore */ } }
  const cover = await planCoverLetter();
  if (cover) { try { if (await (cover.gform ? applyGformFile(cover) : applyResume(cover))) filled++; } catch (e) { /* ignore */ } }
  try { aaShowFillResult(filled, aaUnfilledFields(null, true)); } catch (e) { /* ignore */ }
  if (filled > 0) { try { aaRecordFill(aaTopHost(), filled); } catch (e) { /* ignore */ } }
  return { filled: filled };
}
