import * as assert from 'node:assert';
import test from 'node:test';
import * as vscode from 'vscode';
import { findSwaggerBlocks, validateSwagger } from '../src/swaggerUtils';

const { testUtils } = vscode as unknown as {
  testUtils: {
    createTextDocument: (text: string, uri?: string, languageId?: string) => vscode.TextDocument;
  };
};

function swaggerBlock(...yamlLines: string[]): string {
  return ['/**', ' * @swagger', ...yamlLines.map((line) => ` * ${line}`), ' */'].join('\n');
}

async function validate(text: string, uri: string): Promise<vscode.Diagnostic[]> {
  return validateSwagger(findSwaggerBlocks(testUtils.createTextDocument(text, uri)));
}

test('Precise diagnostics - one diagnostic per error, on the offending line', async () => {
  const diagnostics = await validate(
    swaggerBlock(
      '/users/{id}:', //          line 2
      '  get:', //                line 3
      '    parameters:', //       line 4
      '      - in: query', //     line 5
      '        name: limit', //   line 6
      '        schema:', //       line 7
      '          type: strng', // line 8
      '    responses:', //        line 9
      '      200:', //            line 10
      '        description: ok', // line 11
      '  post:', //               line 12
      '    summary: Create', //   line 13
    ),
    'file:///precise-lines.ts',
  );

  const byLine = diagnostics
    .map((d) => [d.range.start.line, d.message] as const)
    .sort((a, b) => a[0] - b[0]);

  assert.deepStrictEqual(
    byLine.map(([line]) => line),
    [8, 12],
    byLine.map(([, message]) => message).join('\n'),
  );
  assert.match(
    byLine[0][1],
    /parameters\/0\/schema\/type must be equal to one of the allowed values/,
  );
  assert.match(
    byLine[1][1],
    /#\/paths\/~1users~1\{id\}\/post must have required property 'responses'/,
  );
});

test('Precise diagnostics - drops errors that only restate a more specific one', async () => {
  const diagnostics = await validate(
    swaggerBlock(
      '/items:',
      '  get:',
      '    responses:',
      '      200:',
      '        description: ok',
      '        content:',
      '          application/json:',
      '            schema:',
      '              type: obj',
    ),
    'file:///precise-cascade.ts',
  );

  assert.strictEqual(diagnostics.length, 1, diagnostics.map((d) => d.message).join('\n'));
  assert.ok(!/oneOf|'\$ref'/.test(diagnostics[0].message), diagnostics[0].message);
  assert.strictEqual(diagnostics[0].range.start.line, 10);
});

test('Precise diagnostics - locates errors in complete documents with a paths root', async () => {
  const diagnostics = await validate(
    swaggerBlock(
      'openapi: 3.0.0', //        line 2
      'info:', //                 line 3
      '  title: API', //          line 4
      '  version: 1.0.0', //      line 5
      'paths:', //                line 6
      '  /health:', //            line 7
      '    get:', //              line 8
      '      summary: Health', // line 9
    ),
    'file:///precise-full-doc.ts',
  );

  assert.strictEqual(diagnostics.length, 1, diagnostics.map((d) => d.message).join('\n'));
  assert.strictEqual(diagnostics[0].range.start.line, 8);
});
