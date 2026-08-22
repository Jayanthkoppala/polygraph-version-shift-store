const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

function option(name) {
  const position = process.argv.indexOf(name);
  return position === -1 ? undefined : process.argv[position + 1];
}

const target = option('--target');
const state = option('--state') || 'version.json';
const mutation = option('--mutation') || 'none';
if (!['v1', 'v2', 'v3'].includes(target)) fail('pass --target v1, --target v2, or --target v3');

const manifest = JSON.parse(read(state));
const source = `versions/${target}.html`;
const selected = read(source);
const index = read('index.html');
const expectedKeys = ['cache', 'commits', 'generation', 'mission_id', 'mutation', 'published_at', 'source', 'source_sha256', 'version'];
const actualKeys = Object.keys(manifest).sort();

if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
  fail(`manifest schema mismatch: expected ${expectedKeys.join(', ')}, found ${actualKeys.join(', ')}`);
}
pass('manifest has the complete fixture schema');

if (manifest.version !== target) fail(`manifest version expected ${target}, found ${manifest.version}`);
if (manifest.mutation !== mutation) fail(`manifest mutation expected ${mutation}, found ${manifest.mutation}`);
if (!Number.isInteger(manifest.generation) || manifest.generation <= 0) fail('manifest generation must be a positive integer');
if (manifest.source !== source) fail(`manifest source expected ${source}, found ${manifest.source}`);
if (!/^[a-f0-9]{64}$/.test(manifest.source_sha256)) fail('manifest source_sha256 must be a SHA-256 hex digest');
if (manifest.source_sha256 !== sha256(selected)) fail('manifest source_sha256 does not match selected source bytes');
if (typeof manifest.published_at !== 'string' || Number.isNaN(Date.parse(manifest.published_at))) fail('manifest published_at must be an ISO timestamp');
if (manifest.cache !== `rev-${target}-${manifest.generation}`) fail('manifest cache must match selected version and generation');
if (manifest.mission_id !== null && (typeof manifest.mission_id !== 'string' || manifest.mission_id.length === 0)) fail('manifest mission_id must be null or a non-empty string');
if (!['none', 'dom-drift', 'selector-break', 'decoy', 'metadata-only'].includes(manifest.mutation)) fail('manifest mutation is invalid');
if (!Array.isArray(manifest.commits) || !manifest.commits.every((commit) => typeof commit === 'string' && /^[a-f0-9]{7,64}$/i.test(commit))) fail('manifest commits must be an array of commit SHAs');
pass(`manifest targets ${target} generation ${manifest.generation} with matching SHA-256`);

if (mutation === 'none' && index !== selected) fail(`index.html is not byte-identical to ${source}`);
if (mutation === 'none') pass(`index.html is byte-identical to ${source}`);
else pass(`index.html contains the requested ${mutation} mutation`);
if (mutation === 'selector-break') {
  if (index.includes('class="product-price"') || index.includes('class="money-widget__value"') || index.includes('class="commerce-amount"') || index.includes('class="listing-price__amount"')) fail('selector-break must remove every versioned price selector');
  if (count(index, 'class="amount-value"') !== 1) fail('selector-break must publish exactly one replacement amount-value selector');
  pass('selector-break removes the selected version price anchor exactly once');
}

for (const [version, html] of [['v1', read('versions/v1.html')], ['v2', read('versions/v2.html')], ['v3', read('versions/v3.html')]]) {
  if (html.includes('meta name="fixture-price"')) fail(`${version} leaks the price through metadata`);
  if (count(html, '£51.77') !== 1) fail(`${version} must expose the price exactly once`);
  if (html.includes('<div>Price:</div>') || html.includes('<span>Price:</span>')) fail(`${version} leaks the price through evidence/footer markup`);
}
pass('price is absent from identical metadata and evidence/footer locations');

const v1 = read('versions/v1.html');
const v2 = read('versions/v2.html');
const v3 = read('versions/v3.html');
if (count(v1, 'class="money-widget__value"') !== 1 || !v1.includes('class="money-widget__value" aria-label="product amount">£51.77')) fail('V1 must expose the current .money-widget__value anchor exactly once');
if (v2.includes('money-widget__value') || count(v2, 'class="commerce-amount"') !== 1 || !v2.includes('class="commerce-amount" aria-label="product amount">£51.77')) fail('V2 must expose the price only via the structurally different .commerce-amount selector');
if (v3.includes('money-widget__value') || v3.includes('commerce-amount') || count(v3, 'class="listing-price__amount"') !== 1 || !v3.includes('class="listing-price__amount" aria-label="product amount">£51.77')) fail('V3 must expose the price only via the append-only .listing-price__amount selector');
pass('V1, V2, and V3 selectors have the exact expected outcome');

execFileSync(process.execPath, [path.join(root, 'scripts/smoke-source-contract.js')], { stdio: 'inherit' });

if (!fs.existsSync(path.join(root, '.github/workflows/switch-version.yml'))) fail('workflow file missing');
pass('workflow file exists');
console.log('All target-aware fixture smoke checks passed.');
