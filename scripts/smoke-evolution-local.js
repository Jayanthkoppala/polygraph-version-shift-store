const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'polygraph-evolution-'));
const index = path.join(temporary, 'index.html');
const generated = JSON.parse(execFileSync(process.execPath, [
  path.join(root, 'scripts/generate-generation.js'),
  '--source', path.join(root, 'versions/v2.html'),
  '--output', index,
  '--generation', '1787433476989',
  '--parent-generation', '1787433476988',
  '--seed', 'pg_local_contract_42',
  '--mission-id', 'local-contract-mission',
], { encoding: 'utf8' }));
const manifest = {
  version: 'evolving',
  ...generated,
  published_at: new Date().toISOString(),
  cache: `generation-${generated.generation}-${generated.seed}`,
  commits: [],
};
const state = path.join(temporary, 'version.json');
fs.writeFileSync(state, `${JSON.stringify(manifest, null, 2)}\n`);
execFileSync(process.execPath, [
  path.join(root, 'scripts/smoke-fixture-check.js'),
  '--generation', String(generated.generation),
  '--parent-generation', String(generated.parent_generation),
  '--seed', generated.seed,
  '--mission-id', generated.mission_id,
  '--state', state,
  '--index', index,
], { stdio: 'inherit' });
