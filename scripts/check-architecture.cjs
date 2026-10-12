// Enforce small files, syntax, dependency lists, and complete loader coverage.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const limit = 300;
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full);
    else files.push(path.relative(root, full).split(path.sep).join('/'));
  }
}
walk(root);
let largest = { lines: 0, file: '' };
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (/\.(?:js|cjs|mjs|css|html)$/.test(file)) {
    const lines = text.trimEnd().split(/\r?\n/).length;
    if (lines > limit) throw new Error(`${file}: ${lines} lines exceeds ${limit}`);
    if (lines > largest.lines) largest = { lines, file };
  }
  if (/\.(?:js|cjs)$/.test(file)) new vm.Script(text, { filename: file });
  if (file.endsWith('.css')) postcss.parse(text, { from: file });
  if (file.endsWith('.json')) JSON.parse(text);
}
const config = require('../config/modules.json');
const referenced = new Set();
for (const [key, list] of Object.entries(config)) {
  if (!Array.isArray(list) || list.length === 0) throw new Error('Invalid list: ' + key);
  if (new Set(list).size !== list.length) throw new Error('Duplicate modules in ' + key);
  for (const file of list) {
    if (!files.includes(file)) throw new Error('Missing module: ' + file);
    referenced.add(file);
  }
}
// Parsing concatenated scripts catches duplicate lexical bindings across files.
for (const key of ['contentJs', 'optionsJs', 'popupJs', 'backgroundJs']) {
  const source = config[key].map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
  new vm.Script(source, { filename: key });
}
for (const file of files.filter((f) => /^(content|options|popup|lib)\//.test(f) && /\.(js|css)$/.test(f))) {
  if (!referenced.has(file)) throw new Error('Unloaded runtime source: ' + file);
}
for (const html of ['options/options.html', 'popup/popup.html']) {
  const source = fs.readFileSync(path.join(root, html), 'utf8');
  for (const match of source.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(?:https?:|data:)/.test(match[1])) continue;
    if (!fs.existsSync(path.resolve(root, path.dirname(html), match[1]))) {
      throw new Error('Missing HTML asset: ' + match[1]);
    }
  }
}
if (config.contentJs.at(-1) !== 'content.js' || config.optionsJs.at(-1) !== 'options/options.js') {
  throw new Error('Bootstrap scripts must load last.');
}
execFileSync(process.execPath, ['scripts/sync-modules.cjs', '--check'], { cwd: root, stdio: 'inherit' });
console.log(`Architecture checks passed. Largest code file: ${largest.file} (${largest.lines}/${limit} lines).`);
