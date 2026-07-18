# Graph Report - autoapply-extension  (2026-07-18)

## Corpus Check
- 15 files · ~30,299 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 333 nodes · 693 edges · 16 communities (15 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `76c177a1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- options.js
- manifest.json
- content.js
- aaEl
- ai.js
- AutoApply — Form Autofiller (Chrome Extension)
- getLabelText
- storage.js
- extract.js
- aaFillSingleField
- fields.js
- popup.js
- background.js
- aaSetupFieldAi
- matcher.js
- test_fixes.js

## God Nodes (most connected - your core abstractions)
1. `getLabelText()` - 19 edges
2. `norm()` - 17 edges
3. `run()` - 17 edges
4. `renderForm()` - 17 edges
5. `init()` - 17 edges
6. `getAttrText()` - 15 edges
7. `aaEl()` - 15 edges
8. `fillCustomSelects()` - 14 edges
9. `aaFillSingleField()` - 13 edges
10. `Apple — Style Reference` - 13 edges

## Surprising Connections (you probably didn't know these)
- `init()` --references--> `AA_DEFAULT_BLOCKED_SITES`  [EXTRACTED]
  options/options.js → lib/storage.js

## Import Cycles
- None detected.

## Communities (16 total, 1 thin omitted)

### Community 0 - "options.js"
Cohesion: 0.14
Nodes (38): AA_DEFAULT_JOB_KEYWORDS, AA_TAB_ICONS, aaFileToDataUrl(), aaMergeIntoProfile(), aaMergeObj(), aaReadInputValue(), aaSendMessage(), aaStrObj() (+30 more)

### Community 1 - "manifest.json"
Cohesion: 0.06
Nodes (34): action, default_icon, default_popup, background, service_worker, commands, fill-form, content_scripts (+26 more)

### Community 2 - "content.js"
Cohesion: 0.09
Nodes (74): aaAiNote(), aaCollectQuestions(), aaCountFillable(), aaFieldLabelOf(), aaFillContext(), aaFillSingleField(), aaFindAddButton(), aaIsAiTextField() (+66 more)

### Community 3 - "aaEl"
Cohesion: 0.18
Nodes (23): aaAppBlock(), aaCopyText(), aaDot(), aaEffortScore(), aaEl(), aaIcon(), aaJobText(), aaPickJobText() (+15 more)

### Community 4 - "ai.js"
Cohesion: 0.22
Nodes (18): AA_RESUME_PROMPT, aaAnalyzeJob(), aaAnswerQuestions(), aaBuildAnalyzePrompt(), aaBuildAnswerPrompt(), aaBuildApplicationPrompt(), aaBuildResumePrompt(), aaCallProvider() (+10 more)

### Community 5 - "AutoApply — Form Autofiller (Chrome Extension)"
Cohesion: 0.12
Nodes (16): Adding a new field, After filling — results panel, Analyze a job, AutoApply — Form Autofiller (Chrome Extension), Changelog, File structure, Fill only some fields (drag to select), Form detection (+8 more)

### Community 6 - "getLabelText"
Cohesion: 0.06
Nodes (35): Agent Prompt Guide, Apple — Style Reference, Border Radius, Components, CSS Custom Properties, Do, Do's and Don'ts, Don't (+27 more)

### Community 7 - "storage.js"
Cohesion: 0.14
Nodes (7): AA_DEFAULT_BLOCKED_SITES, aaGetResume(), aaLoadData(), aaLoadResumes(), aaMigrate(), aaRemoveResume(), aaSetResume()

### Community 8 - "extract.js"
Cohesion: 0.29
Nodes (11): aaBytesToLatin1(), aaDecodeXmlEntities(), aaDocxXmlToText(), aaExtractDocxText(), aaExtractPdfText(), aaExtractText(), aaFileToBase64(), aaInflate() (+3 more)

### Community 9 - "aaFillSingleField"
Cohesion: 0.22
Nodes (8): Accessibility & Inclusion, Anti-references, Brand Personality, Design Principles, Product, Product Purpose, Register, Users

### Community 13 - "fields.js"
Cohesion: 0.39
Nodes (6): aaFieldDescriptor(), aaFieldKey(), aaFormGroups(), aaMatcherFields(), aaRepeaterFields(), aaRepeaterGroups()

### Community 14 - "popup.js"
Cohesion: 0.38
Nodes (4): BOARDS, init(), setStatus(), withActiveTab()

### Community 15 - "background.js"
Cohesion: 0.33
Nodes (3): aaActiveProfileLabel(), aaTabFrameCounts, aaUpdateMenuTitle()

### Community 16 - "aaSetupFieldAi"
Cohesion: 0.16
Nodes (16): aaCleanHost(), aaCustomKeywords(), aaDetectionAllowed(), aaHideAiBtn(), aaHostAllowed(), aaHostList(), aaJobSignal(), aaMinFields() (+8 more)

### Community 19 - "test_fixes.js"
Cohesion: 0.40
Nodes (4): assert, fs, store, vm

## Knowledge Gaps
- **84 isolated node(s):** `aaTabFrameCounts`, `AA_RESUME_PROMPT`, `manifest_version`, `name`, `version` (+79 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `init()` connect `options.js` to `storage.js`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `AA_DEFAULT_BLOCKED_SITES` connect `storage.js` to `options.js`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `init()` (e.g. with `onFieldInput()` and `onRawBlur()`) actually correct?**
  _`init()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `aaTabFrameCounts`, `AA_RESUME_PROMPT`, `manifest_version` to the rest of the system?**
  _84 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `options.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13704994192799072 - nodes in this community are weakly interconnected._
- **Should `manifest.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `content.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08900900900900902 - nodes in this community are weakly interconnected._