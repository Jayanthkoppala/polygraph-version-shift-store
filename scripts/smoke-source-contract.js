const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const canonicalPath = path.join(root, 'versions/v2.html');
const generatorPath = path.join(root, 'scripts/generate-generation.js');
const workflowPath = path.join(root, '.github/workflows/switch-version.yml');
const html = fs.readFileSync(canonicalPath, 'utf8');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const fail = (message) => { console.error(`✗ ${message}`); process.exit(1); };
const pass = (message) => console.log(`✓ ${message}`);

for (const value of ['Product/Code-123', 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue', '£51.77', '<h2 class="stock-status">In stock</h2>']) {
  if (!html.includes(value)) fail(`canonical fixture lost ${value}`);
}
for (const anchor of ['data-catalog-key=', 'class="catalog-heading"', 'class="commerce-amount"']) {
  if (!html.includes(anchor)) fail(`canonical fixture must retain its source anchor ${anchor}`);
}
for (const presentationHook of [
  '.identity>:first-child{display:block;font-size:25px;line-height:1.24;font-weight:500;text-wrap:balance;margin:0 0 9px}',
  '.pricebox>:nth-child(2){display:block;font-size:31px;letter-spacing:-1.5px;color:var(--red);margin:2px 0 7px}',
]) {
  if (!html.includes(presentationHook)) fail(`canonical fixture must retain presentation hook ${presentationHook}`);
}
pass('canonical source retains the stable product contract and source anchors');

if (!fs.existsSync(generatorPath)) fail('seeded generator missing');
for (const input of ['generation:', 'parent_generation:', 'seed:', 'mission_id:', 'fixture-production-evolution', 'scripts/generate-generation.js']) {
  if (!workflow.includes(input)) fail(`evolution workflow missing ${input}`);
}
if (workflow.includes('TARGET_VERSION') || workflow.includes('MUTATION')) fail('workflow must not use fixed version or mutation dispatches');
pass('workflow dispatches deterministic generation evolution only');
