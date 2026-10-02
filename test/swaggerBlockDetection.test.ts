import * as assert from 'node:assert';
import test from 'node:test';
import * as vscode from 'vscode';
import { findSwaggerBlocks, validateSwagger } from '../src/swaggerUtils';

const { testUtils } = vscode as unknown as {
  testUtils: {
    createTextDocument: (text: string, uri?: string, languageId?: string) => vscode.TextDocument;
  };
};
const createDocument = testUtils.createTextDocument;

test('Swagger Block Detection - should detect a swagger block', () => {
  const jsdoc = `/**\n * @swagger\n * /api/test:\n *   get:\n *     summary: Test endpoint\n */`;
  const document = createDocument(jsdoc, 'file:///test.ts');
  const result = findSwaggerBlocks(document);
  assert.ok(result.length > 0, 'Swagger block should be detected');
});

test('Swagger Block Detection - should not detect a swagger block in unrelated JSDoc', () => {
  const jsdoc = `/**\n * Just a regular comment\n */`;
  const document = createDocument(jsdoc, 'file:///test2.ts');
  const result = findSwaggerBlocks(document);
  assert.strictEqual(result.length, 0, 'No swagger block should be detected');
});

test('Swagger Block Detection - should detect @openapi tag as well', () => {
  const jsdoc = `/**\n * @openapi\n * /api/users:\n *   post:\n *     summary: Create user\n */`;
  const document = createDocument(jsdoc, 'file:///test3.ts');
  const result = findSwaggerBlocks(document);
  assert.ok(result.length > 0, 'OpenAPI block should be detected');
});

test('Swagger Block Detection - should detect multiple swagger blocks', () => {
  const jsdoc = `/**\n * @swagger\n * /api/test:\n *   get:\n *     summary: Test\n */\n\n/**\n * @swagger\n * /api/users:\n *   post:\n *     summary: Users\n */`;
  const document = createDocument(jsdoc, 'file:///test4.ts');
  const result = findSwaggerBlocks(document);
  assert.strictEqual(result.length, 2, 'Two swagger blocks should be detected');
});

test('Swagger Block Detection - preserves accurate ranges and contentStartLine for multiple blocks', () => {
  const jsdoc = `/**\n * @swagger\n * /api/first:\n *   get:\n *     summary: First\n */\nconst x = 1;\n/**\n * @swagger\n * /api/second:\n *   post:\n *     summary: Second\n */`;
  const document = createDocument(jsdoc, 'file:///multiblock.ts');
  const blocks = findSwaggerBlocks(document);

  assert.strictEqual(blocks.length, 2, 'Two swagger blocks should be detected');

  const startLines = blocks.map((b) => b.range.start.line);
  assert.deepStrictEqual(startLines, [0, 7], 'Block ranges should start at expected lines');

  for (const block of blocks) {
    assert.strictEqual(
      block.contentStartLine - block.range.start.line,
      2,
      'YAML content should start two lines after block start',
    );
    assert.ok(
      block.range.contains(new vscode.Position(block.range.start.line + 1, 0)),
      'Range should contain lines within the block',
    );
  }
});

test('Swagger validation reports errors for invalid OpenAPI structure', async () => {
  // This YAML is syntactically valid but has invalid OpenAPI structure
  const jsdoc = `/**\n * @swagger\n * /api/bad:\n *   get:\n *     summary: Test\n */`;
  const document = createDocument(jsdoc, 'file:///bad.ts');
  const blocks = findSwaggerBlocks(document);
  assert.strictEqual(blocks.length, 1, 'Expected one swagger block');

  const diagnostics = await validateSwagger(blocks);
  // The block is missing required 'responses' field, so it should have at least one diagnostic
  assert.ok(diagnostics.length >= 1, 'Expected at least one diagnostic for missing responses');
});

test('Swagger validation does not resolve external $refs', async () => {
  const jsdoc = `/**\n * @swagger\n * /api/ext:\n *   get:\n *     responses:\n *       200:\n *         description: ok\n *         content:\n *           application/json:\n *             schema:\n *               $ref: 'http://127.0.0.1:9/schema.json'\n */`;
  const document = createDocument(jsdoc, 'file:///external-ref.ts');
  const diagnostics = await validateSwagger(findSwaggerBlocks(document));
  for (const diagnostic of diagnostics) {
    assert.ok(
      !/download|fetch/i.test(diagnostic.message),
      `External $ref must not be fetched: ${diagnostic.message}`,
    );
  }
});

test('Swagger Block Detection - detects the tag on the opening comment line', () => {
  const jsdoc = `/** @swagger\n * /api/inline:\n *   get:\n *     summary: Inline\n */`;
  const blocks = findSwaggerBlocks(createDocument(jsdoc, 'file:///inline-tag.ts'));
  assert.strictEqual(blocks.length, 1, 'Block with inline tag should be detected');
  assert.strictEqual(blocks[0].contentStartLine, 1);
  assert.ok(blocks[0].yamlContent.includes('/api/inline:'));
  assert.strictEqual(blocks[0].endpointInfo?.path, '/api/inline');
});

test('Swagger Block Detection - ignores tags mentioned inside text', () => {
  const jsdoc = `/** Documented with @swagger elsewhere\n * see @openapi docs\n */`;
  const blocks = findSwaggerBlocks(createDocument(jsdoc, 'file:///mention.ts'));
  assert.strictEqual(blocks.length, 0);
});
