import * as assert from 'node:assert';
import test from 'node:test';
import * as vscode from 'vscode';
import { findSwaggerBlocks, validateSwagger } from '../src/swaggerUtils';

const { testUtils } = vscode as unknown as {
  testUtils: {
    createTextDocument: (text: string, uri?: string, languageId?: string) => vscode.TextDocument;
  };
};

/** Wraps YAML lines in a `@swagger` JSDoc block. */
function swaggerBlock(...yamlLines: string[]): string {
  return ['/**', ' * @swagger', ...yamlLines.map((line) => ` * ${line}`), ' */'].join('\n');
}

async function validate(text: string, uri: string): Promise<vscode.Diagnostic[]> {
  const document = testUtils.createTextDocument(text, uri);
  return validateSwagger(findSwaggerBlocks(document));
}

const USER_SCHEMA_BLOCK = swaggerBlock(
  'components:',
  '  schemas:',
  '    User:',
  '      type: object',
  '      properties:',
  '        id:',
  '          type: string',
);

const GET_USER_BLOCK = swaggerBlock(
  '/users/{id}:',
  '  get:',
  '    parameters:',
  "      - $ref: '#/components/parameters/UserId'",
  '    responses:',
  '      200:',
  '        description: ok',
  '        content:',
  '          application/json:',
  '            schema:',
  "              $ref: '#/components/schemas/User'",
  '      404:',
  "        $ref: '#/components/responses/NotFound'",
);

test('Cross-block refs - resolves components defined in another block of the same file', async () => {
  const diagnostics = await validate(
    `${USER_SCHEMA_BLOCK}\n\n${GET_USER_BLOCK}`,
    'file:///cross-block.ts',
  );
  assert.deepStrictEqual(
    diagnostics.map((d) => d.message),
    [],
  );
});

test('Cross-block refs - does not flag components defined in other files', async () => {
  const diagnostics = await validate(GET_USER_BLOCK, 'file:///other-file-refs.ts');
  assert.deepStrictEqual(
    diagnostics.map((d) => d.message),
    [],
  );
});

test('Cross-block refs - still reports real OpenAPI errors in the referencing block', async () => {
  const brokenBlock = swaggerBlock(
    '/users:',
    '  get:',
    '    summary: Missing responses',
    '    parameters:',
    "      - $ref: '#/components/parameters/Limit'",
  );
  const diagnostics = await validate(
    `${USER_SCHEMA_BLOCK}\n\n${brokenBlock}`,
    'file:///cross-block-broken.ts',
  );

  assert.strictEqual(diagnostics.length, 1, 'Only the broken block should be reported');
  assert.ok(/responses/.test(diagnostics[0].message), diagnostics[0].message);
  assert.ok(diagnostics[0].range.start.line > 8, 'Diagnostic should point at the second block');
});

test("Cross-block refs - a block's own components take precedence and stay validated", async () => {
  const invalidOwnComponent = swaggerBlock(
    'components:',
    '  responses:',
    '    NotFound:',
    '      content: {}',
  );
  const diagnostics = await validate(
    `${invalidOwnComponent}\n\n${GET_USER_BLOCK}`,
    'file:///own-components.ts',
  );

  assert.ok(diagnostics.length >= 1, 'A response without description must still be reported');
});
