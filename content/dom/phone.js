// Phone number normalization and country-code companions.
// Classic-script module; dependency order is declared in config/modules.json.
function isPhoneField(el, sig) {
  if ((el.type || "").toLowerCase() === "tel") return true;
  const hay = (((sig && sig.text) || "") + " " + ((sig && sig.attr) || "")).toLowerCase();
  return /phone|mobile|\btel\b|cell|contact number|whatsapp/.test(hay);
}

function findCountryCodeSelect(el) {
  let scope = el.parentElement;
  for (let up = 0; up < 4 && scope; up++) {
    let sels;
    try { sels = scope.querySelectorAll("select"); } catch (e) { sels = []; }
    for (let i = 0; i < sels.length; i++) {
      const s = sels[i];
      const hay = norm((s.name || "") + " " + (s.id || "") + " " + (s.getAttribute("aria-label") || ""));
      if (/country.?code|dial.?code|phone.?code|countrycode|isd/.test(hay)) return s;
      for (let o = 0; o < Math.min(s.options.length, 6); o++) {
        if (/^\+?\d{1,4}$/.test((s.options[o].textContent || "").trim())) return s;
      }
    }
    scope = scope.parentElement;
  }
  return null;
}

function normalizePhone(el, sig, value) {
  const v = String(value).trim();
  let digits = v.replace(/[^0-9]/g, "");
  const ph = el.placeholder || "";
  const ccSelect = findCountryCodeSelect(el);
  const maxlen = parseInt(el.getAttribute("maxlength") || "0", 10);
  const wantsCC = /country code|with code|include code|\+/.test((((sig && sig.text) || "") + " " + ph).toLowerCase());
  // Local masks like Bubble "03XXXXXXXXX" — keep leading 0, drop +92 country code.
  if (/^0[\dXx]/.test(ph)) {
    if (digits.length >= 12 && digits.slice(0, 2) === "92") digits = "0" + digits.slice(2);
    else if (digits.length === 10 && digits.charAt(0) === "3") digits = "0" + digits;
    else if (digits.length > 11) digits = digits.slice(-11);
    return digits;
  }
  if (ccSelect || (maxlen > 0 && maxlen <= 11)) {
    let nat = digits;
    if (nat.length > 10) nat = nat.slice(nat.length - 10);
    return nat;
  }
  if (wantsCC && v.charAt(0) !== "+") return "+" + digits;
  return v;
}

// ---- Currency normalization -----------------------------------------
