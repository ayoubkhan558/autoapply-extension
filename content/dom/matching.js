// Compatibility exclusions and profile/custom-field matching.
// Classic-script module; dependency order is declared in config/modules.json.
function isSearchField(el, sig) {
  // Compatibility alias: never inspect broad ancestor substrings.
  return !!aaControlSkipReason(el, {allowFiles:true, actions:true});
}

function isFillable(el) {
  if (el.disabled || el.readOnly) return false;
  const t = (el.type || "").toLowerCase();
  if (["hidden", "submit", "button", "file", "password", "reset", "image"].indexOf(t) !== -1) return false;
  return true;
}

function customScore(sig, cf) {
  const normText = AutoApplyMatcher.normalize(sig.text);
  const normAttr = AutoApplyMatcher.normalize(sig.attr).replace(/ /g, "");
  const raw = cf.match || cf.label || "";
  const kws = raw.split(",").map(function (s) { return AutoApplyMatcher.normalize(s); }).filter(Boolean);
  let score = 0;
  kws.forEach(function (kw) {
    if (kw.length < 3) return;
    const kwAttr = kw.replace(/ /g, "");
    if (normText === kw || (kwAttr && normAttr === kwAttr)) score = Math.max(score, 0.95);
    else if (kw.length >= 4 && normText.indexOf(kw) !== -1) score = Math.max(score, 0.8);
    else if (kwAttr.length >= 5 && normAttr.indexOf(kwAttr) !== -1) score = Math.max(score, 0.78);
  });
  return score;
}

function resolveValue(sig, flat, customFields) {
  const m = AutoApplyMatcher.match(sig);
  let best = { value: m.key ? flat[m.key] : undefined, score: m.key ? m.score : 0 };
  customFields.forEach(function (cf) {
    if (cf.value === undefined || cf.value === null || cf.value === "") return;
    const s = customScore(sig, cf);
    if (s > best.score) best = { value: cf.value, score: s };
  });
  return best;
}


function valTokens(v) {
  return norm(v).split(/[,/|]+|\band\b/).map(function (s) { return s.trim(); }).filter(Boolean);
}

function isYes(v) { return /^(yes|y|true|1)$/.test(norm(v)); }
function isNo(v) { return /^(no|n|false|0)$/.test(norm(v)); }
