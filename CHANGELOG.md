# Changes

## 1.25.2 — modular maintenance refactor

- Split the large DOM, fill, panel, job-search, options, AI, and stylesheet files into focused modules.
- Keep every JS/CSS/HTML code file under a 300-line hard limit; the largest is 262 lines.
- Make `config/modules.json` the single dependency-order source for manifest, popup fallback, options HTML, and background imports.
- Add synchronization and architecture checks, development npm scripts, and a CI workflow.
- Preserve original JavaScript statements and CSS cascade order; retain existing helper APIs and execution contexts.
- Add real Manifest V3 smoke coverage for background imports, options/profile save, popup module lists, and content-script full fill.
- Preserve the existing 22 eligibility/browser regressions and unit/query tests.
- Remove obsolete generated graph-analysis output and the outdated one-shot content splitting utility from the distributable.

See `ARCHITECTURE.md` for module ownership, change workflow, tests, and unchanged limitations.
