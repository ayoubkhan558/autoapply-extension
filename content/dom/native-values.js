// Framework-compatible setters, events, and native select matching.
// Classic-script module; dependency order is declared in config/modules.json.
function setNativeValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc && desc.set) { desc.set.call(el, value); }
  else { el.value = value; }
}

function setRichTextValue(el, value) {
  const v = String(value || "");
  el.focus();
  try { document.execCommand("selectAll", false, null); document.execCommand("insertText", false, v); } catch (e) { /* fallback below */ }
  if ((el.innerText || el.textContent || "").trim() !== v.trim()) {
    el.innerHTML = "";
    v.split(/\n/).forEach(function (line) {
      const block = document.createElement("div");
      block.className = "ql-block";
      block.textContent = line || " ";
      el.appendChild(block);
    });
  }
  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: v }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

function fireEvents(el) {
  // Bubble.io (and similar) listen for InputEvent, not plain Event("input").
  try {
    el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: el.value }));
  } catch (e) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

function fillTextLike(el, value) {
  let v = String(value);
  const t = (el.type || "").toLowerCase();
  if (t === "number" || t === "range") {
    const num = v.replace(/[^0-9.\-]/g, "");
    if (num === "" || isNaN(Number(num))) return false;
    v = num;
  }
  if (el.isContentEditable) setRichTextValue(el, v);
  else { try { el.focus(); } catch (e) { /* ignore */ } setNativeValue(el, v); fireEvents(el); }
  return true;
}

// Commit a <select> choice through the native value setter so framework
// (React/Vue/Angular) controlled selects register the change, then fire the
// events they listen to.
function commitSelect(el, idx) {
  const desc = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
  if (desc && desc.set) desc.set.call(el, el.options[idx].value);
  el.selectedIndex = idx;
  try { el.focus(); } catch (e) { /* ignore */ }
  try {
    el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertReplacementText" }));
  } catch (e) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillSelect(el, value) {
  let rawValue = String(value || "");
  const sigText = norm(getLabelText(el) + " " + getAttrText(el));
  // Day dropdowns use bare numbers (0/7/14/30) — strip "days", don't append them.
  const isNotice = /notice|how soon can you join/.test(sigText);
  if (isNotice) rawValue = rawValue.replace(/\s*days?$/i, "").trim();
  const target = norm(rawValue);
  if (!target) return false;
  const opts = el.options;
  // Notice: exact digit match first (profile "30 days" → option "30").
  if (isNotice) {
    const n = (String(value).match(/\d+/) || [""])[0];
    if (n) {
      for (let i = 0; i < opts.length; i++) {
        if (norm(opts[i].textContent) === n || norm(opts[i].value) === n) {
          commitSelect(el, i);
          return true;
        }
      }
    }
  }
  for (let i = 0; i < opts.length; i++) {
    if (norm(opts[i].textContent) === target || norm(opts[i].value) === target) {
      commitSelect(el, i);
      return true;
    }
  }
  let bestIdx = -1;
  let bestDiff = Infinity;
  for (let i = 0; i < opts.length; i++) {
    const tx = norm(opts[i].textContent);
    if (!tx || /^(--|select|choose|please|no answer|none|any)\b/.test(tx)) continue;
    if (target.length >= 3 && (tx.indexOf(target) !== -1 || target.indexOf(tx) !== -1)) {
      const diff = Math.abs(tx.length - target.length);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
  }
  // Token-overlap fallback, e.g. profile "Bachelor's Degree, Computer Science"
  // vs option "Bachelors".
  if (bestIdx === -1) {
    const tokens = valTokens(value);
    for (let i = 0; i < opts.length && bestIdx === -1; i++) {
      const tx = norm(opts[i].textContent);
      if (!tx || /^(--|select|choose|please|no answer|none|any)\b/.test(tx)) continue;
      if (tokens.some(function (tk) { return tk.length >= 3 && (tx === tk || tx.indexOf(tk) !== -1); })) bestIdx = i;
    }
  }
  // Notice-period fallback: map "immediate" → 0.
  if (bestIdx === -1 && isNotice) {
    if (/immediate|^0$/.test(target)) {
      for (let i = 0; i < opts.length; i++) if (/immediate|^0$/.test(norm(opts[i].textContent + " " + opts[i].value))) { bestIdx = i; break; }
    }
  }
  // Boolean fallback: map yes/no-ish profile values onto "Yes ..." / "No ..." options.
  if (bestIdx === -1 && (isYes(value) || isNo(value))) {
    const want = isYes(value) ? /^y(es)?\b/ : /^no?\b/;
    for (let i = 0; i < opts.length && bestIdx === -1; i++) {
      if (want.test(norm(opts[i].textContent))) bestIdx = i;
    }
  }
  if (bestIdx !== -1) {
    commitSelect(el, bestIdx);
    return true;
  }
  return false;
}
