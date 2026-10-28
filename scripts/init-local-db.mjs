import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const result = spawnSync(process.execPath, [
  wrangler, 'd1', 'migrations', 'apply', 'DB', '--local',
  '--config', 'wrangler.local.json', '--persist-to', '.dayflow-data',
], { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
