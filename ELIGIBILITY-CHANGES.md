# AutoApply 1.25.1 — eligibility integration

## Implemented

- Shared `aaEligibleControls()` in `content/dom.js` used by full fill, lasso, detection count, remaining-fields lists, batch questions, and per-field AI.
- Specialized file/action modes use the same policy; no page-wide upload/repeater bypass. Automatic uploads now require visible, eligible inputs. Unlabeled lone upload inputs are no longer assumed to be resumes.
- Whole-token structural matching, with no typeahead/autosuggest/autocomplete/lookup blacklist. Broad search/filter layout wrappers outside an application root no longer contaminate its fields.
- Disabled/readonly, invisible, inert, hidden-ancestor, off-screen, honeypot, search, credential, payment, other-person contact, and identifiable unrelated-widget exclusions.
- Open shadow-root traversal, including host visibility. CSS-transparent native choices require a genuinely visible associated label.
- Explicit labels take precedence; label fallback no longer borrows labels wrapping another control.
- Required consent boxes remain visible in the attention list but are never automatically ticked. Skills checkboxes still fill.
- Native and ARIA radios honor the selected eligible controls; lasso cannot sweep in unrelated ARIA groups.
- Safe clicks refuse submit/image inputs, default/invalid-type buttons, their descendants, and links. Repeater add-button patterns are anchored to section actions, not job alerts/search links.
- Custom dropdowns resolve an associated popup, or a single visible listbox/menu; they do not search arbitrary page-wide options. Ambiguous menus are left for manual review.
- AI callback and upload application recheck current eligibility to avoid stale hidden/disabled targets.
- Reference-counted submit-event guard covers full fill, lasso, AI fills, and safe clicks, with a 1.5-second grace period. Overlapping fills do not remove each other's guard.

## Validation

Real Chromium layout tests load the actual extension modules against synthetic HTML, with profile/storage/AI calls stubbed. No live ATS pages, external AI requests, or personal data were used.

```sh
node test_fixes.js
node test_job_search_query.js
node tests/eligibility.browser.cjs
```

Browser tests require Node, the `playwright` package, and a Chromium binary. Set `CHROMIUM_PATH` to your binary path if it differs from `/usr/local/bin/chromium`. These are development-only dependencies, not extension runtime dependencies.

The browser suite covers application/search/newsletter/login/payment separation, visibility and honeypots, whole-token matching, other-person labels, no-form groups, single-step forms, consent, lasso, AI callback rechecks, safe clicks, submit-event cancellation and concurrent guards, visible uploads, shadow hosts, repeaters, dropdown popup scoping, and native/ARIA radios.

## Limits and intentionally unchanged behavior

- This is a heuristic eligibility policy, not reliable proof that a control belongs to the intended application. Ambiguous widgets may require manual filling; plain orphan text controls remain permitted when no exclusion applies.
- Hidden file inputs, untyped add/dropdown buttons, and ambiguous custom menus are deliberately skipped. Some legitimate ATS controls may therefore require manual interaction.
- The submit guard cancels ordinary `submit` events while active. It cannot intercept `form.submit()`, direct fetch/XHR submissions, navigation in site handlers, earlier handlers, or delayed actions after the grace period. “Never submit” is not an absolute security guarantee on arbitrary third-party pages.
- Existing all-frame injection and tab-message broadcasting remain unchanged. This patch is NOT a selected-frame/domain consent policy and does not eliminate cross-origin iframe privacy risks.
- Existing AI profile/resume payload composition remains unchanged. This patch does not implement per-question data minimization.
- Matcher semantics and general AI provider/storage behavior are otherwise preserved.
- Browser-module fixtures passed; installation in Chromium as a Manifest V3 extension and live job-site compatibility have not been tested.

## Install

Extract this archive to a folder. In Chrome/Chromium, open `chrome://extensions`, enable Developer mode, and use **Load unpacked** on that folder. If replacing an existing unpacked installation, update its folder, reload the extension, and refresh target tabs to avoid mixed old/new scripts.
