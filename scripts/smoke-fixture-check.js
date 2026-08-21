const fs = require('fs');
const path = require('path');

function read(p) {
  return fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function contains(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`${label}: expected to find "${needle}"`);
  pass(`${label}: found "${needle}"`);
}

function extractPrice(html, label) {
  const m = html.match(/£\s*51\.77/g);
  return m ? m : [];
}

function extractSku(html) {
  const sku = html.match(/SKU-ASTER-001/g);
  return sku ? sku.length : 0;
}

const v1 = read('versions/v1.html');
const v2 = read('versions/v2.html');
const idx = read('index.html');
const vjson = JSON.parse(read('version.json'));

if (!fs.existsSync(path.join(__dirname, '..', '.github/workflows/switch-version.yml'))) {
  fail('workflow file missing');
}
pass('workflow file exists');

if (extractSku(v1) < 1) fail('V1 SKU identity missing');
if (extractSku(v2) < 1) fail('V2 SKU identity missing');
if (extractSku(v1) !== extractSku(v2)) fail('V1 and V2 SKU occurrence mismatch');
pass(`SKU identity matches: SKU-ASTER-001 in both versions`);

const p1 = extractPrice(v1).length;
const p2 = extractPrice(v2).length;
if (p1 === 0 || p2 === 0) fail('Expected price £51.77 in both versions');
if (p1 !== p2) fail('Price occurrence count mismatch between versions');
pass('Price is present and identical in both versions');

if (!v1.includes('data-sku="SKU-ASTER-001"') && !v1.includes('data-sku>SKU-ASTER-001')) {
  fail('V1 missing explicit identity marker');
}
pass('V1 identity marker present');

if (!v2.includes('data-sku="SKU-ASTER-001"') && !v2.includes('data-sku>SKU-ASTER-001')) {
  fail('V2 missing explicit identity marker');
}
pass('V2 identity marker present');

contains(v1, 'class="product-price"', 'selector baseline');
if (v2.includes('product-price')) fail('Selector regression not present in V2 (expected break)');
pass('V2 selector intentionally changed (product-price absent)');

if (vjson.version !== 'v1') fail(`version.json version expected v1 initially, found ${vjson.version}`);
pass('version.json defaults to v1');

if (vjson.version === 'v1' && !idx.includes('versions/v1.html') && !idx.includes('SKU-ASTER-001')) {
  fail('index.html does not reflect V1 contents');
}
pass('index.json smoke sanity check passed');

console.log('All fixture smoke checks passed.');
