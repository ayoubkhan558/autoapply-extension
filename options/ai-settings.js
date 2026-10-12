// AI provider defaults and model selector loading.
// Classic-script module; dependency order is declared in config/modules.json.
const DEFAULT_MODELS = {
  gemini: "gemini-1.5-flash",
  groq: "llama-3.3-70b-versatile",
  xai: "grok-4",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free"
};

function setModelOptions(models, selected) {
  const sel = document.getElementById("aiModel");
  sel.innerHTML = "";
  models.forEach(function (m) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    sel.appendChild(opt);
  });
  if (selected && models.some(function (m) { return m.id === selected; })) sel.value = selected;
}

async function loadModels(preferred) {
  const provider = document.getElementById("aiProvider").value;
  const key = document.getElementById("aiKey").value.trim();
  if (provider !== "openrouter" && !key) {
    setModelOptions([{ id: "", label: "Enter API key, then Refresh models" }], "");
    return;
  }
  setAiStatus("Loading models\u2026", "");
  try {
    const resp = await aaSendMessage({ action: "aa-list-models", payload: { provider: provider, apiKey: key } });
    if (!resp || !resp.ok) throw new Error((resp && resp.error) || "Could not load models.");
    const models = resp.models || [];
    if (!models.length) throw new Error("No models returned.");
    setModelOptions(models, preferred || DEFAULT_MODELS[provider]);
    setAiStatus(models.length + " models loaded \u2014 pick one.", "success");
  } catch (err) {
    setModelOptions([{ id: DEFAULT_MODELS[provider], label: DEFAULT_MODELS[provider] + " (default)" }], preferred);
    setAiStatus(String((err && err.message) || err), "error");
  }
}

// Inline feather-style icons for the Profile section's left subtabs, keyed by
// section id. Unknown ids fall back to a generic dot.
