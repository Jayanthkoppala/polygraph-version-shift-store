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
assert.ok(first.anchors.product_code.startsWith('[data-'));
assert.ok(first.anchors.title.startsWith('.') || first.anchors.title.startsWith('[data-'));
assert.ok(first.anchors.price.startsWith('.') || first.anchors.price.startsWith('[data-'));

for (const value of ['Product/Code-123', 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue', '£51.77', 'In stock']) {
  assert.ok(html.includes(value), `generated HTML must preserve ${value}`);
}
for (const oldAnchor of ['data-catalog-key=', 'class="catalog-heading"', 'class="commerce-amount"']) {
  assert.ok(!html.includes(oldAnchor), `generated HTML must not keep old extraction anchor ${oldAnchor}`);
}
assert.ok(html.includes('class="stock-status"'), 'availability control must stay stable');
assert.ok(html.includes('name="polygraph-generation" content="42"'), 'page must expose its generation marker');
assert.equal(first.schema_version, 3);
assert.equal(first.generator.version, 2);
assert.ok(['catalog-attributes', 'product-properties', 'offer-schema'].includes(first.variant.profile));
assert.equal(first.contract_version, 'polygraph-owned-product/v1');
assert.equal(first.template_sha256, crypto.createHash('sha256').update(fs.readFileSync(canonical)).digest('hex'));
assert.equal(first.html_sha256, crypto.createHash('sha256').update(fs.readFileSync(one)).digest('hex'));
assert.deepEqual(first.invariants.price, { value: 51.77, currency: 'GBP', symbol: '£' });

// Presentation must not be coupled to the selector classes that a scraper
// needs to relearn. These structural rules style every generated tag shape
// (div, h1, section, p, output) without retaining canonical scraper classes.
for (const hook of [
  '.identity>:first-child{display:block;font-size:25px;line-height:1.24;font-weight:500;text-wrap:balance;margin:0 0 9px}',
  '.pricebox>:nth-child(2){display:block;font-size:31px;letter-spacing:-1.5px;color:var(--red);margin:2px 0 7px}',
]) {
  assert.ok(html.includes(hook), `generated HTML must retain the stable presentation hook ${hook}`);
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
assert.notEqual(child.variant.profile, first.variant.profile, 'successive generation must choose a different structural profile');
assert.notDeepEqual(child.anchors, first.anchors, 'successive generation must change extraction anchors');

const expectedProfiles = new Set(['catalog-attributes', 'product-properties', 'offer-schema']);
const observedProfiles = new Set([first.variant.profile]);
for (let candidate = 0; candidate < 96 && observedProfiles.size < expectedProfiles.size; candidate++) {
  const output = path.join(temporary, `profile-${candidate}.html`);
  const manifest = generate(output, `pg_presentation_${candidate}`);
  const profileHtml = fs.readFileSync(output, 'utf8');
  observedProfiles.add(manifest.variant.profile);
  for (const hook of [
    '.identity>:first-child{display:block;font-size:25px;line-height:1.24;font-weight:500;text-wrap:balance;margin:0 0 9px}',
    '.pricebox>:nth-child(2){display:block;font-size:31px;letter-spacing:-1.5px;color:var(--red);margin:2px 0 7px}',
  ]) assert.ok(profileHtml.includes(hook), `${manifest.variant.profile} must keep ${hook}`);
  assert.ok(!profileHtml.includes('class="catalog-heading"'), `${manifest.variant.profile} must still remove the canonical title extraction class`);
  assert.ok(!profileHtml.includes('class="commerce-amount"'), `${manifest.variant.profile} must still remove the canonical price extraction class`);
}
assert.deepEqual([...observedProfiles].sort(), [...expectedProfiles].sort(), 'the presentation contract must cover every deterministic structural profile');

console.log('✓ seeded generation contract is deterministic and preserves the product contract');
