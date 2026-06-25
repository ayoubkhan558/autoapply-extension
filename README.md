# AutoApply — Form Autofiller (Chrome Extension)

A Manifest V3 Chrome extension that autofills web forms and **job applications** from a
profile you store locally as **JSON**. No build step, no servers, privacy-first.

## Install (Load unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `autoapply-extension` folder.
4. Pin the **AutoApply** icon to your toolbar.

## Set up your data

1. Click the AutoApply icon → **Edit profile data**, or right-click the icon → **Options**.
2. Fill in your details (personal, links, professional, education).
3. Click **Save**. Data is stored as JSON in `chrome.storage.local` on your device.

### JSON backend

- The default data shape lives in `data/profile.default.json`.
- On first run it is copied into local storage and becomes your editable backend.
- In Options, use **Toggle raw JSON** to edit the backend JSON directly, or
  **Export JSON** / **Import JSON** to back up and move profiles between machines.
- Supports **multiple profiles** (e.g. "Frontend", "Full-Stack") — switch from the popup.
- **Experience** and **Education** are repeatable: click **+ Add** to add as many entries as you need (Remove to delete). The most recent / top entry is what gets used for autofill.
- Add your own **Custom fields**: give each a label, a value, and comma-separated **match keywords** that the autofiller looks for in a field's label, name, id, or placeholder.
- Many more built-in fields now ship by default (middle/preferred name, DOB, gender, nationality, pronouns, extra social links, current salary, available start date, security clearance, skills, references, and more).

## Import from a resume (AI)

Auto-fill your profile from a PDF or DOCX resume:

1. Open **Options**.
2. Pick an **AI provider** (Google Gemini, Groq, or OpenRouter), paste a **free API key**, and click **Save key**. You can store a key for each provider and switch anytime.
3. Choose your **resume file** (PDF/DOCX) and click **Import resume with AI**.
4. Review the imported fields, then **Save**.

Notes:
- The resume text (or, for Gemini, the PDF itself) is sent to the provider you choose to extract fields. Everything else stays local.
- Free keys: Gemini (aistudio.google.com), Groq (console.groq.com), OpenRouter (openrouter.ai). After saving your key, the **Model** dropdown loads the models your account can use; pick one (a free default is preselected).
- Text is extracted in-browser with no external libraries. Scanned/image PDFs work best with Gemini.

## Use it

On any form (job application, sign-up, etc.):

- Click the AutoApply icon → **Fill this page**, **or**
- Right-click the page → **AutoApply: fill this form**, **or**
- Press **Alt+Shift+F**.

Filled fields flash with a purple outline. The extension **never submits** the form —
you always review first. Existing non-empty fields are left untouched.

### After filling — results panel

When a fill finishes, a panel appears in the **top-right** of the page showing:

- **how many fields were filled**, and
- **which fields still need attention** — including empty text inputs, unselected
  dropdowns (native **and** custom widgets), unanswered required radio groups, and
  required checkboxes. Required items are listed first and marked with `*`.
- a **✍️ Fix remaining with AI** button that uses your AI provider to answer the
  remaining open-ended questions from your profile.

### Fill only some fields (drag to select)

Click the AutoApply icon → **🖱️ Select fields to fill**, then **drag a box** over the
fields you want. Only fields inside the box are filled. Press **Esc** to cancel.

### Analyze a job

Click the AutoApply icon → **🎯 Analyze this job** for an AI match score, an effort
estimate, and a salary read on the current posting.

### Generate an email & cover letter

On a job posting, click the AutoApply icon → **Email & cover letter**. AutoApply
reads the posting, combines it with your active profile, and drafts a ready-to-send
**application email** (with a subject line) and a tailored **cover letter** right in
the on-page panel. Each block has a **Copy** button and is fully editable before you
send it. Requires an AI key (set one in Options).

## Form detection

When a page loads, AutoApply quietly checks whether it contains a fillable form
(ignoring search boxes and hidden fields). If it does, the toolbar icon shows a small
**badge with the number of fillable fields**, and opening the popup confirms it.

This runs **only where you allow it**. In **Options → Form detection** you can:

- turn auto-detection **on/off**,
- set an **allowlist** (detect *only* on these domains — empty means everywhere), and
- set a **blocklist** (never detect on these domains; the blocklist always wins).

Domain entries match subdomains, so `greenhouse.io` also covers `boards.greenhouse.io`.

## How matching works

`lib/matcher.js` holds a dictionary mapping each profile key to label/attribute
synonyms. For every field, `content.js` builds a signature from its `<label>`,
`aria-label`, `placeholder`, `name`, `id`, and `autocomplete`, scores it against the
dictionary, and fills the best match. Values are set with native setters and
`input`/`change`/`blur` events are dispatched so **React / Vue** controlled inputs
register the change.

## File structure

```
autoapply-extension/
├─ manifest.json
├─ background.js          # context menu, keyboard command, JSON seeding
├─ content.js             # field detection + filling
├─ content.css            # highlight style
├─ data/profile.default.json   # JSON backend (default shape)
├─ lib/
│  ├─ matcher.js          # synonym dictionary + scorer
│  └─ storage.js          # load/save JSON helpers
├─ popup/  popup.html · popup.js · popup.css
├─ options/ options.html · options.js · options.css
└─ icons/  icon16.png · icon48.png · icon128.png
```

## Notes & next steps

- Works on standard forms and common ATS (Greenhouse, Lever, etc.). Highly custom
  React widgets (e.g. Workday dropdowns) may need per-ATS handlers in a `content/ats/`
  folder.
- File inputs (resume upload) cannot be set programmatically by any extension for
  security reasons; attach those manually.
- Free-API hooks (address autocomplete via Nominatim, country/state via REST Countries,
  AI answers via a free LLM key) can be added in `background.js` as a proxy layer.

## Adding a new field

All autofill fields live in **one place**: `lib/fields.js` (the `AA_FIELD_DEFS`
registry). To add a field, add a single entry, for example:

```js
{ group: "personal", name: "maidenName", label: "Maiden name",
  words: ["maiden name", "birth surname"], attrs: ["maidenname"] }
```

That one entry automatically (a) shows the input in the Options form, (b) is
saved into your profile JSON, (c) is flattened by the content script, and (d) is
matched on web forms using the `words` (visible-label synonyms) and `attrs`
(name/id synonyms) you provide. Use `long: true` for a textarea and `list: true`
for array fields edited as comma-separated text. To add a whole new repeating
section (like "projects"), add it to `AA_REPEATER_GROUPS` and add its fields with
that group name. No other file needs editing.

## Changelog

- **1.17.0** — The "Form detected" toast now shows which profile will be used ("Will fill using: <profile>"), and the right-click context menu now reads "Autofill this form with <profile>" so you always know which profile is active before filling. Both stay in sync when you switch or rename profiles.
- **1.16.0** — Fixed **Add profile**: a new profile now starts completely empty instead of copying Profile 1's data. All sections (personal, links, professional, the repeating sections, and custom fields) begin blank so you can fill in the new profile from scratch.
- **1.15.0** — **Select fields to fill** now checks the whole form for empty fields when reporting results. Previously it only looked at the fields you boxed, so filling 2 of many fields would wrongly say "No empty fields detected"; now it lists every remaining empty field on the form (e.g. Email, Phone) so a partially-completed form is never shown as ready to submit.
- **1.14.0** — Fixed the full-page **Fill this page** result panel: it no longer says "No empty fields detected" when the form is only partially filled. Empty fields are now always reported (with a fallback name when no label can be read), so a partially-filled form is never reported as complete.
- **1.13.0** — **Select fields to fill** now also fills custom (non-native) dropdown widgets inside the box (React/Workday/Greenhouse-style menus), not just plain inputs, and any selected widget it can't complete is listed in the result panel. Replaced the remaining emojis in the on-page panels (✅ result, effort dots, section headings, Fix-with-AI button) with crisp inline SVG icons to match the popup and toast.
- **1.12.0** — Fixed **Select fields to fill**: the result panel now accurately lists every selected field that was left empty (it previously said "No empty fields detected" even when some picked fields weren't filled). Unfilled selected fields are reported reliably, including ones without a clear label, so you can finish them or use **Fix remaining with AI**.
- **1.11.0** — New **Email & cover letter** generator: from any job posting, AutoApply drafts a tailored application email (with subject line) and a full cover letter from your profile, shown in an editable on-page panel with one-click copy. Uses your configured AI provider.
- **1.10.0** — Big schema expansion plus a single source of truth for fields. Every field now lives in one registry (`lib/fields.js`): add one entry and it appears in the Options form, the saved JSON, and the form matcher. Added many new fields (alternate email, WhatsApp, current/permanent address, marital status, CNIC, veteran/disability/ethnicity, emergency contact, professional summary, career objective, per-stack experience years, languages & tools, full salary details, employment preferences, timezone, and more) and four new repeating sections: **Projects**, **Certifications**, **Awards**, and **Volunteering**. The codebase is now thoroughly commented throughout.
- **1.9.0** — Popup quick tools: a per-site "Last filled here …" reminder (with field count), one-click copy buttons for email and phone, and a CV/resume filename badge. CV/resume is now stored per profile, so each profile can carry its own document. Also added a small AI button beside form fields to fill a single field on demand (from your profile, or via AI for open-ended questions).
- **1.8.0** — The detection toast now appears for forms embedded in iframes (Greenhouse, Lever, Ashby, Workday, etc.) and re-checks several times to catch late-rendering / single-page-app forms. The toolbar badge aggregates the fillable-field count across all frames.
- **1.7.0** — Settings redesign with a left sidebar and full-width layout; emojis across the popup and detection toast replaced with crisp inline SVG icons.
- **1.6.0** — The on-page detection toast now shows an estimated "time to apply manually" (based on the field count) and an Apply now / Fill form now button right in the page viewport.
- **1.5.0** — Form detection now shows an on-page toast when a form is found, naming it a "Form" or "Job application form" and listing the number of fillable fields, with a Fill now button. It auto-dismisses and respects the detection allow/block settings.
- **1.4.0** — Copy cleanup: use plain "resume" instead of "résumé", and trim marketing/filler wording across the popup, options, manifest, and README.
- **1.3.0** — **Settings redesign**: Options is now organized into **tabs** — *Profile*, *API & resume*, and *Form detection* — each with the extension icon in the header. The profile fields use a responsive **3-column grid** (CSS Grid `auto-fit` + `minmax`, so it reflows by available width with almost no media queries), and the popup header now shows the extension **icon** plus a ⚙️ **settings** button. CSS was refactored to **BEM** naming.
- **1.2.0** — **Form detection**: the extension now checks each page for a fillable form and shows a **count badge** on the toolbar icon (and a line in the popup: “✓ Form detected — N fillable field(s)”). Detection only runs where you allow it — a new **Form detection** section in Options lets you turn it off or restrict it with site allow/block lists.
- **1.1.0** — Post-fill results panel (filled count + remaining fields, now including
  dropdowns, radio groups, and required checkboxes, with a **Fix remaining with AI**
  button); **drag-to-select** fill; an **Edit profile** button in the popup; and
  broader field-matching synonyms (e.g. *Desired Pay*, *Date Available*,
  *State / Province*, *Country of residence*, *Notice period*).
- **1.0.0** — Initial release: JSON profile backend, multiple profiles, resume → profile
  AI import, job analysis, and form autofill.
