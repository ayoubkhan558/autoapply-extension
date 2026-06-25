// =====================================================================
// AutoApply — field matcher
// =====================================================================
// Scores a web form field (its label text + identifying attributes) against
// the shared field registry and returns the best-matching profile key.
//
// The list of fields + their synonyms lives in ONE place: lib/fields.js
// (AA_FIELD_DEFS). This file only contains the scoring logic. To add or tune a
// field, edit lib/fields.js — not this file.
//
// Load order matters: lib/fields.js must be loaded before lib/matcher.js.
// =====================================================================

// Build the matcher's working list from the shared registry. Each item is
// { key: "group.name", words: [...visible label synonyms...], attrs: [...id/name synonyms...] }.
var AUTOFILL_FIELDS = (typeof aaMatcherFields === "function") ? aaMatcherFields() : [];

// Normalize free text for comparison: lowercase, turn separators into spaces,
// drop punctuation, and collapse whitespace.
function aaNormalize(s) {
  return (s || "").toString().toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Score one field signature ({ text, attr }) against every registry entry and
// return the best { key, score }. Scoring (highest wins):
//   attr exact match ............ 1.00
//   attr substring (len >= 4) ... 0.85
//   label text exact match ...... 0.95
//   label text substring ........ 0.70
function aaMatchSignature(sig) {
  var normText = aaNormalize(sig.text);
  // Attribute identifiers are compared without spaces (e.g. "first name" -> "firstname").
  var normAttr = aaNormalize(sig.attr).replace(/ /g, "");
  var best = null;
  var bestScore = 0;
  for (var i = 0; i < AUTOFILL_FIELDS.length; i++) {
    var def = AUTOFILL_FIELDS[i];
    var score = 0;
    // Match against attribute synonyms (name/id/autocomplete/etc.).
    for (var a = 0; a < def.attrs.length; a++) {
      var at = def.attrs[a];
      if (normAttr === at) { score = Math.max(score, 1.0); }
      else if (at.length >= 4 && normAttr.indexOf(at) !== -1) { score = Math.max(score, 0.85); }
    }
    // Match against visible label / placeholder synonyms.
    for (var w = 0; w < def.words.length; w++) {
      var word = def.words[w];
      if (normText === word) { score = Math.max(score, 0.95); }
      else if (normText.indexOf(word) !== -1) { score = Math.max(score, 0.7); }
    }
    if (score > bestScore) { bestScore = score; best = def.key; }
  }
  return { key: best, score: bestScore };
}

// Public API used by the content script.
var AutoApplyMatcher = { fields: AUTOFILL_FIELDS, normalize: aaNormalize, match: aaMatchSignature };
