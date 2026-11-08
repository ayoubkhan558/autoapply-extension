// Profile form rows, repeaters, and custom-field cards.
// Classic-script module; dependency order is declared in config/modules.json.
function makeRow(labelText, value, data, isLong, isList) {
  const row = document.createElement("div");
  row.className = "aa-field-grid__row";
  const lbl = document.createElement("label");
  lbl.textContent = labelText;
  row.appendChild(lbl);
  const input = isLong ? document.createElement("textarea") : document.createElement("input");
  if (!isLong) input.type = "text";
  const field = data.field || "";
  const choices = {
    gender: ["Male", "Female", "Non-binary", "Self-described", "Prefer not to say"],
    maritalStatus: ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"],
    employmentType: ["Full-time", "Part-time", "Contract", "Freelance", "Internship", "Temporary"],
    desiredJobType: ["Full-time", "Part-time", "Contract", "Freelance", "Internship"],
    preferredWorkMode: ["Remote", "Hybrid", "On-site"],
    salaryCurrency: ["USD", "PKR", "AED", "GBP", "EUR", "CAD", "AUD"]
  };
  if (["needsSponsorship", "willingToRelocate", "openToContract", "openToFreelance", "salaryNegotiable"].includes(field)) choices[field] = ["Yes", "No"];
  input.id = "field-" + Object.values(data).join("-");
  lbl.htmlFor = input.id;
  if (choices[field]) {
    const suggestions = document.createElement("datalist");
    suggestions.id = input.id + "-choices";
    choices[field].forEach(function (value) { const option = document.createElement("option"); option.value = value; suggestions.appendChild(option); });
    input.setAttribute("list", suggestions.id);
    row.appendChild(suggestions);
  }
  if (/email/i.test(field)) input.type = "email";
  if (/phone|whatsapp/i.test(field)) { input.type = "tel"; input.pattern = "[+0-9() .\\-]{7,25}"; input.title = "Enter 7–25 phone characters: digits, spaces, +, parentheses or hyphens."; }
  if (/ExperienceYears$|^experienceYears$|^totalExperienceMonths$|Year$/.test(field)) { input.type = "number"; input.min = /Year$/.test(field) ? "1900" : "0"; input.max = /Year$/.test(field) ? "2200" : "1200"; input.step = /Years$/.test(field) ? "0.1" : "1"; }
  if (/date/i.test(field)) {
    const oldMonth = /^(\d{2})\/(\d{4})$/.exec(String(value));
    if (oldMonth) value = oldMonth[2] + "-" + oldMonth[1];
    input.type = /^\d{4}-\d{2}$/.test(value) ? "month" : "date";
    // Preserve non-calendar answers such as Immediate and Present for existing profiles.
    if (value && !/^\d{4}-\d{2}(-\d{2})?$/.test(value)) input.type = "text";
    if (field === "dateOfBirth") input.max = new Date().toLocaleDateString("en-CA");
  }
  if (data.meta === "label") { input.required = true; input.maxLength = 100; }
  Object.keys(data).forEach(function (k) { input.dataset[k] = data[k]; });
  if (isList) {
    input.dataset.list = "1";
    input.placeholder = "Comma-separated";
    value = Array.isArray(value) ? value.join(", ") : (value || "");
  }
  input.value = (value === null || value === undefined) ? "" : value;
  row.appendChild(input);
  if (isLong) row.classList.add("aa-field-grid__row--full");
  return row;
}

function makeHeaderWithButton(text, btnText, onClick) {
  const head = document.createElement("div");
  head.className = "aa-section-head";
  const h = document.createElement("h2");
  h.className = "aa-section-head__title";
  h.textContent = text;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "aa-btn aa-btn--add";
  btn.textContent = btnText;
  btn.addEventListener("click", onClick);
  head.appendChild(h);
  head.appendChild(btn);
  return head;
}

function renderRepeaterCard(rep, entry, idx) {
  const card = document.createElement("details");
  card.open = idx === activeProfile()[rep.key].length - 1;
  card.className = "aa-entry-card";
  const head = document.createElement("summary");
  head.className = "aa-entry-card__head";
  const title = document.createElement("span");
  title.className = "aa-entry-card__title";
  title.textContent = (idx + 1) + ". " + (entry.name || entry.title || entry.school || rep.itemLabel);
  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "aa-btn aa-btn--remove";
  rm.textContent = "Remove";
  rm.addEventListener("click", function () { removeRepeaterEntry(rep.key, idx); });
  head.appendChild(title);
  card.appendChild(head);
  const actions = document.createElement("div");
  actions.className = "aa-entry-actions";
  [-1, 1].forEach(function (direction) {
    const move = document.createElement("button"); move.type = "button"; move.className = "aa-btn";
    move.textContent = direction < 0 ? "Move up" : "Move down";
    move.disabled = idx + direction < 0 || idx + direction >= activeProfile()[rep.key].length;
    move.addEventListener("click", function () { moveRepeaterEntry(rep.key, idx, direction); });
    actions.appendChild(move);
  });
  actions.appendChild(rm); card.appendChild(actions);
  const grid = document.createElement("div");
  grid.className = "aa-field-grid";
  rep.fields.forEach(function (fd) {
    grid.appendChild(makeRow(fd.label, entry[fd.name] || "", { rep: rep.key, index: String(idx), field: fd.name }, fd.long, fd.list));
  });
  card.appendChild(grid);
  return card;
}

function renderCustomCard(cf, idx) {
  const card = document.createElement("div");
  card.className = "aa-entry-card";
  const grid = document.createElement("div");
  grid.className = "aa-field-grid";
  grid.appendChild(makeRow("Field label", cf.label || "", { custom: String(idx), cfield: "label" }, false));
  grid.appendChild(makeRow("Match keywords (comma separated)", cf.match || "", { custom: String(idx), cfield: "match" }, false));
  const valRow = makeRow("Value", cf.value || "", { custom: String(idx), cfield: "value" }, true);
  grid.appendChild(valRow);
  card.appendChild(grid);
  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "aa-btn aa-btn--remove aa-entry-card__remove";
  rm.textContent = "Remove field";
  rm.addEventListener("click", function () { removeCustomField(idx); });
  card.appendChild(rm);
  return card;
}
