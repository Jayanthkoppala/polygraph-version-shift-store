const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const generator = path.join(root, 'scripts/generate-generation.js');
const canonical = path.join(root, 'versions/v2.html');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'polygraph-generation-'));
const one = path.join(temporary, 'one.html');
const two = path.join(temporary, 'two.html');

function generate(output, seed) {
  execFileSync(process.execPath, [generator,
    '--source', canonical,
    '--output', output,
    '--generation', '42',
    '--parent-generation', '41',
    '--seed', seed,
    '--mission-id', 'mission-contract-test',
  ], { stdio: 'pipe' });
  return JSON.parse(execFileSync(process.execPath, [generator,
    '--source', canonical,
    '--output', output,
    '--generation', '42',
    '--parent-generation', '41',
    '--seed', seed,
    '--mission-id', 'mission-contract-test',
    '--manifest-only',
  ], { encoding: 'utf8' }));
}

const first = generate(one, 'pg_42_a81f');
const same = generate(two, 'pg_42_a81f');
const html = fs.readFileSync(one, 'utf8');

assert.deepEqual(first, same, 'the same seed must produce the same manifest');
assert.equal(fs.readFileSync(one, 'utf8'), fs.readFileSync(two, 'utf8'), 'the same seed must produce identical HTML');
assert.equal(first.generation, 42);
assert.equal(first.parent_generation, 41);
assert.equal(first.seed, 'pg_42_a81f');
assert.equal(first.mission_id, 'mission-contract-test');
assert.deepEqual(Object.keys(first.anchors).sort(), ['availability', 'price', 'product_code', 'title']);
assert.equal(first.anchors.availability, '.stock-status');
assert.match(first.anchors.product_code, /^\[data-pg-code-[a-f0-9]{12}\]$/);
assert.match(first.anchors.title, /^\[data-pg-title-[a-f0-9]{12}\]$/);
assert.match(first.anchors.price, /^\[data-pg-price-[a-f0-9]{12}\]$/);

for (const value of ['Product/Code-123', 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue', '£51.77', 'In stock']) {
  assert.ok(html.includes(value), `generated HTML must preserve ${value}`);
}
for (const oldAnchor of ['data-catalog-key=', 'class="catalog-heading"', 'class="commerce-amount"', 'role="heading"', 'aria-level="1"', 'aria-label="product amount"', '<dl class="specs">', '<dt>', '<dd']) {
  assert.ok(!html.includes(oldAnchor), `generated HTML must not keep old extraction anchor ${oldAnchor}`);
}
assert.ok(html.includes('class="stock-status"'), 'availability control must stay stable');
assert.ok(html.includes('name="polygraph-generation" content="42"'), 'page must expose its generation marker');
assert.equal(first.schema_version, 3);
assert.equal(first.generator.version, 4);
assert.equal(first.variant.profile, 'opaque-attribute-elements');
assert.equal(first.contract_version, 'polygraph-owned-product/v1');
assert.equal(first.template_sha256, crypto.createHash('sha256').update(fs.readFileSync(canonical)).digest('hex'));
assert.equal(first.html_sha256, crypto.createHash('sha256').update(fs.readFileSync(one)).digest('hex'));
assert.deepEqual(first.invariants.price, { value: 51.77, currency: 'GBP', symbol: '£' });

for (const [selector, value] of Object.entries({
  [first.anchors.title]: 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue',
  [first.anchors.price]: '£51.77',
  [first.anchors.product_code]: 'Product/Code-123',
})) {
  assert.ok(html.includes(`${selector.slice(1, -1)}="${value}"`), `${selector} must preserve its value in a randomized attribute`);
}
const renderedText = html.replace(/<[^>]*>/g, '');
for (const value of ['Product/Code-123', 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue', '£51.77']) {
  assert.ok(!renderedText.includes(value), `${value} must not remain in a generated text node`);
}
assert.ok(html.includes('data-polygraph-presentation='), 'generated HTML must include a presentation contract for opaque elements');

for (const tag of new Set([...html.matchAll(/<\/?(pg-(?:detail|title|offer|price|spec-grid|label|value|code)-[a-f0-9]{12})(?:\s[^>]*)?>/g)].map((match) => match[1]))) {
  const opens = (html.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g')) || []).length;
  const closes = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  assert.equal(opens, closes, `${tag} must be balanced`);
}

const parentState = path.join(temporary, 'parent-version.json');
fs.writeFileSync(parentState, `${JSON.stringify({ generation: 42, anchors: first.anchors, variant: first.variant }, null, 2)}\n`);
const child = JSON.parse(execFileSync(process.execPath, [generator,
  '--source', canonical,
  '--output', path.join(temporary, 'child.html'),
  '--generation', '43',
  '--parent-generation', '42',
  '--seed', 'pg_child_43',
  '--mission-id', 'mission-contract-child',
  '--parent-state', parentState,
  '--manifest-only',
], { encoding: 'utf8' }));
assert.notDeepEqual(child.anchors, first.anchors, 'successive generation must change extraction anchors');

console.log('✓ seeded generation contract is deterministic and preserves the product contract');
