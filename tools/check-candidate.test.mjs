import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const checker = join(dirname(fileURLToPath(import.meta.url)), 'check-candidate.mjs');

function run(root) {
  return spawnSync(process.execPath, [checker], {
    env: { ...process.env, SERVICEFRONT_CANDIDATE_ROOT: root },
    encoding: 'utf8',
  });
}

test('installed dependencies are excluded from the source scan', async () => {
  const root = await mkdtemp(join(tmpdir(), 'servicefront-scan-'));
  await mkdir(join(root, 'node_modules', 'fixture'), { recursive: true });
  const privatePath = ['/', 'Users', 'example', 'private'].join('/');
  await writeFile(join(root, 'node_modules', 'fixture', 'private.md'), `${privatePath}\n`);
  assert.equal(run(root).status, 0);
});

test('publishable source is still scanned', async () => {
  const root = await mkdtemp(join(tmpdir(), 'servicefront-scan-'));
  const privatePath = ['/', 'Users', 'example', 'private'].join('/');
  await writeFile(join(root, 'README.md'), `${privatePath}\n`);
  const result = run(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /absolute workstation path/);
});
