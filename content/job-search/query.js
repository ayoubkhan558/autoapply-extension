// Job-source presets and pure query/date builders.
// Classic-script module; dependency order is declared in config/modules.json.
// AutoApply content module. Job-search builder modal (injected on Google).
// ponytail: Pakistan / Global region presets; after: derived from freshness chips.

var AA_JOB_SOURCES = [
  { group: "ATS", id: "greenhouse", label: "Greenhouse", site: "boards.greenhouse.io" },
  { group: "ATS", id: "lever", label: "Lever", site: "jobs.lever.co" },
  { group: "ATS", id: "workday", label: "Workday", site: "myworkdayjobs.com" },
  { group: "ATS", id: "ashby", label: "Ashby", site: "jobs.ashbyhq.com" },
  { group: "ATS", id: "smartrecruiters", label: "SmartRecruiters", site: "jobs.smartrecruiters.com" },
  { group: "ATS", id: "workable", label: "Workable", site: "apply.workable.com" },
  { group: "ATS", id: "icims", label: "iCIMS", site: "icims.com" },
  { group: "ATS", id: "jobvite", label: "Jobvite", site: "jobs.jobvite.com" },
  { group: "ATS", id: "bamboohr", label: "BambooHR", site: "bamboohr.com" },
  { group: "ATS", id: "adp", label: "ADP", site: "jobs.adp.com" },
  { group: "ATS", id: "eightfold", label: "Eightfold", site: "eightfold.ai" },
  { group: "PK", id: "linkedin", label: "LinkedIn", site: "linkedin.com/jobs" },
  { group: "PK", id: "indeed-pk", label: "Indeed PK", site: "pk.indeed.com" },
  { group: "PK", id: "rozee", label: "Rozee", site: "rozee.pk" },
  { group: "PK", id: "mustakbil", label: "Mustakbil", site: "mustakbil.com/jobs" },
  { group: "PK", id: "brightspyre", label: "BrightSpyre", site: "brightspyre.com/jobs" },
  { group: "PK", id: "careerokay", label: "CareerOkay", site: "careerokay.com" },
  { group: "PK", id: "bayrozgar", label: "Bayrozgar", site: "bayrozgar.com" },
  { group: "PK", id: "jobz", label: "Jobz.pk", site: "jobz.pk" },
  { group: "PK", id: "pakistanjobs", label: "PakistanJobs", site: "pakistanjobs.pk" },
  { group: "PK", id: "careerjet", label: "Careerjet", site: "careerjet.com.pk" },
  { group: "PK", id: "techjuice", label: "TechJuice", site: "techjuice.pk/jobs" },
  { group: "PK", id: "glassdoor-pk", label: "Glassdoor PK", site: "glassdoor.com/Job/pakistan" }
];

var AA_JOB_PRESETS = {
  pakistan: {
    label: "Pakistan",
    roles: ["WordPress Developer", "Frontend Developer", "Front-end Developer", "React Developer", "ReactJS", "Elementor", "WooCommerce", "Gutenberg"],
    levels: ["junior", "entry level", "graduate", "fresh graduate", "mid"],
    locations: ["Pakistan", "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Hybrid", "Remote"],
    exclude: "senior, staff, principal, lead, manager, director, head, intern, contract",
    sourceIds: ["linkedin", "indeed-pk", "rozee", "mustakbil", "brightspyre", "careerokay", "bayrozgar", "jobz", "pakistanjobs", "careerjet", "techjuice", "glassdoor-pk"]
  },
  global: {
    label: "Global",
    roles: ["Software Engineer", "Software Developer", "Backend Software Engineer"],
    levels: ["new grad", "junior", "entry level", "early career"],
    locations: ["United States", "Remote"],
    exclude: "senior, staff, principal, contract",
    sourceIds: ["greenhouse", "lever", "workday", "ashby", "smartrecruiters", "workable", "icims", "jobvite", "bamboohr", "adp", "eightfold"]
  }
};

var AA_FRESH_DAYS = { "24h": 1, "48h": 2, "72h": 3, "7d": 7, "14d": 14, "1mo": 30 };

function aaIsGoogleHost() {
  try { return /(^|\.)google\./i.test(location.hostname); } catch (e) { return false; }
}

function aaJobAfterDate(days) {
  var d = new Date();
  d.setDate(d.getDate() - (days || 3));
  return d.toISOString().slice(0, 10);
}

function aaOrGroup(items) {
  var parts = (items || []).map(function (s) { return String(s || "").trim(); }).filter(Boolean)
    .map(function (s) { return /[ "]/.test(s) || s.indexOf(":") !== -1 ? '"' + s.replace(/"/g, "") + '"' : s; });
  if (!parts.length) return "";
  return "(" + parts.join(" OR ") + ")";
}

function aaSiteGroup(sites) {
  var parts = (sites || []).filter(Boolean).map(function (s) { return "site:" + s; });
  if (!parts.length) return "";
  return "(" + parts.join(" OR ") + ")";
}

function aaExcludeTerms(text) {
  return String(text || "").split(/[,\n]+/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean)
    .map(function (s) { return s.charAt(0) === "-" ? s : ("-" + s.replace(/\s+/g, " ")); });
}

function aaBuildJobQuery(state) {
  var chunks = [];
  var roles = aaOrGroup(state.roles);
  var levels = aaOrGroup(state.levels);
  var locs = aaOrGroup(state.locations);
  var sites = aaSiteGroup(state.sites);
  if (roles) chunks.push(roles);
  if (levels) chunks.push(levels);
  if (locs) chunks.push(locs);
  if (sites) chunks.push(sites);
  if (state.after) chunks.push("after:" + state.after);
  aaExcludeTerms(state.exclude).forEach(function (t) { chunks.push(t); });
  return chunks.join("\n");
}
