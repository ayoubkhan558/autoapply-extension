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
