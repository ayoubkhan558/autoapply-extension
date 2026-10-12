# AutoApply modular architecture

Version 1.25.2 is a responsibility-based refactor of the supplied 1.25.1 archive.
Every JavaScript, CSS, and HTML source file must remain at or below **300 physical lines**. Prefer roughly 100–200 lines; split by responsibility, not arbitrary line count. The largest current code file is the shared field registry at 262 lines.

## Runtime map

| Location | Responsibility |
| --- | --- |
| `content.js` | Content-script startup and message dispatch |
| `content/dom/` | Labels, controls, native values, dates, phone, currency, profile flattening, matching, appliers |
| `content/eligibility/policy.js` | Token lists, visibility, and per-control exclusions |
| `content/eligibility/roots.js` | Form/group discovery, scoring, and widget boundaries |
| `content/eligibility/index.js` | The shared `aaEligibleControls()` gate |
| `content/safety.js` | Safe clicks and submit-event guard |
| `content/fill/` | Context, text/checkbox planning, radios, uploads, widgets, repeaters |
| `content/fill.js` | Small full-fill coordinator |
| `content/ui/` | Panel, job analysis, generated applications, questions, attention lists, results, lasso |
| `content/job-search/` | Query/presets, modal UI, stored-preference startup |
| `content/styles/` | Ordered injected UI stylesheet modules |
| `content/detect.js`, `content/field-ai.js` | Detection and single-field AI behavior |
| `options/` | Separate state, completeness, form rendering/editing, attachments, feedback, saving, AI settings, CV import, initialization |
| `options/styles/` | Settings shell and editor styles |
| `lib/ai/` | Provider transports/parser, job tasks, model listing |
| `lib/ai.js` | Service-worker AI facade |
| `lib/fields.js`, `lib/matcher.js`, `lib/storage.js`, `lib/extract.js` | Shared registry, scoring, persistence, document extraction |
| `background.js`, `popup/` | Background commands and popup controls |

## Dependency ordering: one source of truth

Edit **`config/modules.json`** when adding, removing, or reordering runtime files. It defines the ordered script/style lists for content scripts, popup, options, and background.

```sh
npm run sync
npm run check
```

`sync` regenerates manifest content lists, options/popup HTML lists, background AI imports, and `lib/modules.js` (used by popup fallback injection). Do not manually change generated lists. The committed extension is directly installable; end users do not need Node or a build step.

The checker catches files over 300 lines, JS syntax errors, CSS parse errors, invalid JSON, duplicate/missing module entries, duplicate lexical declarations across each script context, unlisted runtime JS/CSS files, missing HTML assets, incorrect bootstrap positions, and loader drift.

## Module contracts

- Chrome Manifest V3 content scripts are **ordered classic scripts**, not native ES modules. This retains the original extension's isolated-world execution model without introducing a bundler or exposing content code to page scripts.
- Existing helper names are retained so this refactor does not rewrite matching or fill logic. Global names are shared only within their extension execution context; options/popup/service-worker contexts remain separate.
- Dependency order is explicit in the configuration. Registry/storage/helpers load before consumers; content/options bootstrap scripts load last.
- Keep orchestration in the small coordinators. Put reusable behavior in the owning domain module; avoid new document-wide scans in unrelated UI files.
- Every fill surface must keep using `aaEligibleControls()` or its `aaIsEligible()` adapter. File/action modes are explicit. Do not duplicate eligibility policy in planners or UI.
- Use `aaSafeClick()` and `aaWithSubmitGuard()` rather than adding unguarded action clicks.
- Add profile fields to `lib/fields.js`, not separate matching/form dictionaries.
- Preserve stylesheet order: overrides intentionally follow base rules.

## Development and tests

Node 20+ is required for development checks; CI uses Node 24.

```sh
npm install
npx playwright install chromium
npm test
```

For an existing Chromium installation, set `CHROMIUM_PATH` to its executable before running browser tests. Tests are local and use synthetic data; no live job sites or external AI calls are needed.

- `npm run check`: architecture/size/syntax/loader checks.
- `npm run test:unit`: existing storage, matching-related, and job-query checks.
- `npm run test:browser`: 22 eligibility fixtures plus four real MV3 entry-point smoke tests.
- `.github/workflows/check.yml`: runs the same checks on pushes and pull requests.

When adding a feature: choose its domain, add a focused module if needed, declare dependencies, run `sync`, add a regression case, and run `npm test`. If a file approaches the cap, extract a cohesive responsibility; do not compress/minify it to evade the limit.

## Scope and unchanged limitations

This release changes organization and loaders, not application eligibility or product behavior. Original JavaScript statements and CSS rule/cascade ordering were verified preserved during extraction. Existing privacy/safety limitations, including all-frame broadcasting, AI payload composition, and the inability to block every site-driven/direct submission, are unchanged. Generated `graphify-out` analysis artifacts and the obsolete one-shot splitting script were omitted from the distributable; neither was needed by the extension.
