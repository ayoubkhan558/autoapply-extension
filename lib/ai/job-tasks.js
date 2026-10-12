// Job-fit, question-answering, and application-generation prompts/tasks.
// Classic-script module; dependency order is declared in config/modules.json.
const AA_ANALYZE_SYSTEM = "You are a precise job-fit analyst. Reply with a single minified JSON object only. No markdown, no code fences, and no line breaks inside string values.";

function aaBuildAnalyzePrompt(profile, jobText, resumeText) {
  const profStr = JSON.stringify(profile || {});
  const lines = [
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
  ];
  const rt = (resumeText || "").trim();
  if (rt) lines.push("", "CANDIDATE RESUME / CV (text):", rt.slice(0, 12000));
  return lines.join("\n");
}

async function aaAnalyzeJob(opts) {
  if (!opts || !opts.apiKey) throw new Error("Add an AI key in AutoApply Options first.");
  const o = Object.assign({}, opts, { maxTokens: opts.maxTokens || 2048 });
  const prompt = aaBuildAnalyzePrompt(o.profile, o.jobText, o.resumeText);
  if (o.provider === "gemini") return aaGeminiJson(o, prompt, null);
  return aaOpenAIJson(o, AA_ANALYZE_SYSTEM, prompt);
}


const AA_ANSWER_SYSTEM = "You are the job candidate writing first-person answers to application questions. Be concise, specific, and truthful using ONLY the provided profile. Reply with a single minified JSON object only. No markdown, no code fences.";

function aaBuildAnswerPrompt(profile, questions, jobText, resumeText) {
  const profStr = JSON.stringify(profile || {});
  const lines = [
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
  ];
  const rt = (resumeText || "").trim();
  if (rt) lines.push("", "CANDIDATE RESUME / CV (text):", rt.slice(0, 12000));
  return lines.join("\n");
}

async function aaAnswerQuestions(opts) {
  if (!opts || !opts.apiKey) throw new Error("Add an AI key in AutoApply Options first.");
  const o = Object.assign({}, opts, { maxTokens: opts.maxTokens || 2048 });
  const prompt = aaBuildAnswerPrompt(o.profile, o.questions, o.jobText, o.resumeText);
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
  const lines = [
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
  ];
  const rt = (opts && opts.resumeText || "").trim();
  if (rt) lines.push("", "CANDIDATE RESUME / CV (text):", rt.slice(0, 12000));
  return lines.join("\n");
}

async function aaGenerateApplication(opts) {
  if (!opts || !opts.apiKey) throw new Error("Add an AI key in AutoApply Options first.");
  const o = Object.assign({}, opts, { maxTokens: opts.maxTokens || 2048 });
  const prompt = aaBuildApplicationPrompt(o.profile, o.jobText, o);
  if (o.provider === "gemini") return aaGeminiJson(o, prompt, null);
  return aaOpenAIJson(o, AA_APP_SYSTEM, prompt);
}
