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

function integerFromDigest(seed, field) {
  return Number.parseInt(crypto.createHash('sha256').update(`${seed}:${field}`).digest('hex').slice(0, 8), 16);
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

const profiles = [
  {
    name: 'catalog-attributes',
    anchors: (tokens) => ({
      product_code: `[data-pg-code-${tokens.product_code}]`,
      title: `[data-pg-title-${tokens.title}]`,
      price: `[data-pg-price-${tokens.price}]`,
      availability: '.stock-status',
    }),
    rewrite: (html, anchors) => html
      .replace('<div class="catalog-heading" role="heading" aria-level="1">', `<h1 ${anchors.title.slice(1, -1)}>`)
      .replace('</div><div class="rating">', '</h1><div class="rating">')
      .replace('<p class="commerce-amount" aria-label="product amount">', `<div ${anchors.price.slice(1, -1)} aria-label="product amount">`)
      .replace('</p><p class="rrp">', '</div><p class="rrp">')
      .replace('data-catalog-key=', `${anchors.product_code.slice(1, -1)}=`),
  },
  {
    name: 'product-properties',
    anchors: (tokens) => ({
      product_code: `[data-product-reference-${tokens.product_code}]`,
      title: `.product-name-${tokens.title}`,
      price: `.offer-value-${tokens.price}`,
      availability: '.stock-status',
    }),
    rewrite: (html, anchors) => html
      .replace('class="catalog-heading"', `class="${anchors.title.slice(1)}" data-product-copy="headline"`)
      .replace('class="commerce-amount"', `class="${anchors.price.slice(1)}" data-offer-copy="amount"`)
      .replace('data-catalog-key=', `${anchors.product_code.slice(1, -1)}=`),
  },
  {
    name: 'offer-schema',
    anchors: (tokens) => ({
      product_code: `[data-item-number-${tokens.product_code}]`,
      title: `[data-display-name-${tokens.title}]`,
      price: `[data-current-price-${tokens.price}]`,
      availability: '.stock-status',
    }),
    rewrite: (html, anchors) => html
      .replace('<div class="catalog-heading" role="heading" aria-level="1">', `<section ${anchors.title.slice(1, -1)} role="heading" aria-level="1">`)
      .replace('</div><div class="rating">', '</section><div class="rating">')
      .replace('<p class="commerce-amount" aria-label="product amount">', `<output ${anchors.price.slice(1, -1)} aria-label="product amount">`)
      .replace('</p><p class="rrp">', '</output><p class="rrp">')
      .replace('data-catalog-key=', `${anchors.product_code.slice(1, -1)}=`),
  },
];

const parentProfile = parentManifest?.variant?.profile;
let profileIndex = integerFromDigest(seed, 'profile') % profiles.length;
if (parentProfile && profiles[profileIndex].name === parentProfile) {
  profileIndex = (profileIndex + 1 + (integerFromDigest(seed, 'profile-offset') % (profiles.length - 1))) % profiles.length;
}
const profile = profiles[profileIndex];
const tokens = {
  product_code: digest(seed, 'product_code'),
  title: digest(seed, 'title'),
  price: digest(seed, 'price'),
};
const anchors = profile.anchors(tokens);
let html = profile.rewrite(sourceHtml, anchors);

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
  generator: { name: 'evolve-store', version: 2 },
  canonical_source: path.relative(process.cwd(), source).replaceAll('\\', '/'),
  template_sha256: sourceSha256,
  html_sha256: crypto.createHash('sha256').update(html).digest('hex'),
  variant: {
    profile: profile.name,
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
