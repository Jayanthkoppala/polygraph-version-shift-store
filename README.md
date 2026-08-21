# Northbound Market Fixture Store

This repository hosts a static, public fixture product site used by the Polygraph demo.
It simulates a real storefront page that can switch between two structurally different product
versions while keeping the same product identity:

- SKU: `SKU-ASTER-001`
- Price: `£51.77`
- Product: `Aster Noise-Cancelling Headphones`

## Repository contents

- `index.html` — Live fixture page served to scrapers (defaults to V1).
- `version.json` — Current active fixture metadata (`version`, `generation`, `source_sha`, etc.).
- `versions/v1.html` and `versions/v2.html` — Immutable source snapshots.
- `.github/workflows/switch-version.yml` — Manual workflow to publish a target version.
- `vercel.json` — Runtime config, including no-store headers for `version.json`.
- `scripts/smoke-fixture-check.js` — Local verification script.

## URLs (placeholders)

- Live fixture: `https://<your-vercel-domain>.vercel.app`
- V1 source: `versions/v1.html`
- V2 source: `versions/v2.html`
- Version switch workflow: `.github/workflows/switch-version.yml`
- Live compare view: swap `version.json` and verify price/SKU in UI.

## How to switch versions manually

1. Open the workflow: **Actions → switch-version → Run workflow**
2. Select:
   - `version`: `v1` or `v2`
   - `generation`: `auto` (default) or explicit integer
3. Run workflow
4. Workflow behavior:
   - Copies selected source file into `index.html`
   - Updates `version.json` with:
     - `version`
     - `generation`
     - `source_sha`
     - `published_at`
     - `commits`
   - Pushes the commit using `GITHUB_TOKEN`

## Reset / rollback

- To return to V1:
  - Run workflow with `version=v1` and `generation=auto`.
- To return to V2:
  - Run workflow with `version=v2` and `generation=auto`.
- For explicit rollback point, pass explicit `generation` and rerun the desired version.

## Note

This repository is intentionally minimal and static for hackathon demo reliability:
- No frameworks
- No back-end runtime
- Git + GitHub workflow-driven version switching only
