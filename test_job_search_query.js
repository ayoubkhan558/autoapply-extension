// ponytail: one-shot check for PK job query shape
var AA_JOB_PRESETS = {
  "pk-frontend": {
    roles: ["WordPress Developer", "Frontend Developer", "Front-end Developer", "React Developer", "ReactJS", "Elementor", "WooCommerce", "Gutenberg"],
    levels: ["junior", "entry level", "graduate", "fresh graduate", "mid"],
    locations: ["Pakistan", "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Hybrid", "Remote"],
    exclude: "senior, staff, principal, lead, manager, director, head, intern, contract",
    sites: [
      "linkedin.com/jobs", "pk.indeed.com", "rozee.pk", "mustakbil.com/jobs",
      "brightspyre.com/jobs", "careerokay.com", "bayrozgar.com", "jobz.pk",
      "pakistanjobs.pk", "careerjet.com.pk", "techjuice.pk/jobs", "glassdoor.com/Job/pakistan"
    ]
  }
};
function aaOrGroup(items) {
  return "(" + items.map(function (s) { return '"' + s + '"'; }).join(" OR ") + ")";
}
function aaSiteGroup(sites) {
  return "(" + sites.map(function (s) { return "site:" + s; }).join(" OR ") + ")";
}
function aaExcludeTerms(text) {
  return text.split(/[,\n]+/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean)
    .map(function (s) { return "-" + s; });
}
var p = AA_JOB_PRESETS["pk-frontend"];
var q = [aaOrGroup(p.roles), aaOrGroup(p.levels), aaOrGroup(p.locations), aaSiteGroup(p.sites), "after:2026-07-17"]
  .concat(aaExcludeTerms(p.exclude)).join("\n");
console.assert(q.indexOf('site:rozee.pk') !== -1, "rozee site missing");
console.assert(q.indexOf('"WordPress Developer"') !== -1, "role missing");
console.assert(q.indexOf("-senior") !== -1, "exclude missing");
console.assert(q.split("\n").length >= 6, "expected multi-line query");
console.log("ok\n" + q);
