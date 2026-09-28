/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Runs the compiled tests in out/test with the vscode mock preloaded.
 *
 * Test files are listed explicitly because `node --test` only accepts glob
 * patterns from Node 21 onwards, and CI runs Node 20 (the VS Code runtime).
 */

const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const testDir = join(__dirname, '..', 'out', 'test');
const testFiles = readdirSync(testDir)
  .filter((file) => file.endsWith('.test.js'))
  .sort()
  .map((file) => join(testDir, file));

if (testFiles.length === 0) {
  console.error(`No test files found in ${testDir}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--require', join(testDir, 'setup.js'), '--test', ...testFiles],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
