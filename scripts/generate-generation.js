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
const manifestOnly = process.argv.includes('--manifest-only');

if (!Number.isSafeInteger(generation) || generation <= 0) throw new Error('--generation must be a positive safe integer');
if (!Number.isSafeInteger(parentGeneration) || parentGeneration < 0 || parentGeneration >= generation) {
  throw new Error('--parent-generation must be a non-negative integer smaller than --generation');
}
assertToken('seed', seed);
assertToken('mission id', missionId);

const sourceHtml = fs.readFileSync(source, 'utf8');
const sourceSha256 = crypto.createHash('sha256').update(sourceHtml).digest('hex');
const anchors = {
  product_code: `[data-pg-code-${digest(seed, 'product_code')}]`,
  title: `.pg-title-${digest(seed, 'title')}`,
  price: `.pg-price-${digest(seed, 'price')}`,
  availability: '.stock-status',
};
let html = sourceHtml
  .replace('class="catalog-heading"', `class="${anchors.title.slice(1)}"`)
  .replace('class="commerce-amount"', `class="${anchors.price.slice(1)}"`)
  .replace('data-catalog-key=', `${anchors.product_code.slice(1, -1)}=`);

if (html === sourceHtml) throw new Error('canonical source did not contain the expected extraction anchors');
if (!html.includes('class="stock-status"')) throw new Error('canonical source did not preserve the stable availability control');

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
  schema_version: 2,
  contract_version: 'polygraph-owned-product/v1',
  generation,
  parent_generation: parentGeneration,
  seed,
  mission_id: missionId,
  generator: { name: 'evolve-store', version: 1 },
  canonical_source: path.relative(process.cwd(), source).replaceAll('\\', '/'),
  template_sha256: sourceSha256,
  html_sha256: crypto.createHash('sha256').update(html).digest('hex'),
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
