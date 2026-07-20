// one-shot splitter: content.js IIFE -> content/*.js modules. Not shipped.
const fs = require("fs");

const src = fs.readFileSync("content.js", "utf8");
const start = src.indexOf("(function () {");
const end = src.lastIndexOf("})();");
if (start < 0 || end < 0) throw new Error("IIFE markers not found");

let body = src.slice(start + "(function () {".length, end);
body = body.replace(/^\s*if \(window\.__autoApplyContentLoaded\) return;\s*\n\s*window\.__autoApplyContentLoaded = true;\s*\n/, "");
body = body.split("\n").map(function (l) {
  if (l.startsWith("  ")) l = l.slice(2);
  if (/^(const|let) /.test(l)) l = "var " + l.replace(/^(const|let) /, "");
  return l;
}).join("\n").replace(/^\n+/, "").replace(/\n+$/, "\n");

const lines = body.split("\n");
function find(re) {
  const i = lines.findIndex(function (l) { return re.test(l); });
  if (i < 0) throw new Error("marker not found: " + re);
  return i;
}

const iFill = find(/Fill context \+ planners/);
const iPanel = find(/Job fit analysis/);
const iDetect = find(/Form detection \(gated/);
const iFieldAi = find(/Per-field AI fill button/);
const iDetectTimers = find(/\[400, 1200, 2500/);
const iSetupCall = find(/try \{ aaSetupFieldAi/);
const iListener = find(/chrome\.runtime\.onMessage\.addListener/);

function slice(a, b) { return lines.slice(a, b).join("\n").replace(/\n+$/, "\n"); }

fs.mkdirSync("content", { recursive: true });
const header = "// AutoApply content module. Loaded into the extension isolated world.\n";

fs.writeFileSync("content/dom.js", header + "// DOM helpers, value transforms, fill primitives.\n" + slice(0, iFill));
fs.writeFileSync("content/fill.js", header + "// Profile flatten, planners, custom selects, repeaters, main fill run.\n" + slice(iFill, iPanel));
fs.writeFileSync("content/panel.js", header + "// On-page panels: analysis, answers, application draft, fill result, lasso.\n" + slice(iPanel, iDetect));
fs.writeFileSync("content/detect.js", header + "// Form detection + toolbar toast.\n" + slice(iDetect, iDetectTimers));
fs.writeFileSync("content/field-ai.js", header + "// Per-field AI fill button.\n" + slice(iFieldAi, iSetupCall));

const listener = slice(iListener, lines.length).trimEnd() + "\n";
const boot = header + [
  "// Boot: register listeners once. Sibling modules only define helpers.",
  "if (!window.__autoApplyContentLoaded) {",
  "  window.__autoApplyContentLoaded = true;",
  "  try { aaSetupFieldAi(); } catch (e) { /* ignore */ }",
  "  try { [400, 1200, 2500, 4500, 7000].forEach(function (ms) { setTimeout(aaReportDetection, ms); }); } catch (e) { /* ignore */ }",
  "",
  listener.split("\n").map(function (l) { return l ? "  " + l : l; }).join("\n"),
  "}",
  ""
].join("\n");
fs.writeFileSync("content.js", boot);

["content/dom.js", "content/fill.js", "content/panel.js", "content/detect.js", "content/field-ai.js", "content.js"].forEach(function (f) {
  console.log(fs.readFileSync(f, "utf8").split("\n").length + "\t" + f);
});
