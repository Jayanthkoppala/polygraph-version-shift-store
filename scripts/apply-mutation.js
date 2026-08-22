const fs = require('node:fs');

const [,, sourcePath, outputPath, mutation = 'none'] = process.argv;
if (!sourcePath || !outputPath) throw new Error('usage: node scripts/apply-mutation.js <source> <output> <mutation>');

const source = fs.readFileSync(sourcePath, 'utf8');
const mutations = {
  none: (html) => html,
  'dom-drift': (html) => html.replace('Premium over-ear listening', 'Studio-grade over-ear listening').replace('Northbound Market · Fixture Product', 'Northbound Market · Fixture Product · layout-refresh'),
  'selector-break': (html) => html.replaceAll('class="product-price"', 'class="price-value"').replaceAll('class="money-widget__value"', 'class="amount-value"'),
  decoy: (html) => html.replace('</main>', '<section class="related-products" aria-label="Related products"><article data-product-code="Product/Code-456"><h2>Cedar Travel Speaker</h2><p>£89.00</p></article><article data-product-code="Product/Code-789"><h2>Orbit Charging Stand</h2><p>£24.50</p></article></section></main>'),
  'metadata-only': (html) => html.replace('Northbound Market product detail page fixture', 'Northbound Market product detail page experiment fixture'),
};
if (!Object.hasOwn(mutations, mutation)) throw new Error(`unknown mutation: ${mutation}`);
fs.writeFileSync(outputPath, mutations[mutation](source));
