/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Runs the compiled tests in out/test with the vscode mock preloaded.
 *
 * Test files are listed explicitly because `node --test` only accepts glob
 * patterns from Node 21 onwards, and CI runs Node 20 (the VS Code runtime).
 */

const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const sourceDir = join(__dirname, '..', 'test');
const testDir = join(__dirname, '..', 'out', 'test');

// tsc never deletes old output, so skip compiled tests whose source is gone
// (e.g. left over from another branch)
const testFiles = readdirSync(testDir)
  .filter((file) => file.endsWith('.test.js'))
  .filter((file) => existsSync(join(sourceDir, file.replace(/\.js$/, '.ts'))))
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
