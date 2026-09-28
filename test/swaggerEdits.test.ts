import * as assert from 'node:assert';
import * as vscode from 'vscode';
import test from 'node:test';
import {
  buildAddTagsChange,
  listOperations,
  suggestOperationId,
  TextChange,
} from '../src/swaggerEdits';
import {
  findSwaggerBlocks,
  findSwaggerYamlInText,
  mergeBlocksToOpenApi,
  parseYamlContent,
  SwaggerBlock,
} from '../src/swaggerUtils';
import { locateYamlPath, parseJsonPointer } from '../src/yamlLocator';

const { testUtils } = vscode as unknown as {
  testUtils: {
    createTextDocument: (text: string, uri?: string, languageId?: string) => vscode.TextDocument;
  };
};

let documentCounter = 0;

function openDocument(text: string): vscode.TextDocument {
  documentCounter++;
  return testUtils.createTextDocument(text, `file:///swagger-edits-${documentCounter}.ts`);
}

function swaggerBlock(...yamlLines: string[]): string {
  return ['/**', ' * @swagger', ...yamlLines.map((line) => ` * ${line}`), ' */'].join('\n');
}

function applyChange(document: vscode.TextDocument, change: TextChange): string {
  const text = document.getText();
  return (
    text.slice(0, document.offsetAt(change.range.start)) +
    change.newText +
    text.slice(document.offsetAt(change.range.end))
  );
}

function onlyBlock(document: vscode.TextDocument): SwaggerBlock {
  const blocks = findSwaggerBlocks(document);
  assert.strictEqual(blocks.length, 1);
  return blocks[0];
}

function tagsOf(text: string, path: string, method: string): unknown {
  const parsed = parseYamlContent(onlyBlock(openDocument(text)).yamlContent);
  assert.ok(parsed, 'Result must be valid YAML');
  return (parsed[path] as Record<string, Record<string, unknown>>)[method].tags;
}

// ── yamlLocator ─────────────────────────────────────────────────────

const LOCATOR_YAML = [
  '/users:',
  '  get:',
  '    parameters:',
  '      - in: query',
  '        name: limit',
  '      - in: path',
  "        'name': id",
  '    tags:',
  '    - Users',
  '    responses:',
  '      "200":',
  '        description: ok',
  '',
  '  post:',
  '    summary: Create',
].join('\n');

test('yamlLocator - finds nested mapping keys with their extent', () => {
  const node = locateYamlPath(LOCATOR_YAML, ['/users', 'get']);
  assert.deepStrictEqual(node, { line: 1, indent: 2, endLine: 11, childIndent: 4 });
});

test('yamlLocator - navigates sequence items and quoted keys', () => {
  assert.strictEqual(
    locateYamlPath(LOCATOR_YAML, ['/users', 'get', 'parameters', '1', 'name'])?.line,
    6,
  );
  assert.strictEqual(locateYamlPath(LOCATOR_YAML, ['/users', 'get', 'responses', '200'])?.line, 10);
});

test('yamlLocator - sequences at the same indentation as their key belong to it', () => {
  const tags = locateYamlPath(LOCATOR_YAML, ['/users', 'get', 'tags']);
  assert.deepStrictEqual(tags, { line: 7, indent: 4, endLine: 8, childIndent: 4 });
});

test('yamlLocator - returns undefined for missing paths', () => {
  assert.strictEqual(locateYamlPath(LOCATOR_YAML, ['/users', 'delete']), undefined);
  assert.strictEqual(locateYamlPath(LOCATOR_YAML, ['/users', 'get', 'parameters', '5']), undefined);
});

test('yamlLocator - decodes JSON pointers', () => {
  assert.deepStrictEqual(parseJsonPointer('#/paths/~1users~1{id}/get/a~0b'), [
    'paths',
    '/users/{id}',
    'get',
    'a~b',
  ]);
});

// ── Add tags ────────────────────────────────────────────────────────

test('Add tags - inserts tags as the first field of the chosen operation', () => {
  const document = openDocument(
    swaggerBlock('/users:', '  get:', '    summary: List', '  post:', '    summary: Create'),
  );
  const change = buildAddTagsChange(document, onlyBlock(document), '/users', 'post', ['Users']);
  assert.ok(change);

  const text = applyChange(document, change);
  assert.deepStrictEqual(tagsOf(text, '/users', 'post'), ['Users']);
  assert.strictEqual(tagsOf(text, '/users', 'get'), undefined);
});

test('Add tags - merges with existing tags instead of duplicating the key', () => {
  const document = openDocument(
    swaggerBlock('/users:', '  get:', '    tags:', '      - Users', '    summary: List'),
  );
  const change = buildAddTagsChange(document, onlyBlock(document), '/users', 'get', [
    'Users',
    'Admin',
  ]);
  assert.ok(change);

  const text = applyChange(document, change);
  assert.deepStrictEqual(tagsOf(text, '/users', 'get'), ['Users', 'Admin']);
  assert.strictEqual(text.match(/tags:/g)?.length, 1, text);
});

test('Add tags - rewrites flow-style tag lists', () => {
  const document = openDocument(swaggerBlock('/users:', '  get:', '    tags: [Users]'));
  const change = buildAddTagsChange(document, onlyBlock(document), '/users', 'get', ['Admin']);
  assert.ok(change);
  assert.deepStrictEqual(tagsOf(applyChange(document, change), '/users', 'get'), [
    'Users',
    'Admin',
  ]);
});

test('Add tags - respects 4-space indentation and quotes special values', () => {
  const document = openDocument(swaggerBlock('/users:', '    get:', '        summary: List'));
  const change = buildAddTagsChange(document, onlyBlock(document), '/users', 'get', [
    'Users: admin',
  ]);
  assert.ok(change);

  const text = applyChange(document, change);
  assert.ok(text.includes(' *         tags:\n *             - "Users: admin"\n'), text);
  assert.deepStrictEqual(tagsOf(text, '/users', 'get'), ['Users: admin']);
});

test('Add tags - returns undefined when every tag already exists', () => {
  const document = openDocument(swaggerBlock('/users:', '  get:', '    tags: [Users]'));
  assert.strictEqual(
    buildAddTagsChange(document, onlyBlock(document), '/users', 'get', ['Users']),
    undefined,
  );
});

test('Add tags - supports full documents with a paths root', () => {
  const document = openDocument(
    swaggerBlock('openapi: 3.0.0', 'paths:', '  /users:', '    get:', '      summary: List'),
  );
  const block = onlyBlock(document);
  assert.deepStrictEqual(
    listOperations(block).map((op) => [op.method, op.path, op.line]),
    [['get', '/users', 5]],
  );

  const change = buildAddTagsChange(document, block, '/users', 'get', ['Users']);
  assert.ok(change);
  const parsed = parseYamlContent(
    onlyBlock(openDocument(applyChange(document, change))).yamlContent,
  );
  const paths = parsed?.paths as Record<string, Record<string, Record<string, unknown>>>;
  assert.deepStrictEqual(paths['/users'].get.tags, ['Users']);
});

// ── Helpers ─────────────────────────────────────────────────────────

test('suggestOperationId - builds camelCase ids from method and path', () => {
  assert.strictEqual(suggestOperationId('/users/{id}', 'get'), 'getUsersById');
  assert.strictEqual(suggestOperationId('/api/v1/order-items', 'post'), 'postApiV1OrderItems');
});

test('findSwaggerYamlInText - extracts blocks from raw text for the project export', () => {
  const text = [
    swaggerBlock('/a:', '  get:', '    summary: A'),
    '/** Regular comment */',
    swaggerBlock('/b:', '  post:', '    summary: B'),
  ].join('\n');
  const yamlContents = findSwaggerYamlInText(text);

  assert.strictEqual(yamlContents.length, 2);
  const doc = mergeBlocksToOpenApi(
    yamlContents.map((yamlContent) => ({ yamlContent })),
    'Project',
  );
  assert.deepStrictEqual(Object.keys(doc.paths), ['/a', '/b']);
});
