import * as assert from 'node:assert';
import test from 'node:test';
import { isFileExcluded } from '../src/constants';

test('isFileExcluded - returns false without patterns', () => {
  assert.strictEqual(isFileExcluded('/repo/src/a.ts', []), false);
});

test('isFileExcluded - matches ** across multiple directories', () => {
  assert.ok(isFileExcluded('/repo/src/a/b/c.ts', ['src/**/*.ts']));
  assert.ok(isFileExcluded('/repo/src/test/a.ts', ['**/test/**']));
});

test('isFileExcluded - bare folder names exclude their contents only', () => {
  assert.ok(isFileExcluded('/repo/dist/api.js', ['dist']));
  assert.ok(isFileExcluded('/repo/dist/nested/api.js', ['dist/']));
  assert.strictEqual(isFileExcluded('/repo/src/distance.ts', ['dist']), false);
});

test('isFileExcluded - treats dots literally', () => {
  assert.ok(isFileExcluded('/repo/src/a.spec.ts', ['*.spec.ts']));
  assert.strictEqual(isFileExcluded('/repo/src/aXspecXts', ['*.spec.ts']), false);
});

test('isFileExcluded - handles Windows paths', () => {
  assert.ok(isFileExcluded('C:\\Repo\\src\\generated\\x.ts', ['**/generated/**']));
  assert.ok(isFileExcluded('C:\\Repo\\src\\a.ts', ['C:/Repo/src/**']));
});
