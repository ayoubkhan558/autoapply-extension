// Salary/currency normalization and value transformation.
// Classic-script module; dependency order is declared in config/modules.json.
function isSalaryField(el, sig) {
  const hay = (((sig && sig.text) || "") + " " + ((sig && sig.attr) || "")).toLowerCase();
  return /salary|compensation|\bctc\b|\bpay\b|wage|remuneration/.test(hay);
}

// ponytail: fixed PKR/USD; include currency in profile value or set salaryCurrency
var AA_PKR_USD = 280;

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

function aaConvertSalary(amount, from, to) {
  if (!from || !to || from === to) return amount;
  if (from === "PKR" && to === "USD") return amount / AA_PKR_USD;
  if (from === "USD" && to === "PKR") return amount * AA_PKR_USD;
  return amount;
}

function aaGuessSalaryCurrency(amount, wantCur) {
  if (!amount || !wantCur) return null;
  if (wantCur === "USD" && amount >= 50000) return "PKR";
  if (wantCur === "PKR" && amount > 0 && amount <= 500) return "USD";
  return null;
}

function normalizeCurrency(el, sig, value) {
  const meta = aaParseSalary(value, sig && sig.salaryCurrency);
  let n = meta.amount;
  if (n === null) return String(value).replace(/[^0-9.]/g, "") || value;
  const want = aaSalaryFieldWant(sig, el);
  let cur = meta.currency || aaGuessSalaryCurrency(n, want.currency);
  if (!meta.period && n >= 500000 && (!cur || cur === "PKR")) {
    n = n / 12;
    meta.period = "month";
  }
  if (want.period && meta.period && want.period !== meta.period) {
    if (meta.period === "year" && want.period === "month") n = n / 12;
    else if (meta.period === "month" && want.period === "year") n = n * 12;
  }
  if (want.currency && cur) n = aaConvertSalary(n, cur, want.currency);
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
