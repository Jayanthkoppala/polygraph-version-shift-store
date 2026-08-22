# Northbound Market Fixture Store

This repository hosts a static, public fixture product site used by the Polygraph demo.
It simulates a real storefront page that can switch between three structurally different product
versions while keeping the same product identity:

- Product code: `Product/Code-123`
- Price: `£51.77`
- Product: `Aster Noise-Cancelling Headphones`

## Repository contents

- `index.html` — Live fixture page served to scrapers (defaults to V1).
- `version.json` — Current active fixture metadata (`version`, `generation`, `mission_id`, `source_sha256`, etc.).
- `versions/v1.html`, `versions/v2.html`, and `versions/v3.html` — Immutable source snapshots.
- `.github/workflows/switch-version.yml` — Manual workflow to publish a target version and deterministic mutation scenario.
- `scripts/apply-mutation.js` — Reproducible DOM/selector/decoy mutation generator.
- `vercel.json` — Runtime config, including no-store headers for `version.json`.
- `scripts/smoke-fixture-check.js` — Local verification script.

## Deployment setup

Live production fixture: <https://polygraph-version-shift-store.vercel.app>

1. Create this repository on GitHub with `main` as the production branch.
2. Import the repository into Vercel and deploy from `main`.
3. Add the GitHub repository variable `POLYGRAPH_FIXTURE_URL` with the stable
   Vercel production URL, without a trailing slash.
4. Keep the workflow's generated-file permission at `contents: write`; it only
   commits `index.html` and `version.json`.

The Vercel project is `jayanth137s-projects/polygraph-version-shift-store`.

## How to switch versions manually

1. Open the workflow: **Actions → switch-version → Run workflow**
2. Select:
   - `version`: `v1`, `v2`, or `v3` (semantic snapshot)
   - `mutation`: `none`, `dom-drift`, `selector-break`, `decoy`, or `metadata-only`
   - `generation`: a positive integer greater than the current `version.json`
   - `mission_id`: the Polygraph mission ID
   - `force`: normally `false`
3. Run workflow
4. Workflow behavior:
   - Copies selected source file into `index.html`
   - Updates `version.json` with:
     - `version`
     - `generation`
     - `mission_id`
     - `source_sha256`
     - `published_at`
     - `mutation`
     - `commits`
   - Runs the target-aware local smoke gate
   - Pushes the generated state to `main` using `GITHUB_TOKEN`
   - Polls the Vercel production alias until both `version.json` and the live
     product HTML prove the exact requested state

## Reset / rollback

- To return to V1, dispatch the workflow with `version=v1`, a new higher
  generation, and the current mission ID.
- To return to V2, use the same process with `version=v2`.
- To advance to the append-only V3 selector contract, use `version=v3`.
- Repeating the exact same version, generation, mission, and mutation is a no-op unless
  `force=true`; a higher generation always advances the live marker.

## Note

This repository is intentionally minimal and static for hackathon demo reliability:
- No frameworks
- No back-end runtime
- Git + GitHub workflow-driven version switching only
