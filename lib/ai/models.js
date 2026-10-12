// Provider model-list retrieval and dispatch.
// Classic-script module; dependency order is declared in config/modules.json.
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
