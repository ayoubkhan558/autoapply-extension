// Minimal self-check for lib/storage.js changes. Run: node test_fixes.js
// ponytail: single assert-style check, no framework. Not loaded by the extension.
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const store = {};
global.chrome = {
  storage: { local: {
    get: async (k) => ({ [k]: store[k] }),
    set: async (o) => Object.assign(store, o)
  } },
  runtime: { getURL: (p) => p }
};
vm.runInThisContext(fs.readFileSync("lib/fields.js", "utf8"));
vm.runInThisContext(fs.readFileSync("lib/matcher.js", "utf8"));
vm.runInThisContext(fs.readFileSync("lib/storage.js", "utf8"));

(async function () {
  // Shared default blocklist exists and is hostname-safe (no URL paths).
  assert(Array.isArray(AA_DEFAULT_BLOCKED_SITES) && AA_DEFAULT_BLOCKED_SITES.length > 0);
  assert(AA_DEFAULT_BLOCKED_SITES.every((h) => !h.includes("/")), "blocklist entries must be hostnames");

  // History pruning caps at 200 hosts, dropping the oldest.
  const hist = {};
  for (let i = 0; i < 250; i++) hist["host" + i + ".com"] = { ts: i, count: 1 };
  store["autoapplyHistory"] = hist;
  await aaRecordFill("newest.com", 5);
  const after = store["autoapplyHistory"];
  assert(Object.keys(after).length === 200, "history must be capped at 200");
  assert(after["newest.com"], "newest record kept");
  assert(!after["host0.com"], "oldest record dropped");

  // v1.25 migration: address fields move from personal.* to address.*.
  const migrated = aaMigrate({
    profiles: [{ id: "p1", personal: { firstName: "A", city: "Lahore", zip: "54000" } }]
  });
  const p = migrated.profiles[0];
  assert(p.address.city === "Lahore" && p.address.zip === "54000", "address values moved");
  assert(p.personal.city === undefined, "personal.city removed");
  assert(p.personal.firstName === "A", "non-address personal values untouched");
  assert(p.links && "facebook" in p.links, "facebook backfilled into links");
  assert("preferredTeams" in p.professional, "preferredTeams backfilled");

  // Zoho CRUX fields: label from cx-prop-label + attr from data-zcqa resolve
  // to the address keys (this is what the closest() lookups now feed in).
  const zoho = [
    { text: "Zip/Postal Code", attr: "rec_Zip_Code manual_Zip_Code", key: "address.zip" },
    { text: "City", attr: "rec_City manual_City", key: "address.city" },
    { text: "State/Province", attr: "rec_State manual_State", key: "address.state" }
  ];
  zoho.forEach(function (z) {
    const m = AutoApplyMatcher.match({ text: z.text, attr: z.attr });
    assert(m.key === z.key && m.score >= 0.6, z.text + " -> " + m.key + " (" + m.score + ")");
  });

  // Bubble: sibling label "Phone Number*" must match; format-mask placeholder alone must not.
  const phoneHit = AutoApplyMatcher.match({ text: "Phone Number*", attr: "" });
  assert(phoneHit.key === "personal.phone" && phoneHit.score >= 0.6, "Phone Number* -> " + phoneHit.key);
  const maskMiss = AutoApplyMatcher.match({ text: "03XXXXXXXXX", attr: "" });
  assert(maskMiss.key !== "personal.phone" || maskMiss.score < 0.6, "mask placeholder must not win as phone");

  const noticeHit = AutoApplyMatcher.match({ text: "Notice Period (Days)*", attr: "" });
  assert(noticeHit.key === "professional.noticePeriod" && noticeHit.score >= 0.6, "Notice Period -> " + noticeHit.key);
  const joinHit = AutoApplyMatcher.match({ text: "How soon can you join? (Days)", attr: "" });
  assert(joinHit.key === "professional.noticePeriod" && joinHit.score >= 0.6, "How soon -> " + joinHit.key);
  const gformHit = AutoApplyMatcher.match({ text: "What is your notice period with your current employer", attr: "" });
  assert(gformHit.key === "professional.noticePeriod" && gformHit.score >= 0.6, "Google Forms notice -> " + gformHit.key);

  // Google Forms notice radios: closest day bucket (mirror content/fill.js).
  function noticeOptionDays(lbl) {
    const low = (lbl || "").toLowerCase().trim();
    if (/more than a month/.test(low)) return 35;
    const m = low.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  function pickNoticeRadioLabels(opts, value) {
    const n = parseInt((String(value).match(/\d+/) || [""])[0], 10);
    if (!n) return null;
    let best = null;
    let bestDiff = Infinity;
    opts.forEach(function (lbl) {
      const days = noticeOptionDays(lbl);
      if (days === null) return;
      const diff = Math.abs(days - n);
      if (diff < bestDiff) { bestDiff = diff; best = lbl; }
    });
    return best;
  }
  const gformOpts = ["7 Days", "14 Days", "21 Days", "28 Days", "More than a month"];
  assert(pickNoticeRadioLabels(gformOpts, "30 days") === "28 Days", "30 days -> 28 Days");
  assert(pickNoticeRadioLabels(gformOpts, "7") === "7 Days", "7 -> 7 Days");
  assert(pickNoticeRadioLabels(gformOpts, "45 days") === "More than a month", "45 days -> More than a month");

  const expHit = AutoApplyMatcher.match({ text: "How many years of experience do you have in software/web development?", attr: "" });
  assert(expHit.key === "professional.experienceYears" && expHit.score >= 0.6, "GForm experience -> " + expHit.key);
  const salHit = AutoApplyMatcher.match({ text: "Expected monthly salary in USD", attr: "" });
  assert(salHit.key === "professional.desiredSalary" && salHit.score >= 0.6, "GForm salary -> " + salHit.key);

  function experienceOptionRange(lbl) {
    const low = (lbl || "").toLowerCase().trim();
    const plus = low.match(/^(\d+)\s*\+|^(\d+)\s*plus|more than\s*(\d+)/);
    if (plus) {
      const n = parseInt(plus[1] || plus[2] || plus[3], 10);
      return n <= 100 ? { min: n, max: 999 } : null;
    }
    const range = low.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!range) return null;
    const min = parseInt(range[1], 10);
    const max = parseInt(range[2], 10);
    return max <= 100 ? { min: min, max: max } : null;
  }
  function pickExperienceRadioLabels(opts, value) {
    const m = String(value).match(/[\d.]+/);
    if (!m) return null;
    const yrs = parseFloat(m[0]);
    let best = null;
    let bestDist = Infinity;
    opts.forEach(function (lbl) {
      const range = experienceOptionRange(lbl);
      if (!range) return;
      let dist = 0;
      if (yrs < range.min) dist = range.min - yrs;
      else if (yrs > range.max) dist = yrs - range.max;
      if (dist < bestDist) { bestDist = dist; best = lbl; }
    });
    return best;
  }
  const expOpts = ["0-1", "2-3", "4-5", "6+"];
  assert(pickExperienceRadioLabels(expOpts, "5 years") === "4-5", "5 yrs -> 4-5");
  assert(pickExperienceRadioLabels(expOpts, "7") === "6+", "7 yrs -> 6+");

  const PKR_USD = 280;
  function normSalary(value, profileCurrency, wantCur, wantPeriod) {
    const raw = String(value || "");
    const low = raw.toLowerCase();
    let cur = (profileCurrency || "").toUpperCase();
    if (/\bpkr\b|rs\b/.test(low)) cur = "PKR";
    if (/\busd\b/.test(low)) cur = "USD";
    let period = /month/.test(low) ? "month" : (/year|ctc/.test(low) ? "year" : null);
    let n = parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!cur && wantCur === "USD" && n >= 50000) cur = "PKR";
    if (!period && n >= 500000 && (!cur || cur === "PKR")) { n = n / 12; period = "month"; }
    if (period === "year" && wantPeriod === "month") n = n / 12;
    if (cur === "PKR" && wantCur === "USD") n = Math.round(n / PKR_USD);
    return n;
  }
  assert(normSalary("150000 PKR/month", "", "USD", "month") === 536, "150k PKR/mo -> USD");
  assert(normSalary("1800000", "PKR", "USD", "month") === 536, "1.8M annual PKR -> USD/mo");

  assert(/(resume|cv|curriculum)/.test("upload your cv/resume"), "GForm CV heading match");

  // Search/filter exclusion hay (mirror content/dom.js isSearchField attr scan).
  const SEARCH_FILTER_RE = /typeahead|searchbox|semanticsearch|filter-input|autosuggest|describe the job you want/;
  assert(SEARCH_FILTER_RE.test("typeahead-input semanticSearchBox Describe the job you want".toLowerCase()));
  assert(!SEARCH_FILTER_RE.test("city lahore address zip"), "application address fields stay fillable");

  // Cover letter file upload (per profile, separate from professional.coverLetter text).
  assert(typeof aaGetCoverLetter === "function" && typeof aaSetCoverLetter === "function");
  assert(typeof aaGetResumeText === "function");

  // Shared default job keywords / roles stay in sync with options display.
  assert(Array.isArray(AA_DEFAULT_JOB_KEYWORDS) && AA_DEFAULT_JOB_KEYWORDS.length > 10);
  assert(AA_DEFAULT_JOB_KEYWORDS.indexOf("apply now") !== -1);
  assert(AA_DEFAULT_JOB_KEYWORDS.indexOf("careers") !== -1, "careers keyword present");
  assert(AA_DEFAULT_JOB_KEYWORDS.indexOf("join our team") !== -1, "join our team keyword present");
  assert(Array.isArray(AA_DEFAULT_JOB_ROLES) && AA_DEFAULT_JOB_ROLES.length >= 20);
  assert(AA_DEFAULT_JOB_ROLES.indexOf("wordpress developer") !== -1);
  assert(AA_DEFAULT_JOB_ROLES.indexOf("php developer") !== -1);
  assert(AA_DEFAULT_JOB_ROLES.indexOf("frontend developer") !== -1);

  console.log("test_fixes.js: all checks passed");
})();
