// Job-search modal and its local UI event handlers.
// Classic-script module; dependency order is declared in config/modules.json.
function aaRemoveJobSearchModal() {
  var old = document.getElementById("aa-job-search");
  if (old) old.remove();
}

function aaParseList(text) {
  return String(text || "").split(/[,\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
}

function aaShowJobSearchModal(saved) {
  if (window !== window.top) return;
  if (document.getElementById("aa-job-search")) return;
  // Migrate old preset ids.
  var rawPreset = (saved && saved.preset) || "pakistan";
  if (rawPreset === "pk-frontend") rawPreset = "pakistan";
  if (rawPreset === "ats") rawPreset = "global";
  var presetKey = AA_JOB_PRESETS[rawPreset] ? rawPreset : "pakistan";
  var preset = AA_JOB_PRESETS[presetKey];
  var freshKey = (saved && saved.freshness) || "72h";
  if (!AA_FRESH_DAYS[freshKey]) freshKey = "72h";
  var rolesText = (saved && saved.roles)
    ? (Array.isArray(saved.roles) ? saved.roles.join("\n") : String(saved.roles).replace(/,\s*/g, "\n"))
    : preset.roles.join("\n");
  var levelKey = (saved && saved.level) || "newgrad";
  var exclude = (saved && saved.exclude != null) ? saved.exclude : preset.exclude;
  var remote = saved && saved.remote !== undefined ? !!saved.remote : true;
  var checkedIds = (saved && saved.sourceIds && saved.sourceIds.length)
    ? saved.sourceIds.slice()
    : (saved && saved.sites && saved.sites.length
      ? AA_JOB_SOURCES.filter(function (s) { return saved.sites.indexOf(s.site) !== -1; }).map(function (s) { return s.id; })
      : preset.sourceIds.slice());

  var root = document.createElement("div");
  root.id = "aa-job-search";
  root.innerHTML =
    '<div class="aa-js-backdrop"></div>' +
    '<div class="aa-js-card" role="dialog" aria-label="Search settings">' +
      '<div class="aa-js-head">' +
        '<div><div class="aa-js-title">Search settings</div><div class="aa-js-sub">Results stay hidden until submit.</div></div>' +
        '<div class="aa-js-head-right">' +
          '<select id="aaJsPreset" class="aa-js-select" title="Region preset"></select>' +
          '<button type="button" class="aa-js-reset" id="aaJsReset">Reset</button>' +
        '</div>' +
      '</div>' +
      '<div class="aa-js-row">' +
        '<label class="aa-js-label">Role keywords <span class="aa-js-hint">(one per line)</span></label>' +
        '<textarea id="aaJsRoles" class="aa-js-input aa-js-roles" rows="4"></textarea>' +
      '</div>' +
      '<div class="aa-js-row aa-js-row--inline">' +
        '<div><label class="aa-js-label">Level</label><div class="aa-js-chips" id="aaJsLevels"></div></div>' +
        '<div><label class="aa-js-label">Freshness</label><div class="aa-js-chips" id="aaJsFresh" role="radiogroup"></div></div>' +
      '</div>' +
      '<div class="aa-js-row">' +
        '<div class="aa-js-row-between">' +
          '<label class="aa-js-label">Job sources</label>' +
          '<span class="aa-js-source-actions">' +
            '<button type="button" class="aa-js-linkbtn" id="aaJsAllAts">All ATS</button>' +
            '<button type="button" class="aa-js-linkbtn" id="aaJsAllPk">All PK</button>' +
            '<button type="button" class="aa-js-linkbtn" id="aaJsNoneSrc">None</button>' +
          '</span>' +
        '</div>' +
        '<div class="aa-js-sites" id="aaJsSites"></div>' +
      '</div>' +
      '<div class="aa-js-row aa-js-row--split">' +
        '<div class="aa-js-grow"><label class="aa-js-label">Exclude</label><input type="text" id="aaJsExclude" class="aa-js-input" /></div>' +
        '<button type="button" class="aa-js-remote" id="aaJsRemote">Remote</button>' +
      '</div>' +
      '<button type="button" class="aa-js-submit" id="aaJsSubmit">Build fresh search links</button>' +
    '</div>';
  document.documentElement.appendChild(root);

  var rolesEl = root.querySelector("#aaJsRoles");
  var presetEl = root.querySelector("#aaJsPreset");
  var excludeEl = root.querySelector("#aaJsExclude");
  var remoteBtn = root.querySelector("#aaJsRemote");
  var sitesEl = root.querySelector("#aaJsSites");
  var levelsEl = root.querySelector("#aaJsLevels");
  var freshEl = root.querySelector("#aaJsFresh");

  Object.keys(AA_JOB_PRESETS).forEach(function (k) {
    var o = document.createElement("option");
    o.value = k;
    o.textContent = AA_JOB_PRESETS[k].label;
    if (k === presetKey) o.selected = true;
    presetEl.appendChild(o);
  });

  rolesEl.value = rolesText;
  excludeEl.value = exclude;

  remoteBtn.classList.toggle("aa-js-on", remote);

  var levelOpts = [
    { id: "any", label: "Any level", words: [] },
    { id: "intern", label: "Internship", words: ["intern", "internship"] },
    { id: "newgrad", label: "New grad", words: ["junior", "entry level", "graduate", "fresh graduate", "mid"] },
    { id: "early", label: "Early career", words: ["junior", "entry level", "early career"] },
    { id: "senior", label: "Senior+", words: ["senior", "staff", "principal"] }
  ];
  levelOpts.forEach(function (opt) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "aa-js-chip" + (opt.id === levelKey ? " aa-js-on" : "");
    b.dataset.level = opt.id;
    b.textContent = opt.label;
    b.addEventListener("click", function () {
      levelsEl.querySelectorAll(".aa-js-chip").forEach(function (c) { c.classList.remove("aa-js-on"); });
      b.classList.add("aa-js-on");
    });
    levelsEl.appendChild(b);
  });

  Object.keys(AA_FRESH_DAYS).forEach(function (k) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", k === freshKey ? "true" : "false");
    b.className = "aa-js-chip" + (k === freshKey ? " aa-js-on" : "");
    b.dataset.fresh = k;
    b.textContent = k;
    b.addEventListener("click", function () {
      freshEl.querySelectorAll(".aa-js-chip").forEach(function (c) {
        c.classList.remove("aa-js-on");
        c.setAttribute("aria-checked", "false");
      });
      b.classList.add("aa-js-on");
      b.setAttribute("aria-checked", "true");
    });
    freshEl.appendChild(b);
  });

  function setSourceChecks(ids) {
    var set = {};
    (ids || []).forEach(function (id) { set[id] = true; });
    sitesEl.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
      cb.checked = !!set[cb.dataset.id];
    });
  }

  function renderSources(selectedIds) {
    sitesEl.innerHTML = "";
    var lastGroup = "";
    AA_JOB_SOURCES.forEach(function (src) {
      if (src.group !== lastGroup) {
        lastGroup = src.group;
        var head = document.createElement("div");
        head.className = "aa-js-sites-group";
        head.textContent = src.group === "ATS" ? "ATS" : "Pakistan";
        sitesEl.appendChild(head);
      }
      var lab = document.createElement("label");
      lab.className = "aa-js-site";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.id = src.id;
      cb.value = src.site;
      cb.checked = selectedIds.indexOf(src.id) !== -1;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(" " + src.label));
      sitesEl.appendChild(lab);
    });
  }
  renderSources(checkedIds);

  function applyPreset(key) {
    var p = AA_JOB_PRESETS[key];
    if (!p) return;
    rolesEl.value = p.roles.join("\n");
    excludeEl.value = p.exclude;
    setSourceChecks(p.sourceIds);
    levelsEl.querySelectorAll(".aa-js-chip").forEach(function (c) {
      c.classList.toggle("aa-js-on", c.dataset.level === (key === "pakistan" ? "newgrad" : "early"));
    });
  }

  presetEl.addEventListener("change", function () { applyPreset(presetEl.value); });
  remoteBtn.addEventListener("click", function () { remoteBtn.classList.toggle("aa-js-on"); });
  root.querySelector("#aaJsAllAts").addEventListener("click", function () {
    sitesEl.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
      var src = AA_JOB_SOURCES.find(function (s) { return s.id === cb.dataset.id; });
      if (src && src.group === "ATS") cb.checked = true;
    });
  });
  root.querySelector("#aaJsAllPk").addEventListener("click", function () {
    sitesEl.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
      var src = AA_JOB_SOURCES.find(function (s) { return s.id === cb.dataset.id; });
      if (src && src.group === "PK") cb.checked = true;
    });
  });
  root.querySelector("#aaJsNoneSrc").addEventListener("click", function () {
    sitesEl.querySelectorAll("input[type=checkbox]").forEach(function (cb) { cb.checked = false; });
  });
  root.querySelector(".aa-js-backdrop").addEventListener("click", aaRemoveJobSearchModal);
  root.querySelector("#aaJsReset").addEventListener("click", function () {
    applyPreset(presetEl.value);
    freshEl.querySelectorAll(".aa-js-chip").forEach(function (c) {
      var on = c.dataset.fresh === "72h";
      c.classList.toggle("aa-js-on", on);
      c.setAttribute("aria-checked", on ? "true" : "false");
    });
    remoteBtn.classList.add("aa-js-on");
  });

  function collectState() {
    var lvlBtn = levelsEl.querySelector(".aa-js-chip.aa-js-on");
    var lvl = levelOpts.find(function (o) { return o.id === (lvlBtn && lvlBtn.dataset.level); }) || levelOpts[2];
    var sourceIds = [];
    var sites = [];
    sitesEl.querySelectorAll("input:checked").forEach(function (cb) {
      sourceIds.push(cb.dataset.id);
      sites.push(cb.value);
    });
    var p = AA_JOB_PRESETS[presetEl.value] || AA_JOB_PRESETS.pakistan;
    var locs = p.locations.slice();
    if (!remoteBtn.classList.contains("aa-js-on")) {
      locs = locs.filter(function (x) { return x !== "Remote"; });
    } else if (locs.indexOf("Remote") === -1) {
      locs.push("Remote");
    }
    var freshness = (freshEl.querySelector(".aa-js-chip.aa-js-on") || {}).dataset.fresh || "72h";
    return {
      preset: presetEl.value,
      roles: aaParseList(rolesEl.value),
      levels: lvl.words,
      level: lvl.id,
      locations: locs,
      locationLabel: presetEl.value === "pakistan" ? "Pakistan" : "United States",
      sourceIds: sourceIds,
      sites: sites,
      after: aaJobAfterDate(AA_FRESH_DAYS[freshness] || 3),
      freshness: freshness,
      exclude: excludeEl.value,
      remote: remoteBtn.classList.contains("aa-js-on")
    };
  }

  root.querySelector("#aaJsSubmit").addEventListener("click", function () {
    var state = collectState();
    var q = aaBuildJobQuery(state);
    try {
      chrome.storage.local.get("autoapplyAI", function (res) {
        var s = (res && res.autoapplyAI) || {};
        s.jobs = Object.assign({}, s.jobs || {}, state, { role: state.roles.join(", "), location: state.locationLabel });
        chrome.storage.local.set({ autoapplyAI: s });
      });
    } catch (e) { /* ignore */ }
    location.assign("https://www.google.com/search?q=" + encodeURIComponent(q));
  });
}
