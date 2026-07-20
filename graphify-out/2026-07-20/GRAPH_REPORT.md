# Graph Report - autoapply-extension  (2026-07-20)

## Corpus Check
- 21 files · ~32,062 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 366 nodes · 621 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `799227c6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- options.js
- manifest.json
- aaEl
- ai.js
- AutoApply — Form Autofiller (Chrome Extension)
- getLabelText
- storage.js
- extract.js
- aaFillSingleField
- panel.js
- fill.js
- split-content.js
- fields.js
- popup.js
- background.js
- aaSetupFieldAi
- matcher.js
- field-ai.js
- test_fixes.js

## God Nodes (most connected - your core abstractions)
1. `init()` - 18 edges
2. `renderForm()` - 17 edges
3. `Apple — Style Reference` - 13 edges
4. `aaEl()` - 12 edges
5. `Components` - 12 edges
6. `collectForm()` - 11 edges
7. `AutoApply — Form Autofiller (Chrome Extension)` - 11 edges
8. `run()` - 10 edges
9. `runAnswerQuestions()` - 10 edges
10. `activeProfile()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `init()` --references--> `AA_DEFAULT_BLOCKED_SITES`  [EXTRACTED]
  options/options.js → lib/storage.js
- `init()` --references--> `AA_DEFAULT_JOB_KEYWORDS`  [EXTRACTED]
  options/options.js → lib/storage.js
- `init()` --references--> `AA_DEFAULT_JOB_ROLES`  [EXTRACTED]
  options/options.js → lib/storage.js
- `aaJobSignal()` --references--> `AA_DEFAULT_JOB_ROLES`  [EXTRACTED]
  content/detect.js → lib/storage.js

## Import Cycles
- None detected.

## Communities (20 total, 1 thin omitted)

### Community 0 - "options.js"
Cohesion: 0.15
Nodes (39): AA_TAB_ICONS, aaDataUrlToBase64(), aaFileToDataUrl(), aaMergeIntoProfile(), aaMergeObj(), aaReadInputValue(), aaSendMessage(), aaStoredToFile() (+31 more)

### Community 1 - "manifest.json"
Cohesion: 0.06
Nodes (35): action, default_icon, default_popup, background, service_worker, commands, fill-form, content_scripts (+27 more)

### Community 3 - "aaEl"
Cohesion: 0.09
Nodes (38): aaNextMonthFirstDate(), aaText(), applyCheck(), applyResume(), applyTextValue(), buildFlat(), checkEl(), commitSelect() (+30 more)

### Community 4 - "ai.js"
Cohesion: 0.21
Nodes (19): AA_RESUME_PROMPT, aaAnalyzeJob(), aaAnswerQuestions(), aaBuildAnalyzePrompt(), aaBuildAnswerPrompt(), aaBuildApplicationPrompt(), aaBuildResumePrompt(), aaCallProvider() (+11 more)

### Community 5 - "AutoApply — Form Autofiller (Chrome Extension)"
Cohesion: 0.12
Nodes (16): Adding a new field, After filling — results panel, Analyze a job, AutoApply — Form Autofiller (Chrome Extension), Changelog, File structure, Fill only some fields (drag to select), Form detection (+8 more)

### Community 6 - "getLabelText"
Cohesion: 0.06
Nodes (35): Agent Prompt Guide, Apple — Style Reference, Border Radius, Components, CSS Custom Properties, Do, Do's and Don'ts, Don't (+27 more)

### Community 7 - "storage.js"
Cohesion: 0.11
Nodes (9): AA_DEFAULT_BLOCKED_SITES, AA_DEFAULT_JOB_KEYWORDS, aaGetResume(), aaGetResumeText(), aaLoadData(), aaLoadResumes(), aaMigrate(), aaRemoveResume() (+1 more)

### Community 8 - "extract.js"
Cohesion: 0.29
Nodes (11): aaBytesToLatin1(), aaDecodeXmlEntities(), aaDocxXmlToText(), aaExtractDocxText(), aaExtractPdfText(), aaExtractText(), aaFileToBase64(), aaInflate() (+3 more)

### Community 9 - "aaFillSingleField"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 10 - "panel.js"
Cohesion: 0.17
Nodes (31): aaAppBlock(), aaCollectQuestions(), aaCopyText(), aaDot(), aaEffortScore(), aaEl(), aaIcon(), aaIsQuestionField() (+23 more)

### Community 11 - "fill.js"
Cohesion: 0.18
Nodes (21): aaFillContext(), aaFindAddButton(), aaIsHidden(), aaLoadActiveCoverLetter(), aaLoadActivePhoto(), aaLoadActiveResume(), aaMenuId(), aaRepeaterEmpties() (+13 more)

### Community 12 - "split-content.js"
Cohesion: 0.12
Nodes (13): body, end, fs, iDetect, iDetectTimers, iFieldAi, iFill, iListener (+5 more)

### Community 13 - "fields.js"
Cohesion: 0.39
Nodes (6): aaFieldDescriptor(), aaFieldKey(), aaFormGroups(), aaMatcherFields(), aaRepeaterFields(), aaRepeaterGroups()

### Community 14 - "popup.js"
Cohesion: 0.38
Nodes (4): BOARDS, init(), setStatus(), withActiveTab()

### Community 15 - "background.js"
Cohesion: 0.32
Nodes (5): aaActiveProfileLabel(), aaAiOpts(), aaAiReply(), aaTabFrameCounts, aaUpdateMenuTitle()

### Community 16 - "aaSetupFieldAi"
Cohesion: 0.25
Nodes (15): aaCleanHost(), aaCountFillable(), aaCustomKeywords(), aaCustomRoles(), aaDetectionAllowed(), aaHostAllowed(), aaHostList(), aaJobSignal() (+7 more)

### Community 18 - "field-ai.js"
Cohesion: 0.49
Nodes (9): aaAiNote(), aaFillSingleField(), aaHideAiBtn(), aaIsAiField(), aaPositionAiBtn(), aaScheduleHideAiBtn(), aaSetJobFormDetected(), aaSetupFieldAi() (+1 more)

### Community 19 - "test_fixes.js"
Cohesion: 0.40
Nodes (4): assert, fs, store, vm

## Knowledge Gaps
- **97 isolated node(s):** `aaTabFrameCounts`, `AA_RESUME_PROMPT`, `manifest_version`, `name`, `version` (+92 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `init()` connect `options.js` to `aaSetupFieldAi`, `storage.js`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `AA_DEFAULT_JOB_ROLES` connect `aaSetupFieldAi` to `options.js`, `storage.js`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `init()` (e.g. with `onFieldInput()` and `onRawBlur()`) actually correct?**
  _`init()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `aaTabFrameCounts`, `AA_RESUME_PROMPT`, `manifest_version` to the rest of the system?**
  _97 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `aaEl` be split into smaller, more focused modules?**
  _Cohesion score 0.08970099667774087 - nodes in this community are weakly interconnected._
- **Should `AutoApply — Form Autofiller (Chrome Extension)` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._