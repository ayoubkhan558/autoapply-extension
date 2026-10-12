// Resume prompt, tolerant JSON parsing, and provider transports.
// Classic-script module; dependency order is declared in config/modules.json.
// AutoApply AI: resume parsing, job-fit analysis, and model listing.
// Runs in the background service worker.

const AA_RESUME_PROMPT = [
  "You are a resume parser. Read the resume and output a SINGLE JSON object describing the candidate.",
  "Output JSON ONLY. No commentary, no markdown code fences.",
  "Use exactly these keys. Omit any field you cannot find; never invent data.",
  "",
  "personal: firstName, lastName, middleName, preferredName, email, phone, dateOfBirth, gender, nationality, pronouns",
  "address: address1, address2, city, state, zip, country",
  "links: linkedin, github, portfolio, website, facebook, twitter, stackoverflow, dribbble, behance, medium",
  "professional: currentTitle, currentCompany, experienceYears, currentSalary, desiredSalary, noticePeriod, availableStartDate, workAuthorization, needsSponsorship, willingToRelocate, remotePreference, securityClearance, skills, preferredTeams, linkedinHeadline, references, coverLetter",
  "experience: an ARRAY of objects, each with company, title, location, employmentType, startDate, endDate, description",
  "education: an ARRAY of objects, each with school, degree, fieldOfStudy, location, startYear, endYear, gpa",
  "",
  "All values must be strings (skills may be a comma-separated string). Keep dates as written on the resume."
].join("\n");

function aaBuildResumePrompt(text) {
  return AA_RESUME_PROMPT + "\n\nRESUME TEXT:\n" + (text || "(see attached file)");
}

function aaTryParse(t) {
  const attempts = [
    t,
    t.replace(/[\u0000-\u001F]+/g, " "),
    t.replace(/[\u0000-\u001F]+/g, " ").replace(/,\s*([}\]])/g, "$1")
  ];
  for (let i = 0; i < attempts.length; i++) {
    try { return { ok: true, value: JSON.parse(attempts[i]) }; } catch (e) { /* try next */ }
  }
  return { ok: false };
}

function aaRepairJson(t) {
  let s = t.replace(/[\u0000-\u001F]+/g, " ");
  let inStr = false;
  let esc = false;
  const stack = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inStr) s += '"';
  s = s.replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === "{" ? "}" : "]";
  }
  return s.replace(/,\s*([}\]])/g, "$1");
}

function aaParseJsonLoose(s) {
  let t = (s || "").trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const first = t.indexOf("{");
  if (first === -1) throw new Error("No JSON found in the model response.");
  const last = t.lastIndexOf("}");
  const candidates = [];
  if (last > first) candidates.push(t.slice(first, last + 1));
  candidates.push(t.slice(first));
  for (let i = 0; i < candidates.length; i++) {
    const r = aaTryParse(candidates[i]);
    if (r.ok) return r.value;
  }
  return JSON.parse(aaRepairJson(t.slice(first)));
}

async function aaGeminiJson(opts, userText, fileParts) {
  const model = opts.model || "gemini-1.5-flash";
  // Key goes in a header, not the URL, so it can't leak via logs/history.
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
  const parts = [];
  if (fileParts) fileParts.forEach(function (p) { parts.push(p); });
  parts.push({ text: userText });
  const gen = { temperature: 0, responseMimeType: "application/json" };
  if (opts.maxTokens) gen.maxOutputTokens = opts.maxTokens;
  const body = {
    contents: [{ parts: parts }],
    generationConfig: gen
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("Gemini error " + res.status + ": " + (await res.text()).slice(0, 300));
  const data = await res.json();
  let txt = "";
  try { txt = data.candidates[0].content.parts[0].text; } catch (e) { txt = ""; }
  return aaParseJsonLoose(txt);
}

async function aaOpenAIJson(opts, systemText, userText) {
  let url, model;
  if (opts.provider === "groq") {
    url = "https://api.groq.com/openai/v1/chat/completions";
    model = opts.model || "llama-3.3-70b-versatile";
  } else if (opts.provider === "xai") {
    url = "https://api.x.ai/v1/chat/completions";
    model = opts.model || "grok-4";
  } else {
    url = "https://openrouter.ai/api/v1/chat/completions";
    model = opts.model || "meta-llama/llama-3.3-70b-instruct:free";
  }
  const body = {
    model: model,
    temperature: 0,
    messages: [
      { role: "system", content: systemText },
      { role: "user", content: userText }
    ]
  };
  if (opts.provider === "groq" || opts.provider === "xai") body.response_format = { type: "json_object" };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + opts.apiKey },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(opts.provider + " error " + res.status + ": " + (await res.text()).slice(0, 300));
  const data = await res.json();
  let txt = "";
  try { txt = data.choices[0].message.content; } catch (e) { txt = ""; }
  return aaParseJsonLoose(txt);
}

async function aaCallProvider(opts) {
  if (!opts || !opts.apiKey) throw new Error("Add an AI key in AutoApply Options first.");
  const userText = aaBuildResumePrompt(opts.text);
  if (opts.provider === "gemini") {
    const fileParts = opts.fileBase64 ? [{ inline_data: { mime_type: opts.mimeType || "application/pdf", data: opts.fileBase64 } }] : null;
    return aaGeminiJson(opts, userText, fileParts);
  }
  return aaOpenAIJson(opts, "You extract structured data from resumes and reply with valid JSON only.", userText);
}
