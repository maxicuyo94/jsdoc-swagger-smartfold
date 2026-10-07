import * as assert from 'node:assert';
import * as vscode from 'vscode';
import test from 'node:test';
import { SwaggerCodeActionProvider, suggestTypes } from '../src/codeActions';
import { findSwaggerBlocks, parseYamlContent } from '../src/swaggerUtils';

const { testUtils } = vscode as unknown as {
  testUtils: {
    createTextDocument: (text: string, uri?: string, languageId?: string) => vscode.TextDocument;
  };
};
const createDocument = testUtils.createTextDocument;

let documentCounter = 0;

/** Each call gets its own URI: the blocks cache is keyed by URI + version. */
function openDocument(text: string): vscode.TextDocument {
  documentCounter++;
  return createDocument(text, `file:///code-actions-${documentCounter}.ts`);
}

function swaggerBlock(...yamlLines: string[]): string {
  return ['/**', ' * @swagger', ...yamlLines.map((line) => ` * ${line}`), ' */'].join('\n');
}

function applyAction(document: vscode.TextDocument, action: vscode.CodeAction): string {
  const entries = (
    action.edit as unknown as { entries(): [unknown, vscode.TextEdit[]][] }
  ).entries();
  assert.strictEqual(entries.length, 1, 'Action should edit a single document');

  // Apply from the bottom up so earlier offsets stay valid
  const edits = [...entries[0][1]].sort(
    (a, b) => document.offsetAt(b.range.start) - document.offsetAt(a.range.start),
  );
  let text = document.getText();
  for (const edit of edits) {
    const start = document.offsetAt(edit.range.start);
    const end = document.offsetAt(edit.range.end);
    text = text.slice(0, start) + edit.newText + text.slice(end);
  }
  return text;
}

function parseOnlyBlock(text: string): Record<string, unknown> {
  const blocks = findSwaggerBlocks(openDocument(text));
  assert.strictEqual(blocks.length, 1, 'Swagger block should still be detected');
  const parsed = parseYamlContent(blocks[0].yamlContent);
  assert.ok(parsed, `Block should be valid YAML:\n${blocks[0].yamlContent}`);
  return parsed;
}

function getActions(
  document: vscode.TextDocument,
  message: string,
  cursorLine = 2,
): vscode.CodeAction[] {
  const block = findSwaggerBlocks(document)[0];
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(block.range.start, block.range.end),
    message,
    vscode.DiagnosticSeverity.Warning,
  );
  diagnostic.source = 'JSDoc Swagger';
  const cursor = new vscode.Position(cursorLine, 0);

  return new SwaggerCodeActionProvider().provideCodeActions(
    document,
    new vscode.Range(cursor, cursor),
    { diagnostics: [diagnostic] } as unknown as vscode.CodeActionContext,
    {} as vscode.CancellationToken,
  );
}

const TWO_OPERATIONS = swaggerBlock(
  '/users:',
  '  get:',
  '    summary: List users',
  '    parameters:',
  '      - in: query',
  '        name: limit',
  '        schema:',
  '          type: strng',
  '  post:',
  '    summary: Create user',
  '    responses:',
  '      201:',
  '        description: Created',
);

const MISSING_RESPONSES =
  'OpenAPI Validation Error: Swagger schema validation failed.\n' +
  "  #/paths/~1users/get must have required property 'responses'\n";

test('Code actions - adds default responses to the operation named in the error', () => {
  const document = openDocument(TWO_OPERATIONS);
  const fix = getActions(document, MISSING_RESPONSES).find((a) =>
    a.title.startsWith('Add default responses'),
  );
  assert.ok(fix, 'Responses quick fix should be offered');
  assert.strictEqual(fix.title, 'Add default responses to GET /users');

  const parsed = parseOnlyBlock(applyAction(document, fix));
  const users = parsed['/users'] as Record<string, Record<string, unknown>>;
  const responses = users.get.responses as Record<string, unknown>;
  assert.deepStrictEqual(Object.keys(responses), ['200', '400', '500']);
  assert.deepStrictEqual(Object.keys(users.post.responses as object), ['201']);
});

test('Code actions - responses fix follows 4-space YAML indentation', () => {
  const document = openDocument(swaggerBlock('/items:', '    get:', '        summary: List items'));
  const message = "#/paths/~1items/get must have required property 'responses'";
  const fix = getActions(document, message).find((a) => a.title.startsWith('Add default'));
  assert.ok(fix);

  const text = applyAction(document, fix);
  assert.ok(text.includes(" *         responses:\n *             '200':"), text);
  const items = parseOnlyBlock(text)['/items'] as Record<string, Record<string, unknown>>;
  assert.ok(items.get.responses);
});

test('Code actions - offers one fix per operation missing responses', () => {
  const document = openDocument(
    swaggerBlock('/a:', '  get:', '    summary: A', '/b:', '  put:', '    summary: B'),
  );
  const message =
    "#/paths/~1a/get must have required property 'responses'\n" +
    "#/paths/~1b/put must have required property 'responses'";
  const titles = getActions(document, message)
    .map((a) => a.title)
    .filter((t) => t.startsWith('Add default'));
  assert.deepStrictEqual(titles, [
    'Add default responses to GET /a',
    'Add default responses to PUT /b',
  ]);
});

test('Code actions - suggests the closest valid type first and replaces only the value', () => {
  const document = openDocument(TWO_OPERATIONS);
  const message =
    '#/paths/~1users/get/parameters/0/schema/type must be equal to one of the allowed values';
  const typeFixes = getActions(document, message).filter((a) => a.title.startsWith('Change type'));

  assert.strictEqual(typeFixes[0].title, 'Change type "strng" to "string"');
  assert.strictEqual(typeFixes[0].isPreferred, true);

  const text = applyAction(document, typeFixes[0]);
  assert.ok(text.includes(' *           type: string\n'), text);
});

test('Code actions - offers summary/operationId only for the operation under the cursor', () => {
  const document = openDocument(
    swaggerBlock(
      '/users/{id}:',
      '  get:',
      '    responses:',
      '      200:',
      '        description: ok',
    ),
  );
  const titles = getActions(document, '', 4).map((a) => a.title);
  assert.ok(titles.includes('Add summary to GET /users/{id}'), titles.join(', '));
  assert.ok(titles.includes('Add operationId to GET /users/{id}'), titles.join(', '));

  const addOperationId = getActions(document, '', 4).find((a) =>
    a.title.startsWith('Add operationId'),
  );
  assert.ok(addOperationId);
  const parsed = parseOnlyBlock(applyAction(document, addOperationId));
  const get = (parsed['/users/{id}'] as Record<string, Record<string, unknown>>).get;
  assert.strictEqual(get.operationId, 'getUsersById');
  assert.ok(get.responses, 'Existing fields must be preserved');
});

test('Code actions - does not offer fields that are already present', () => {
  const document = openDocument(TWO_OPERATIONS);
  const titles = getActions(document, '', 4).map((a) => a.title);
  assert.ok(!titles.some((t) => t.startsWith('Add summary')), titles.join(', '));
  assert.ok(titles.includes('Add operationId to GET /users'), titles.join(', '));
});

test('suggestTypes - offers only the closest type when it is a clear match', () => {
  assert.deepStrictEqual(suggestTypes('strng'), ['string']);
  assert.deepStrictEqual(suggestTypes('obj'), ['object']);
  assert.deepStrictEqual(suggestTypes('bool'), ['boolean']);
  assert.deepStrictEqual(suggestTypes('int'), ['integer']);
  assert.deepStrictEqual(suggestTypes('String'), ['string']);
});

test('suggestTypes - offers every type, closest first, when nothing is a clear match', () => {
  const suggestions = suggestTypes('foo');
  assert.strictEqual(suggestions.length, 6);
  assert.deepStrictEqual([...suggestions].sort(), [
    'array',
    'boolean',
    'integer',
    'number',
    'object',
    'string',
  ]);
});
