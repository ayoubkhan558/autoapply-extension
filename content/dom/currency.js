// Salary/currency normalization and value transformation.
// Classic-script module; dependency order is declared in config/modules.json.
function isSalaryField(el, sig) {
  const hay = (((sig && sig.text) || "") + " " + ((sig && sig.attr) || "")).toLowerCase();
  return /salary|compensation|\bctc\b|\bpay\b|wage|remuneration/.test(hay);
}

function aaParseSalary(value, profileCurrency) {
  const raw = String(value || "");
  const low = norm(raw);
  let currency = profileCurrency ? norm(profileCurrency).toUpperCase().replace(/[^A-Z]/g, "") : "";
  if (currency === "RS") currency = "PKR";
  if (/\busd\b|\$|dollar/.test(low)) currency = "USD";
  else if (/\bpkr\b|₨|rupee|\brs\b/.test(low)) currency = "PKR";
  let period = null;
  if (/month|\/mo\b|per month|monthly/.test(low)) period = "month";
  else if (/year|annual|annum|\/yr|per year|yearly|\bctc\b/.test(low)) period = "year";
  const amount = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return { amount: isNaN(amount) ? null : amount, currency: currency || null, period: period };
}

function aaSalaryFieldWant(sig, el) {
  const hay = norm(((sig && sig.text) || "") + " " + ((sig && sig.attr) || "") + " " + ((el && el.placeholder) || ""));
  let currency = null;
  if (/\busd\b|\$|dollar/.test(hay)) currency = "USD";
  else if (/\bpkr\b|₨|rupee|\brs\b/.test(hay)) currency = "PKR";
  let period = null;
  if (/month|monthly|per month/.test(hay)) period = "month";
  else if (/year|annual|annum|per year|yearly|\bctc\b/.test(hay)) period = "year";
  return { currency: currency, period: period };
}

function normalizeCurrency(el, sig, value) {
  const meta = aaParseSalary(value, sig && sig.salaryCurrency);
  let n = meta.amount;
  if (n === null) return String(value).replace(/[^0-9.]/g, "") || value;
  const want = aaSalaryFieldWant(sig, el);
  // Do not guess a currency, pay period, or exchange rate for a job application.
  if (want.currency && (!meta.currency || want.currency !== meta.currency)) return "";
  if (want.period && !meta.period) return "";
  if (want.period && meta.period && want.period !== meta.period) {
    if (meta.period === "year" && want.period === "month") n = n / 12;
    else if (meta.period === "month" && want.period === "year") n = n * 12;
  }
  n = Math.round(n);
  const t = (el.type || "").toLowerCase();
  if (t === "number" || t === "range") return String(n);
  const hay = norm((el.placeholder || "") + " " + ((sig && sig.attr) || ""));
  if (/amount|number|\bnum\b|digits/.test(hay)) return String(n);
  return String(n);
}

function transformValue(el, sig, value) {
  try {
    if (isDateField(el, sig)) return normalizeDate(el, sig, value);
    if (isPhoneField(el, sig)) return normalizePhone(el, sig, value);
    if (isSalaryField(el, sig)) return normalizeCurrency(el, sig, value);
  } catch (e) { /* ignore */ }
  return value;
}

// ---- Appliers -------------------------------------------------------
