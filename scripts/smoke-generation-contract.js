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
assert.ok(first.anchors.product_code.startsWith('[data-pg-code-'));
assert.ok(first.anchors.title.startsWith('.pg-title-'));
assert.ok(first.anchors.price.startsWith('.pg-price-'));

for (const value of ['Product/Code-123', 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue', '£51.77', 'In stock']) {
  assert.ok(html.includes(value), `generated HTML must preserve ${value}`);
}
for (const oldAnchor of ['data-catalog-key=', 'class="catalog-heading"', 'class="commerce-amount"']) {
  assert.ok(!html.includes(oldAnchor), `generated HTML must not keep old extraction anchor ${oldAnchor}`);
}
assert.ok(html.includes('class="stock-status"'), 'availability control must stay stable');
assert.ok(html.includes('name="polygraph-generation" content="42"'), 'page must expose its generation marker');
assert.equal(first.schema_version, 2);
assert.equal(first.contract_version, 'polygraph-owned-product/v1');
assert.equal(first.template_sha256, crypto.createHash('sha256').update(fs.readFileSync(canonical)).digest('hex'));
assert.equal(first.html_sha256, crypto.createHash('sha256').update(fs.readFileSync(one)).digest('hex'));
assert.deepEqual(first.invariants.price, { value: 51.77, currency: 'GBP', symbol: '£' });

console.log('✓ seeded generation contract is deterministic and preserves the product contract');
