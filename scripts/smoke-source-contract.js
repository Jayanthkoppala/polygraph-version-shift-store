const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const v1 = fs.readFileSync(path.join(root, 'versions/v1.html'), 'utf8');
const v2 = fs.readFileSync(path.join(root, 'versions/v2.html'), 'utf8');
const v3 = fs.readFileSync(path.join(root, 'versions/v3.html'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/switch-version.yml'), 'utf8');

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function count(value, needle) {
  return value.split(needle).length - 1;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function capture(html, pattern) {
  return html.match(pattern)?.[1] ?? null;
}

function extractWithV2Selectors(html) {
  return {
    product_code: capture(html, /data-catalog-key="([^"]+)"/),
    title: capture(html, /class="catalog-heading"[^>]*>([^<]+)</),
    price: capture(html, /class="commerce-amount"[^>]*>([^<]+)</),
    availability: capture(html, /class="stock-status"[^>]*>([^<]+)</),
  };
}

function normalizeV2V3(html, version) {
  const number = version.slice(1);
  const selectors = version === 'v2'
    ? ['catalog-heading', 'data-catalog-key', 'commerce-amount']
    : ['listing-headline', 'data-listing-id', 'listing-price__amount'];
  return html
    .replaceAll(`versions/${version}.html`, 'versions/vX.html')
    .replaceAll(`content="${version}"`, 'content="vX"')
    .replaceAll(`(v${number})`, '(vX)')
    .replaceAll(`fixture version ${number}.`, 'fixture version X.')
    .replaceAll(selectors[0], 'EXTRACTION_TITLE')
    .replaceAll(selectors[1], 'EXTRACTION_PRODUCT_CODE')
    .replaceAll(selectors[2], 'EXTRACTION_PRICE');
}

const title = 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue';
const productCode = 'Product/Code-123';
const price = '£51.77';
const availability = '<h2 class="stock-status">In stock</h2>';

const immutableHashes = {
  V1: 'dd79c40749fc518e8a84960cb95f4b5b6b6a35e067eab07e4bcf70b7375b7935',
  V2: 'a173889dc9a3ccbf36793002a8cf3bf1450043a412b2d1975b20d6b83623f1ba',
  V3: '8104606c1700a7c640eff2e31d535943b7c707a5187683f579f5bfd0e5870909',
};
if (sha256(v1) !== immutableHashes.V1) fail('V1 immutable source hash changed');
if (sha256(v2) !== immutableHashes.V2) fail('V2 immutable source hash changed');
if (sha256(v3) !== immutableHashes.V3) fail('V3 immutable source hash changed');
pass('V1, V2, and V3 immutable source hashes are unchanged');

for (const [version, html] of [['V1', v1], ['V2', v2], ['V3', v3]]) {
  if (count(html, title) !== 1) fail(`${version} must expose the product title exactly once`);
  if (count(html, productCode) !== 3) fail(`${version} must preserve fixture metadata, one product-code anchor, and one matching visible value`);
  if (count(html, price) !== 1) fail(`${version} must expose the price exactly once`);
  if (count(html, availability) !== 1) fail(`${version} must preserve the exact availability control markup`);
}
pass('all versions preserve identical product values and availability markup');

if (!v1.includes(`<section class="identity"><div class="product-title" role="heading" aria-level="1">${title}</div>`)) fail('V1 must expose the title through the current product-title anchor');
if (!v1.includes(`data-product-ref="${productCode}"`) || v1.includes('data-catalog-key=')) fail('V1 must expose only the current product-code anchor');
if (count(v1, 'class="money-widget__value"') !== 1 || v1.includes('class="commerce-amount"')) fail('V1 must expose only the current price anchor');

if (!v2.includes(`<section class="identity"><div class="catalog-heading" role="heading" aria-level="1">${title}</div>`)) fail('V2 must expose the title through the replacement catalog-heading anchor');
if (!v2.includes(`data-catalog-key="${productCode}"`) || v2.includes('data-product-ref=')) fail('V2 must expose only the replacement product-code anchor');
if (count(v2, 'class="commerce-amount"') !== 1 || v2.includes('class="money-widget__value"')) fail('V2 must expose only the replacement price anchor');
pass('exactly product code, title, and price move between V1 and V2');

if (!v3.includes(`<section class="identity"><div class="listing-headline" role="heading" aria-level="1">${title}</div>`)) fail('V3 must expose the title through the append-only listing-headline anchor');
if (!v3.includes(`data-listing-id="${productCode}"`) || v3.includes('data-catalog-key=') || v3.includes('data-product-ref=')) fail('V3 must expose only the append-only product-code anchor');
if (count(v3, 'class="listing-price__amount"') !== 1 || v3.includes('class="commerce-amount"') || v3.includes('class="money-widget__value"')) fail('V3 must expose only the append-only price anchor');
pass('exactly product code, title, and price move between V2 and V3');

if (normalizeV2V3(v2, 'v2') !== normalizeV2V3(v3, 'v3')) fail('V3 must differ from V2 only in version metadata and the three extraction anchors');
pass('V2 and V3 preserve byte-identical content outside version metadata and the three extraction anchors');

const v2Result = extractWithV2Selectors(v2);
const v3ResultUsingUnchangedV2Selectors = extractWithV2Selectors(v3);
const expectedV2Result = { product_code: productCode, title, price, availability: 'In stock' };
if (JSON.stringify(v2Result) !== JSON.stringify(expectedV2Result)) fail('unchanged V2 selectors must return all four contract fields from V2');
const changedFields = Object.keys(expectedV2Result).filter((field) => v3ResultUsingUnchangedV2Selectors[field] !== expectedV2Result[field]);
if (changedFields.join('|') !== 'product_code|title|price') fail(`unchanged V2 selectors must lose exactly product_code, title, and price on V3; observed ${changedFields.join(', ') || 'no changes'}`);
if (v3ResultUsingUnchangedV2Selectors.availability !== 'In stock') fail('unchanged availability selector must remain healthy on V3');
pass('unchanged V2 selectors lose exactly three fields on V3 while availability remains healthy');

if (!workflow.includes('          - v3')) fail('workflow must expose V3 as a dispatch choice');
if (!workflow.includes('$TARGET_VERSION" != "v3"')) fail('workflow must accept V3 during marker validation');
for (const anchor of ['data-listing-id="Product/Code-123"', 'class="listing-headline"', 'class="listing-price__amount"']) {
  if (!workflow.includes(anchor)) fail(`workflow live proof must require the V3 ${anchor} anchor`);
}
pass('workflow accepts, publishes, and proves the append-only V3 selector contract');
