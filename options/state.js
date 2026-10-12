// Shared options state, registry views, icons, and profile access.
// Classic-script module; dependency order is declared in config/modules.json.
// The profile form is generated entirely from the shared field registry
// (lib/fields.js). To add a field, edit AA_FIELD_DEFS there — nothing here.
// Each section's `fields` is a list of { name, label, long } descriptors.
const SECTIONS = (typeof aaFormGroups === "function") ? aaFormGroups() : [];

// Repeating sections (experience, education, projects, certifications, awards,
// volunteering) are defined entirely in the shared registry (lib/fields.js).
// Add a section or field there and it appears here automatically.
const REPEATERS = (typeof aaRepeaterGroups === "function") ? aaRepeaterGroups() : [];


let DATA = null;
let lastGoodJson = "";
let rawTimer = null;

let PENDING_CV_FILE = null;
let PENDING_PHOTO_FILE = null;
let PENDING_COVER_LETTER_FILE = null;

  // AA_DEFAULT_BLOCKED_SITES / AA_DEFAULT_JOB_KEYWORDS / AA_DEFAULT_JOB_ROLES
  // come from lib/storage.js (shared with the content script).


const AA_TAB_ICONS = {
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"></path></svg>',
  personal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M13 9h5M13 13h5M5 16c1-2 5-2 6 0"></path></svg>',
  address: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>',
  links: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"></path><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"></path></svg>',
  professional: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
  experience: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"></path></svg>',
  education: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2 9l10 5 10-5-10-5z"></path><path d="M6 11v5c0 1 3 3 6 3s6-2 6-3v-5"></path></svg>',
  projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>',
  certifications: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"></circle><path d="M9 13l-1 8 4-2 4 2-1-8"></path></svg>',
  awards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v5a6 6 0 0 1-12 0z"></path><path d="M9 20h6M12 14v6M4 4h2v3a3 3 0 0 1-2-3zM20 4h-2v3a3 3 0 0 0 2-3z"></path></svg>',
  volunteering: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9z"></path></svg>',
  custom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"></path></svg>',
  _default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle></svg>'
};

function activeProfile() { return aaGetActiveProfile(DATA); }

function ensureArray(obj, key) {
  if (!Array.isArray(obj[key])) obj[key] = obj[key] ? [obj[key]] : [];
}

// Build one labelled form row. `isLong` -> textarea; `isList` -> the value is
// an array edited as comma-separated text (tagged with data-list for collection).
