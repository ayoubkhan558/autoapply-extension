// Profile flattening and shared string/date helpers.
// Classic-script module; dependency order is declared in config/modules.json.
function norm(s) {
  return (s || "").toString().toLowerCase().trim();
}

// Flatten the structured profile into dotted keys (e.g. "personal.email")
// that the matcher resolves against. Array values (languages/tools/etc.) are
// joined into comma-separated text so they can be typed into a single field.
function buildFlat(profile) {
  const flat = {};
  function put(key, val) { flat[key] = Array.isArray(val) ? val.filter(Boolean).join(", ") : val; }
  // Flat sections.
  ["personal", "address", "links", "professional"].forEach(function (sec) {
    const obj = profile[sec];
    if (obj && typeof obj === "object") {
      for (const k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) put(sec + "." + k, obj[k]); }
    }
  });
  // Profiles saved before v1.25 keep address values under personal.*; alias
  // them so address.* matcher keys still resolve without a migration pass.
  ["address1", "address2", "currentAddress", "permanentAddress", "city", "state", "zip", "country"].forEach(function (k) {
    if (!flat["address." + k] && flat["personal." + k]) flat["address." + k] = flat["personal." + k];
  });
  // Repeating sections: only the first entry is auto-filled.
  ["experience", "education", "projects", "certifications", "awards", "volunteering"].forEach(function (sec) {
    const list = Array.isArray(profile[sec]) ? profile[sec] : (profile[sec] ? [profile[sec]] : []);
    const first = list[0] || {};
    for (const k in first) { if (Object.prototype.hasOwnProperty.call(first, k)) put(sec + "." + k, first[k]); }
  });
  if (profile.personal) {
    flat["personal.fullName"] = [profile.personal.firstName, profile.personal.lastName].filter(Boolean).join(" ");
  }
  if (!flat["experience.company"] && flat["professional.currentCompany"]) flat["experience.company"] = flat["professional.currentCompany"];
  if (!flat["experience.title"] && flat["professional.currentTitle"]) flat["experience.title"] = flat["professional.currentTitle"];
  if (!flat["links.portfolio"] && flat["links.website"]) flat["links.portfolio"] = flat["links.website"];
  if (!flat["links.website"] && flat["links.portfolio"]) flat["links.website"] = flat["links.portfolio"];
  if (!flat["professional.availableStartDate"]) flat["professional.availableStartDate"] = aaNextMonthFirstDate();
  if (!flat["professional.currentCompany"] && flat["experience.company"]) flat["professional.currentCompany"] = flat["experience.company"];
  if (!flat["professional.currentTitle"] && flat["experience.title"]) flat["professional.currentTitle"] = flat["experience.title"];
  return flat;
}

function aaNextMonthFirstDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
}

function aaText(el) {
  if (!el) return "";
  return (el.innerText || el.textContent || "").trim();
}
