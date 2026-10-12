// Registry-driven profile form and section navigation.
// Classic-script module; dependency order is declared in config/modules.json.
function renderForm() {
  const prof = activeProfile();
  const form = document.getElementById("profileForm");
  form.innerHTML = "";

  const layout = document.createElement("div");
  layout.className = "aa-profile-fields-layout";
  const nav = document.createElement("div");
  nav.className = "aa-profile-fields-nav";
  const panels = document.createElement("div");
  panels.className = "aa-profile-fields-panels";
  layout.appendChild(nav); layout.appendChild(panels);

  function addLeftTab(id, label, build, active) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "aa-profile-field-tab" + (active ? " aa-is-active" : "");
    const ic = document.createElement("span"); ic.className = "aa-profile-field-tab__icon"; ic.innerHTML = AA_TAB_ICONS[id] || AA_TAB_ICONS._default;
    const tx = document.createElement("span"); tx.textContent = label;
    btn.appendChild(ic); btn.appendChild(tx);
    const panel = document.createElement("section");
    panel.className = "aa-profile-field-panel" + (active ? " aa-is-active" : ""); panel.dataset.panel = id;
    build(panel);
    btn.addEventListener("click", function(){
      nav.querySelectorAll(".aa-profile-field-tab").forEach(function(b){ b.classList.remove("aa-is-active"); });
      panels.querySelectorAll(".aa-profile-field-panel").forEach(function(p){ p.classList.remove("aa-is-active"); });
      btn.classList.add("aa-is-active"); panel.classList.add("aa-is-active");
    });
    nav.appendChild(btn); panels.appendChild(panel);
  }

  addLeftTab("profile", "Profile", function(panel){
    const metaGrid = document.createElement("div"); metaGrid.className = "aa-field-grid";
    const labelRow = makeRow("Profile label", prof.label || "", { meta: "label" }, false);
    labelRow.classList.add("aa-field-grid__row--full"); metaGrid.appendChild(labelRow); panel.appendChild(metaGrid);
    panel.appendChild(renderCvProfileBlock(prof));
  }, true);

  SECTIONS.forEach(function (section) {
    addLeftTab(section.key, section.label, function(panel){
      if (!prof[section.key]) prof[section.key] = {};
      const grid = document.createElement("div"); grid.className = "aa-field-grid";
      section.fields.forEach(function (fd) { grid.appendChild(makeRow(fd.label, prof[section.key][fd.name] || "", { section: section.key, field: fd.name }, fd.long, fd.list)); });
      panel.appendChild(grid);
    }, false);
  });

  REPEATERS.forEach(function (rep) {
    addLeftTab(rep.key, rep.label, function(panel){
      panel.appendChild(makeHeaderWithButton(rep.label, "+ Add " + rep.itemLabel, function () { addRepeaterEntry(rep.key); }));
      ensureArray(prof, rep.key);
      const list = document.createElement("div"); prof[rep.key].forEach(function (entry, idx) { list.appendChild(renderRepeaterCard(rep, entry, idx)); }); panel.appendChild(list);
    }, false);
  });

  addLeftTab("custom", "Custom fields", function(panel){
    panel.appendChild(makeHeaderWithButton("Custom fields", "+ Add field", function () { addCustomField(); }));
    ensureArray(prof, "customFields"); const clist = document.createElement("div"); prof.customFields.forEach(function (cf, idx) { clist.appendChild(renderCustomCard(cf, idx)); }); panel.appendChild(clist);
  }, false);

  form.appendChild(layout);
  renderCompleteness(prof);
}


// Read a form input's value, converting comma-separated "list" fields
// (e.g. languages, tools) back into an array for storage.
