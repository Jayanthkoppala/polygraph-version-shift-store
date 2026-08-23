# Northbound Market Fixture Store

This static public product page is the real target of the Polygraph proof. The product values never change; each successful mission evolves only the three extraction anchors that a scraper depends on.

The live page advances as an append-only chain:

```text
current generation → next seeded generation → next seeded generation
```

The currently deployed generation is the next mission's healthy baseline. There is no reset loop and no runtime mock.

## Stable product contract

- Product code: `Product/Code-123`
- Product: `Aster QuietWave Wireless Noise-Cancelling Headphones, 40-hour Battery, Midnight Blue`
- Price: `£51.77`
- Availability: `In stock`

The generator changes only the DOM anchors for product code, title and price. The availability anchor stays `.stock-status` as the control field.

## Generation evidence

`version.json` records the current state:

```json
{
  "generation": 42,
  "parent_generation": 41,
  "seed": "pg_42_a81f",
  "mission_id": "...",
  "anchors": {
    "product_code": "[data-pg-code-…]",
    "title": "[data-pg-title-…]",
    "price": "[data-pg-price-…]",
    "availability": ".stock-status"
  }
}
```

The seed makes a changed page reproducible; GitHub commits make every production state inspectable. Generated product code, title, and price anchors contain real DOM text so provider healing previews can be validated before approval, while their normal/custom wrappers and selectors still change between generations.

## Evolving the live page

Dispatch **evolve-store** from `main` with:

- `generation`: the next integer above `version.json.generation`
- `parent_generation`: the current `version.json.generation`
- `seed`: a unique deterministic token
- `mission_id`: the Polygraph mission ID

The workflow generates `index.html`, records the manifest, runs local smoke checks, commits to `main`, and waits for the Vercel production alias to prove the exact generation marker and generated anchors.

`versions/v2.html` is the canonical source template. `versions/v1.html` and `versions/v3.html` are retained as historical fixtures; the live workflow no longer switches between them.

## Local checks

```bash
node scripts/smoke-generation-contract.js
node scripts/smoke-source-contract.js
```

The second check validates the canonical source and workflow. A generated-production smoke check is run by GitHub Actions after it writes the new `index.html` and `version.json`.
