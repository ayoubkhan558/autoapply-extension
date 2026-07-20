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

const AA_ANALYZE_SYSTEM = "You are a precise job-fit analyst. Reply with a single minified JSON object only. No markdown, no code fences, and no line breaks inside string values.";

function aaBuildAnalyzePrompt(profile, jobText) {
  const profStr = JSON.stringify(profile || {});
  return [
    "Compare the CANDIDATE PROFILE to the JOB POSTING and return JSON ONLY with these keys:",
    "matchScore: integer 0-100 for how well the candidate fits.",
    "summary: ONE short sentence, max 25 words (keep it brief so the rest of the JSON is not cut off).",
    "missing: array of strings naming required skills or qualifications the candidate lacks or should strengthen.",
    "resumeTips: array of strings with concrete edits to tailor the resume to THIS job.",
    "salary: object with estimate (a pay range as text, your best guess from role, location and posting), basis (short note on how you estimated), and vsDesired (one of below, in range, above, unknown compared to the candidate desiredSalary if present).",
    "Keep each array to at most 6 concise items.",
    "",
    "CANDIDATE PROFILE (JSON):",
    profStr,
    "",
    "JOB POSTING (text):",
    (jobText || "").slice(0, 6000)
  ].join("\n");
}

async function aaAnalyzeJob(opts) {
  if (!opts || !opts.apiKey) throw new Error("Add an AI key in AutoApply Options first.");
  const o = Object.assign({}, opts, { maxTokens: opts.maxTokens || 2048 });
  const prompt = aaBuildAnalyzePrompt(o.profile, o.jobText);
  if (o.provider === "gemini") return aaGeminiJson(o, prompt, null);
  return aaOpenAIJson(o, AA_ANALYZE_SYSTEM, prompt);
}

async function aaListGemini(opts) {
  if (!opts.apiKey) throw new Error("Enter your Gemini API key first.");
  const url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200";
  const res = await fetch(url, { headers: { "x-goog-api-key": opts.apiKey } });
  if (!res.ok) throw new Error("Gemini error " + res.status + ": " + (await res.text()).slice(0, 200));
  const data = await res.json();
  return (data.models || []).filter(function (m) {
    return (m.supportedGenerationMethods || []).indexOf("generateContent") !== -1;
  }).map(function (m) {
    const id = String(m.name || "").replace(/^models\//, "");
    return { id: id, label: m.displayName ? (m.displayName + " (" + id + ")") : id };
  });
}

async function aaListGroq(opts) {
  if (!opts.apiKey) throw new Error("Enter your Groq API key first.");
  const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { "Authorization": "Bearer " + opts.apiKey } });
  if (!res.ok) throw new Error("Groq error " + res.status + ": " + (await res.text()).slice(0, 200));
  const data = await res.json();
  return (data.data || [])
    .filter(function (m) { return !/whisper|tts|guard|distil/i.test(m.id); })
    .map(function (m) { return { id: m.id, label: m.id }; });
}

async function aaListXai(opts) {
  if (!opts.apiKey) throw new Error("Enter your xAI API key first.");
  const res = await fetch("https://api.x.ai/v1/models", { headers: { "Authorization": "Bearer " + opts.apiKey } });
  if (!res.ok) throw new Error("xAI error " + res.status + ": " + (await res.text()).slice(0, 200));
  const data = await res.json();
  return (data.data || [])
    .filter(function (m) { return /^grok/i.test(m.id) && !/image|vision|tts|voice|embed/i.test(m.id); })
    .map(function (m) { return { id: m.id, label: m.id }; });
}

async function aaListOpenRouter(opts) {
  const headers = {};
  if (opts.apiKey) headers["Authorization"] = "Bearer " + opts.apiKey;
  const res = await fetch("https://openrouter.ai/api/v1/models", { headers: headers });
  if (!res.ok) throw new Error("OpenRouter error " + res.status + ": " + (await res.text()).slice(0, 200));
  const data = await res.json();
  const list = (data.data || []).map(function (m) { return { id: m.id, label: m.name || m.id }; });
  const free = list.filter(function (m) { return /:free$/.test(m.id); });
  const use = free.length ? free : list;
  use.sort(function (a, b) { return String(a.label).localeCompare(String(b.label)); });
  return use;
}

async function aaListModels(opts) {
  if (!opts || !opts.provider) throw new Error("Missing provider.");
  if (opts.provider === "gemini") return aaListGemini(opts);
  if (opts.provider === "groq") return aaListGroq(opts);
  if (opts.provider === "xai") return aaListXai(opts);
  return aaListOpenRouter(opts);
}

const AA_ANSWER_SYSTEM = "You are the job candidate writing first-person answers to application questions. Be concise, specific, and truthful using ONLY the provided profile. Reply with a single minified JSON object only. No markdown, no code fences.";

function aaBuildAnswerPrompt(profile, questions, jobText) {
  const profStr = JSON.stringify(profile || {});
  return [
    "Using the CANDIDATE PROFILE, write a first-person answer for each application question.",
    "Return JSON ONLY in this shape: { \"answers\": [\"answer to question 1\", \"answer to question 2\"] }",
    "Put answers in the SAME ORDER as the questions. The answers array length MUST equal the number of questions.",
    "Each answer: 2-5 sentences, professional and specific to the role, no placeholders like [Name], no markdown, no line breaks.",
    "If the profile lacks the facts to answer a question, keep the answer brief, honest, and generic; NEVER invent employers, job titles, dates, numbers, degrees, or credentials.",
    "",
    "CANDIDATE PROFILE (JSON):",
    profStr,
    "",
    "JOB CONTEXT (optional text):",
    (jobText || "").slice(0, 2000),
    "",
    "QUESTIONS (JSON array of strings):",
    JSON.stringify(questions || [])
  ].join("\n");
}

async function aaAnswerQuestions(opts) {
  if (!opts || !opts.apiKey) throw new Error("Add an AI key in AutoApply Options first.");
  const o = Object.assign({}, opts, { maxTokens: opts.maxTokens || 2048 });
  const prompt = aaBuildAnswerPrompt(o.profile, o.questions, o.jobText);
  if (o.provider === "gemini") return aaGeminiJson(o, prompt, null);
  return aaOpenAIJson(o, AA_ANSWER_SYSTEM, prompt);
}

// ---- Email + cover-letter generation ----
// Drafts a ready-to-send application (subject, outreach email, and full cover
// letter) by combining the candidate profile with the job posting text. Like
// the other AI helpers it returns a single JSON object and never invents facts.
const AA_APP_SYSTEM = "You are an expert career writer helping a job candidate. Write in the candidate's own first-person voice using ONLY the provided profile; never invent employers, degrees, or facts. Reply with a single minified JSON object only. No markdown, no code fences, and no literal line breaks inside string values \u2014 use the two characters backslash-n for paragraph breaks.";

function aaBuildApplicationPrompt(profile, jobText, opts) {
  const profStr = JSON.stringify(profile || {});
  const tone = (opts && opts.tone) || "professional and warm";
  return [
    "Write a tailored job application for the CANDIDATE based on the JOB POSTING.",
    "Return JSON ONLY with these keys:",
    "company: the hiring company name if present in the posting, else an empty string.",
    "role: the job title if present in the posting, else an empty string.",
    "subject: a concise, specific email subject line for the application.",
    "email: a short outreach email of 120-180 words to accompany the application. Greet, name the role, give 2-3 sentences on fit drawn from the profile, and close politely. Separate paragraphs with \\n. Sign off with the candidate's full name.",
    "coverLetter: a full cover letter of 250-350 words, first person, tailored to THIS job, highlighting the most relevant skills and experience from the profile. Separate paragraphs with \\n.",
    "Tone: " + tone + ". Never use bracketed placeholders like [Company] or [Name]; if a detail is unknown, write naturally without it.",
    "",
    "CANDIDATE PROFILE (JSON):",
    profStr,
    "",
    "JOB POSTING (text):",
    (jobText || "").slice(0, 6000)
  ].join("\n");
}

async function aaGenerateApplication(opts) {
  if (!opts || !opts.apiKey) throw new Error("Add an AI key in AutoApply Options first.");
  const o = Object.assign({}, opts, { maxTokens: opts.maxTokens || 2048 });
  const prompt = aaBuildApplicationPrompt(o.profile, o.jobText, o);
  if (o.provider === "gemini") return aaGeminiJson(o, prompt, null);
  return aaOpenAIJson(o, AA_APP_SYSTEM, prompt);
}

if (typeof self !== "undefined") {
  self.aaCallProvider = aaCallProvider;
  self.aaAnalyzeJob = aaAnalyzeJob;
  self.aaAnswerQuestions = aaAnswerQuestions;
  self.aaGenerateApplication = aaGenerateApplication;
  self.aaListModels = aaListModels;
}
