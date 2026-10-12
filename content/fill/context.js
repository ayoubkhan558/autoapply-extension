// Active profile context, stored attachments, and display labels.
// Classic-script module; dependency order is declared in config/modules.json.
// AutoApply content module. Loaded into the extension isolated world.
// Profile flatten, planners, custom selects, repeaters, main fill run.
// ---- Fill context + planners ----------------------------------------
async function aaFillContext() {
  const data = await aaLoadData();
  const profile = aaGetActiveProfile(data);
  if (!profile) return null;
  const flat = buildFlat(profile);
  const customFields = Array.isArray(profile.customFields) ? profile.customFields : [];
  let skillsRaw = (profile.professional && profile.professional.skills) || "";
  if (Array.isArray(skillsRaw)) skillsRaw = skillsRaw.join(", ");
  const skillTokens = valTokens(skillsRaw);
  return { profile: profile, flat: flat, customFields: customFields, skillTokens: skillTokens };
}

// Load the CV/resume saved for the currently active profile (per-profile storage).
async function aaLoadActiveResume() {
  try {
    const data = await aaLoadData();
    return await aaGetResume(data && data.activeProfileId);
  } catch (e) { return null; }
}

async function aaLoadActivePhoto() {
  try {
    const data = await aaLoadData();
    return await aaGetPhoto(data && data.activeProfileId);
  } catch (e) { return null; }
}

async function aaLoadActiveCoverLetter() {
  try {
    const data = await aaLoadData();
    return await aaGetCoverLetter(data && data.activeProfileId);
  } catch (e) { return null; }
}

async function aaLoadActiveResumeText() {
  try {
    const data = await aaLoadData();
    return await aaGetResumeText(data && data.activeProfileId);
  } catch (e) { return ""; }
}

function displayLabel(sig, el) {
  let t = ((sig && sig.text) || "").trim();
  if (!t) t = ((sig && sig.attr) || "").trim();
  t = t.replace(/\s+/g, " ");
  if (t.length > 64) t = t.slice(0, 61) + "\u2026";
  return t || "Field";
}
