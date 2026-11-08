> Follow-up status: Import validation, save recovery, pending attachment transitions, per-profile attachment keys, AI timeouts and validation, import/export notices, and safer date and salary filling have been addressed. The findings below describe the original review. Remaining work: provide a separate public release without personal defaults, and introduce dedicated ongoing-employment and immediate-availability controls. Browser-based verification still needs to be run.

# Extension code review

Review scope: profile editing and persistence, imports, attachment lifecycle, background messaging, AI transport, manifest exposure, and autofill submission guards. Static findings below are distinguished from executed tests; this is not an exhaustive security audit.

## Highest priorities

1. **Validate imported data before replacing working state.** `lib/storage.js:aaMigrate` accepts missing profiles and mutates arbitrary nested objects. `options/profile-save.js:onRawInput/onRawBlur` assigns its result directly to DATA. Valid JSON such as `{}` or profiles containing null can break rendering. File import checks only the outer array. Build a single schema validator for raw JSON, file imports, and AI output; validate a copy and commit only after success. Verify empty arrays, duplicate IDs, unknown active IDs, null records, and wrong field types.
2. **Make saves recoverable.** `options/profile-save.js:save` disables the button before awaited attachment conversion/storage and has no catch/finally. Quota, extraction, or storage failure leaves Saving displayed indefinitely. Restore controls in finally, report the failed operation, and retain pending files until profile and attachment writes succeed. Capture the destination profile ID before awaiting to avoid saving onto another profile if the user switches during conversion.
3. **Clear pending attachments for every profile transition.** Existing select/delete handlers clear pending files, but add/duplicate/import paths do not consistently do so. A pending resume can be attached to the wrong candidate. Consolidate profile transitions and test switching with unsaved files.
4. **Keep personal defaults out of public distributions.** This requested local build contains personal identifiers and contact details in the bundled JSON. Web-accessible exposure was removed in this change; distributing the extension directory or publishing the repository still distributes that file. A public build should ship an empty template and import personal defaults locally.

## Reliability and accuracy

5. **Bound AI requests.** `lib/ai/provider.js` and `lib/ai/models.js` call fetch without timeout/cancellation. Add an AbortController deadline, bounded retry for transient failures, and actionable provider errors. Avoid retrying authentication failures. Test slow responses and malformed JSON.
6. **Validate repaired AI output.** `aaParseJsonLoose` repairs truncated JSON, which can turn an incomplete response into apparently valid partial data. Require schema validation and present a merge preview before changing the profile. Distinguish incomplete data from intentionally empty values.
7. **Protect concurrent attachment updates.** `lib/storage.js` attachment setters read an entire map, edit one entry, then write the whole map. Two options windows saving different profiles can overwrite each other. Store attachments under per-profile keys or serialize writes through the background worker.
8. **Make date precision explicit.** The editor now preserves month precision with month controls and education years with numeric fields. Legacy Immediate/Present values remain editable as text. A later schema should separate ongoing employment and immediate availability from calendar dates; test date conversion against ATS month/year widgets.
9. **Strengthen import and export UX.** Import replaces the in-memory dataset, and export contains profile text but no stored attachments. Preview replacement counts, offer merge by stable ID, and clearly identify whether a backup includes resumes/photos.

## Existing strengths and test gaps

The field registry keeps matching and form definitions aligned. Submission guards reject submit buttons and links and intercept submit events. These are useful protections but do not prove that arbitrary third-party click handlers cannot submit using custom requests. Continue testing representative ATS workflows without automatic submission.

Architecture and unit tests pass. Browser tests are environment-dependent; see the task response for actual execution results. Added regression coverage checks month preservation, reordering, invalid email rejection, and reversed date rejection. Expand with storage failure recovery, malformed raw imports, pending-file transitions, and two-window editing before adding broader automation.
