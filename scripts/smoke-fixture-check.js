const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(file, 'utf8');
const option = (name) => { const at = process.argv.indexOf(name); return at === -1 ? undefined : process.argv[at + 1]; };
const fail = (message) => { console.error(`✗ ${message}`); process.exit(1); };
const pass = (message) => console.log(`✓ ${message}`);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const expectedGeneration = Number(option('--generation'));
const expectedParent = Number(option('--parent-generation'));
const expectedSeed = option('--seed');
const expectedMission = option('--mission-id');
const statePath = option('--state') || path.join(root, 'version.json');
const indexPath = option('--index') || path.join(root, 'index.html');
if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration <= 0) fail('pass --generation <positive integer>');
if (!Number.isSafeInteger(expectedParent) || expectedParent < 0) fail('pass --parent-generation <non-negative integer>');
if (!expectedSeed || !expectedMission) fail('pass --seed and --mission-id');

const manifest = JSON.parse(read(statePath));
const index = read(indexPath);
const canonical = read(path.join(root, 'versions/v2.html'));
const expectedKeys = ['anchors', 'cache', 'canonical_source', 'commits', 'contract_version', 'generation', 'generator', 'html_sha256', 'invariants', 'mission_id', 'parent_generation', 'published_at', 'schema_version', 'seed', 'template_sha256', 'variant', 'version'];
if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(expectedKeys)) fail(`manifest schema mismatch: ${Object.keys(manifest).join(', ')}`);
if (manifest.version !== 'evolving') fail('manifest version must be evolving');
if (manifest.schema_version !== 3 || manifest.contract_version !== 'polygraph-owned-product/v1') fail('manifest schema and product contract versions are invalid');
if (manifest.generation !== expectedGeneration || manifest.parent_generation !== expectedParent || manifest.seed !== expectedSeed || manifest.mission_id !== expectedMission) fail('manifest marker does not match requested evolution');
if (manifest.canonical_source !== 'versions/v2.html') fail('canonical source must remain versions/v2.html');
if (manifest.template_sha256 !== sha256(canonical)) fail('canonical template SHA does not match versions/v2.html');
if (manifest.html_sha256 !== sha256(index)) fail('generated HTML SHA does not match index.html');
if (manifest.generator?.name !== 'evolve-store' || manifest.generator?.version !== 3) fail('generator identity is invalid');
if (manifest.invariants?.product_code !== 'Product/Code-123' || manifest.invariants?.price?.value !== 51.77 || manifest.invariants?.price?.currency !== 'GBP' || manifest.invariants?.price?.symbol !== '£' || manifest.invariants?.availability !== 'In stock') fail('product invariants are invalid');
if (manifest.cache !== `generation-${expectedGeneration}-${expectedSeed}`) fail('cache marker does not match generation and seed');
if (typeof manifest.published_at !== 'string' || Number.isNaN(Date.parse(manifest.published_at))) fail('published_at must be ISO timestamp');
if (!Array.isArray(manifest.commits)) fail('commits must be an array');
pass('manifest records deterministic generation evidence');

if (manifest.variant?.profile !== 'opaque-custom-elements' || !/^[a-f0-9]{16}$/.test(manifest.variant?.selector_digest || '')) {
  fail('manifest must record a reproducible structural variant');
}
pass('manifest records the structural variant used for this generation');

const requiredFields = ['availability', 'price', 'product_code', 'title'];
if (!manifest.anchors || JSON.stringify(Object.keys(manifest.anchors).sort()) !== JSON.stringify(requiredFields)) fail('anchors must contain exactly the four contract fields');
const { product_code: productCode, title, price, availability } = manifest.anchors;
if (!/^pg-code-[a-f0-9]{12}$/.test(productCode)) fail('product_code anchor is invalid');
if (!/^pg-title-[a-f0-9]{12}$/.test(title)) fail('title anchor is invalid');
if (!/^pg-price-[a-f0-9]{12}$/.test(price)) fail('price anchor is invalid');
if (availability !== '.stock-status') fail('availability control must remain .stock-status');
pass('manifest identifies three changed anchors and one stable control');

for (const value of ['Product/Code-123', 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue', '£51.77', 'In stock']) {
  if (!index.includes(value)) fail(`generated product page lost ${value}`);
}
const selectorContains = (selector, value) => selector.startsWith('[')
  ? index.includes(`${selector.slice(1, -1)}="${value}"`)
  : selector.startsWith('.')
    ? index.includes(`class="${selector.slice(1)}"`) && index.includes(value)
    : index.includes(`<${selector}>${value}</${selector}>`);
if (!selectorContains(productCode, 'Product/Code-123')) fail('generated product-code anchor is absent');
if (!selectorContains(title, 'Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue')) fail('generated title anchor is absent');
if (!selectorContains(price, '£51.77')) fail('generated price anchor is absent');
if (!index.includes('class="stock-status"')) fail('stable availability control is absent');
if (!index.includes(`name="polygraph-generation" content="${expectedGeneration}"`)) fail('generation marker absent from page');
if (index.includes('data-catalog-key=') || index.includes('class="catalog-heading"') || index.includes('class="commerce-amount"') || index.includes('role="heading"') || index.includes('aria-level="1"') || index.includes('aria-label="product amount"') || index.includes('<dl class="specs">') || index.includes('<dt>') || index.includes('<dd')) fail('generated page retained semantic extraction fallbacks');
if (!index.includes('data-polygraph-presentation=')) fail('generated page lost opaque-element presentation contract');
pass('generated page preserves product meaning while changing exactly three extraction anchors');

if (!fs.existsSync(path.join(root, '.github/workflows/switch-version.yml'))) fail('evolution workflow missing');
pass('evolution workflow exists');
