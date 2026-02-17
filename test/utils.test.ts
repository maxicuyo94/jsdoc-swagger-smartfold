import * as assert from 'node:assert';
import test, { describe } from 'node:test';
import { debounce, DocumentCache } from '../src/utils';
import { isFileExcluded } from '../src/constants';
import { extractEndpointInfo, findSwaggerBlocks } from '../src/swaggerUtils';
import * as vscode from 'vscode';

const { testUtils } = vscode as unknown as {
  testUtils: {
    createTextDocument: (text: string, uri?: string, languageId?: string) => vscode.TextDocument;
  };
};
const createDocument = testUtils.createTextDocument;

// ── isFileExcluded ──────────────────────────────────────────────────

describe('isFileExcluded', () => {
  test('returns false for empty patterns', () => {
    assert.strictEqual(isFileExcluded('/src/index.ts', []), false);
  });

  test('matches ** glob pattern for directories', () => {
    assert.strictEqual(
      isFileExcluded('/project/node_modules/foo/bar.js', ['**/node_modules/**']),
      true,
    );
  });

  test('does not match unrelated paths', () => {
    assert.strictEqual(isFileExcluded('/project/src/app.ts', ['**/node_modules/**']), false);
  });

  test('matches single * wildcard', () => {
    assert.strictEqual(isFileExcluded('/project/test/foo.spec.ts', ['**/test/*']), true);
  });

  test('matches ? wildcard for single char', () => {
    assert.strictEqual(isFileExcluded('/project/src/a.ts', ['**/?.ts']), true);
    assert.strictEqual(isFileExcluded('/project/src/ab.ts', ['**/?.ts']), false);
  });

  test('handles Windows-style backslash paths', () => {
    assert.strictEqual(
      isFileExcluded('C:\\project\\node_modules\\pkg\\index.js', ['**/node_modules/**']),
      true,
    );
  });

  test('escapes regex special chars in patterns (e.g. dots)', () => {
    // Pattern "*.min.js" should not treat the dots as regex wildcards
    assert.strictEqual(isFileExcluded('/dist/app.min.js', ['**/*.min.js']), true);
    assert.strictEqual(isFileExcluded('/dist/appXminXjs', ['**/*.min.js']), false);
  });

  test('matches multiple patterns (any match returns true)', () => {
    assert.strictEqual(isFileExcluded('/project/test/foo.ts', ['**/dist/**', '**/test/**']), true);
  });
});

// ── DocumentCache ───────────────────────────────────────────────────

describe('DocumentCache', () => {
  test('stores and retrieves values', () => {
    const cache = new DocumentCache<string>(5);
    cache.set('file:///a.ts', 1, 'hello');
    assert.strictEqual(cache.get('file:///a.ts', 1), 'hello');
  });

  test('returns undefined for wrong version', () => {
    const cache = new DocumentCache<string>(5);
    cache.set('file:///a.ts', 1, 'hello');
    assert.strictEqual(cache.get('file:///a.ts', 2), undefined);
  });

  test('returns undefined for unknown uri', () => {
    const cache = new DocumentCache<string>(5);
    assert.strictEqual(cache.get('file:///unknown.ts', 1), undefined);
  });

  test('evicts oldest entry when at capacity', () => {
    const cache = new DocumentCache<string>(2);
    cache.set('a', 1, 'first');
    cache.set('b', 1, 'second');
    cache.set('c', 1, 'third'); // should evict 'a'
    assert.strictEqual(cache.get('a', 1), undefined);
    assert.strictEqual(cache.get('b', 1), 'second');
    assert.strictEqual(cache.get('c', 1), 'third');
  });

  test('LRU: accessing an entry prevents it from being evicted', () => {
    const cache = new DocumentCache<string>(2);
    cache.set('a', 1, 'first');
    cache.set('b', 1, 'second');
    // Access 'a' to make it recently used
    cache.get('a', 1);
    // Now adding 'c' should evict 'b' (oldest), not 'a'
    cache.set('c', 1, 'third');
    assert.strictEqual(cache.get('a', 1), 'first');
    assert.strictEqual(cache.get('b', 1), undefined);
    assert.strictEqual(cache.get('c', 1), 'third');
  });

  test('delete removes entry', () => {
    const cache = new DocumentCache<string>(5);
    cache.set('a', 1, 'val');
    cache.delete('a');
    assert.strictEqual(cache.get('a', 1), undefined);
  });

  test('clear removes all entries', () => {
    const cache = new DocumentCache<string>(5);
    cache.set('a', 1, 'x');
    cache.set('b', 1, 'y');
    cache.clear();
    assert.strictEqual(cache.get('a', 1), undefined);
    assert.strictEqual(cache.get('b', 1), undefined);
  });
});

// ── debounce ────────────────────────────────────────────────────────

describe('debounce', () => {
  test('calls the function after the delay', async () => {
    let called = false;
    const fn = debounce(() => {
      called = true;
    }, 10);
    fn();
    assert.strictEqual(called, false, 'should not be called immediately');
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(called, true, 'should be called after delay');
  });

  test('cancel prevents execution', async () => {
    let called = false;
    const fn = debounce(() => {
      called = true;
    }, 10);
    fn();
    fn.cancel();
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(called, false, 'should not be called after cancel');
  });

  test('resets timer on repeated calls', async () => {
    let count = 0;
    const fn = debounce(() => {
      count++;
    }, 30);
    fn();
    await new Promise((r) => setTimeout(r, 10));
    fn(); // restart
    await new Promise((r) => setTimeout(r, 10));
    fn(); // restart again
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(count, 1, 'should only fire once');
  });
});

// ── extractEndpointInfo ─────────────────────────────────────────────

describe('extractEndpointInfo', () => {
  test('extracts method, path, and summary from a simple block', () => {
    const jsdoc = `/**\n * @swagger\n * /api/users:\n *   get:\n *     summary: Get all users\n */`;
    const document = createDocument(jsdoc, 'file:///ep.ts');
    const blocks = findSwaggerBlocks(document);
    assert.strictEqual(blocks.length, 1);

    const info = extractEndpointInfo(blocks[0].yamlContent);
    assert.ok(info, 'Should extract endpoint info');
    assert.strictEqual(info!.path, '/api/users');
    assert.strictEqual(info!.method.toLowerCase(), 'get');
    assert.strictEqual(info!.summary, 'Get all users');
  });

  test('extracts POST method', () => {
    const jsdoc = `/**\n * @swagger\n * /api/items:\n *   post:\n *     summary: Create item\n */`;
    const document = createDocument(jsdoc, 'file:///ep2.ts');
    const blocks = findSwaggerBlocks(document);
    const info = extractEndpointInfo(blocks[0].yamlContent);
    assert.ok(info);
    assert.strictEqual(info!.method.toLowerCase(), 'post');
  });

  test('returns null for non-path yaml', () => {
    const jsdoc = `/**\n * @swagger\n * components:\n *   schemas:\n *     Foo:\n *       type: object\n */`;
    const document = createDocument(jsdoc, 'file:///ep3.ts');
    const blocks = findSwaggerBlocks(document);
    assert.strictEqual(blocks.length, 1);
    const info = extractEndpointInfo(blocks[0].yamlContent);
    assert.strictEqual(info, undefined);
  });
});
