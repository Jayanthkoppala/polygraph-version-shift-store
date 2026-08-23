#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function required(flag) {
  const value = valueFor(flag);
  if (!value) throw new Error(`${flag} is required`);
  return value;
}

function digest(seed, field) {
  return crypto.createHash('sha256').update(`${seed}:${field}`).digest('hex').slice(0, 12);
}

function assertToken(name, value) {
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(value)) {
    throw new Error(`${name} may contain only letters, numbers, ., _, :, and -`);
  }
}

const source = required('--source');
const output = required('--output');
const generation = Number(required('--generation'));
const parentGeneration = Number(required('--parent-generation'));
const seed = required('--seed');
const missionId = required('--mission-id');
const parentStatePath = valueFor('--parent-state');
const manifestOnly = process.argv.includes('--manifest-only');

if (!Number.isSafeInteger(generation) || generation <= 0) throw new Error('--generation must be a positive safe integer');
if (!Number.isSafeInteger(parentGeneration) || parentGeneration < 0 || parentGeneration >= generation) {
  throw new Error('--parent-generation must be a non-negative integer smaller than --generation');
}
assertToken('seed', seed);
assertToken('mission id', missionId);

const sourceHtml = fs.readFileSync(source, 'utf8');
const sourceSha256 = crypto.createHash('sha256').update(sourceHtml).digest('hex');

let parentManifest;
if (parentStatePath) {
  parentManifest = JSON.parse(fs.readFileSync(parentStatePath, 'utf8'));
  if (parentManifest.generation !== parentGeneration) {
    throw new Error('--parent-state generation must match --parent-generation');
  }
}

const tokens = {
  product_code: digest(seed, 'product_code'),
  title: digest(seed, 'title'),
  price: digest(seed, 'price'),
  detail: digest(seed, 'detail'),
  offer: digest(seed, 'offer'),
  specs: digest(seed, 'specs'),
  label: digest(seed, 'label'),
  value: digest(seed, 'value'),
};
const anchors = {
  product_code: `pg-code-${tokens.product_code}`,
  title: `pg-title-${tokens.title}`,
  price: `pg-price-${tokens.price}`,
  availability: '.stock-status',
};
const tags = {
  detail: `pg-detail-${tokens.detail}`,
  offer: `pg-offer-${tokens.offer}`,
  specs: `pg-spec-grid-${tokens.specs}`,
  label: `pg-label-${tokens.label}`,
  value: `pg-value-${tokens.value}`,
  ...anchors,
};
const productCodeOpen = `<${tags.product_code}>`;
const productCodeClose = `</${tags.product_code}>`;
const labelOpen = `<${tags.label}>`;
const labelClose = `</${tags.label}>`;
const valueOpen = `<${tags.value}>`;
const valueClose = `</${tags.value}>`;

// The generated page deliberately has no semantic extraction fallback for the
// three monitored fields. Each seed changes their tag names and surrounding
// hierarchy while the injected presentation rules keep the visual page fixed.
let html = sourceHtml
  .replace('<section class="identity">', `<${tags.detail}>`)
  .replace('<div class="catalog-heading" role="heading" aria-level="1">', `<${tags.title}>`)
  .replace('</div><div class="rating">', `</${tags.title}><div class="rating">`)
  .replace('<div class="pricebox">', `<${tags.offer}>`)
  .replace('<p class="commerce-amount" aria-label="product amount">', `<${tags.price}>`)
  .replace('</p><p class="rrp">', `</${tags.price}><p class="rrp">`)
  .replace('</div><dl class="specs">', `</${tags.offer}><${tags.specs}>`)
  .replaceAll('<dt>', labelOpen)
  .replaceAll('</dt>', labelClose)
  .replace('<dd data-catalog-key="Product/Code-123">Product/Code-123</dd>', `${productCodeOpen}Product/Code-123${productCodeClose}`)
  .replaceAll('<dd>', valueOpen)
  .replaceAll('</dd>', valueClose)
  .replace('</dl></section>', `</${tags.specs}></${tags.detail}>`);

const presentation = `<style data-polygraph-presentation="${tokens.detail}">` +
  `${tags.detail}{display:block}` +
  `${tags.title}{display:block;font-size:25px;line-height:1.24;font-weight:500;text-wrap:balance;margin:0 0 9px}` +
  `${tags.offer}{display:block;border-top:1px solid var(--line);padding-top:13px}` +
  `${tags.price}{display:block;font-size:31px;letter-spacing:-1.5px;color:var(--red);margin:2px 0 7px}` +
  `${tags.specs}{display:grid;grid-template-columns:110px 1fr;gap:8px 12px;line-height:1.35}` +
  `${tags.label}{font-weight:bold}` +
  `${tags.value},${tags.product_code}{margin:0}` +
  `</style>`;
html = html.replace('</head>', `${presentation}</head>`);

if (html === sourceHtml) throw new Error('canonical source did not contain the expected extraction anchors');
if (!html.includes('class="stock-status"')) throw new Error('canonical source did not preserve the stable availability control');
if (parentManifest?.anchors && JSON.stringify(parentManifest.anchors) === JSON.stringify(anchors)) {
  throw new Error('generated anchors must differ from the recorded parent state');
}

const marker = [
  `<meta name="polygraph-generation" content="${generation}">`,
  `<meta name="polygraph-parent-generation" content="${parentGeneration}">`,
  `<meta name="polygraph-seed" content="${seed}">`,
  `<meta name="polygraph-mission-id" content="${missionId}">`,
].join('');
html = html.replace('</head>', `${marker}</head>`);
if (!html.includes(`name="polygraph-generation" content="${generation}"`)) throw new Error('could not add fixture generation marker');

const productTitle = 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue';
const manifest = {
  schema_version: 3,
  contract_version: 'polygraph-owned-product/v1',
  generation,
  parent_generation: parentGeneration,
  seed,
  mission_id: missionId,
  generator: { name: 'evolve-store', version: 3 },
  canonical_source: path.relative(process.cwd(), source).replaceAll('\\', '/'),
  template_sha256: sourceSha256,
  html_sha256: crypto.createHash('sha256').update(html).digest('hex'),
  variant: {
    profile: 'opaque-custom-elements',
    selector_digest: crypto.createHash('sha256').update(JSON.stringify(anchors)).digest('hex').slice(0, 16),
  },
  anchors,
  invariants: {
    product_code: 'Product/Code-123',
    title_sha256: crypto.createHash('sha256').update(productTitle).digest('hex'),
    price: { value: 51.77, currency: 'GBP', symbol: '£' },
    availability: 'In stock',
  },
};

if (!manifestOnly) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html);
}
process.stdout.write(`${JSON.stringify(manifest)}\n`);
