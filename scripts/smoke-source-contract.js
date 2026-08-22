const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const v1 = fs.readFileSync(path.join(root, 'versions/v1.html'), 'utf8');
const v2 = fs.readFileSync(path.join(root, 'versions/v2.html'), 'utf8');

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

const title = 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue';
const productCode = 'Product/Code-123';
const price = '£51.77';
const availability = '<h2 class="stock-status">In stock</h2>';

for (const [version, html] of [['V1', v1], ['V2', v2]]) {
  if (count(html, title) !== 1) fail(`${version} must expose the product title exactly once`);
  if (count(html, productCode) !== 3) fail(`${version} must preserve fixture metadata, one product-code anchor, and one matching visible value`);
  if (count(html, price) !== 1) fail(`${version} must expose the price exactly once`);
  if (count(html, availability) !== 1) fail(`${version} must preserve the exact availability control markup`);
}
pass('both versions preserve identical product values and availability markup');

if (!v1.includes(`<section class="identity"><div class="product-title" role="heading" aria-level="1">${title}</div>`)) fail('V1 must expose the title through the current product-title anchor');
if (!v1.includes(`data-product-ref="${productCode}"`) || v1.includes('data-catalog-key=')) fail('V1 must expose only the current product-code anchor');
if (count(v1, 'class="money-widget__value"') !== 1 || v1.includes('class="commerce-amount"')) fail('V1 must expose only the current price anchor');

if (!v2.includes(`<section class="identity"><div class="catalog-heading" role="heading" aria-level="1">${title}</div>`)) fail('V2 must expose the title through the replacement catalog-heading anchor');
if (!v2.includes(`data-catalog-key="${productCode}"`) || v2.includes('data-product-ref=')) fail('V2 must expose only the replacement product-code anchor');
if (count(v2, 'class="commerce-amount"') !== 1 || v2.includes('class="money-widget__value"')) fail('V2 must expose only the replacement price anchor');
pass('exactly product code, title, and price move between V1 and V2');
