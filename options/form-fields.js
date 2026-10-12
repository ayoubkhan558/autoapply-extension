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
  const card = document.createElement("div");
  card.className = "aa-entry-card";
  const head = document.createElement("div");
  head.className = "aa-entry-card__head";
  const title = document.createElement("span");
  title.className = "aa-entry-card__title";
  title.textContent = rep.itemLabel + " " + (idx + 1);
  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "aa-btn aa-btn--remove";
  rm.textContent = "Remove";
  rm.addEventListener("click", function () { removeRepeaterEntry(rep.key, idx); });
  head.appendChild(title);
  head.appendChild(rm);
  card.appendChild(head);
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
