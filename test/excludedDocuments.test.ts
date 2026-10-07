import * as assert from 'node:assert';
import test from 'node:test';
import * as vscode from 'vscode';
import { SwaggerCodeActionProvider } from '../src/codeActions';
import { SwaggerCodeLensProvider } from '../src/codeLens';
import { configManager, isDocumentEnabled } from '../src/constants';
import { SwaggerHoverProvider } from '../src/hoverProvider';

const { testUtils } = vscode as unknown as {
  testUtils: {
    createTextDocument: (text: string, uri?: string, languageId?: string) => vscode.TextDocument;
  };
};

const BLOCK = `/**\n * @swagger\n * /users:\n *   get:\n *     summary: List\n */`;
const token = {} as vscode.CancellationToken;

/** Runs `fn` with `swaggerFold.exclude` overridden. */
function withExclude(patterns: string[], fn: () => void): void {
  Object.defineProperty(configManager, 'exclude', { get: () => patterns, configurable: true });
  try {
    fn();
  } finally {
    delete (configManager as unknown as Record<string, unknown>).exclude;
  }
}

test('isDocumentEnabled - requires a supported language and no matching exclude pattern', () => {
  const generated = testUtils.createTextDocument(BLOCK, '/repo/src/generated/api.ts');
  const source = testUtils.createTextDocument(BLOCK, '/repo/src/api.ts');
  const markdown = testUtils.createTextDocument(BLOCK, '/repo/README.md', 'markdown');

  withExclude(['**/generated/**'], () => {
    assert.strictEqual(isDocumentEnabled(generated), false);
    assert.strictEqual(isDocumentEnabled(source), true);
    assert.strictEqual(isDocumentEnabled(markdown), false);
  });
});

test('Excluded documents get no CodeLens, hover or code actions', () => {
  const document = testUtils.createTextDocument(BLOCK, '/repo/src/generated/excluded.ts');
  const position = new vscode.Position(1, 5);

  withExclude(['**/generated/**'], () => {
    assert.deepStrictEqual(new SwaggerCodeLensProvider().provideCodeLenses(document, token), []);
    assert.strictEqual(new SwaggerHoverProvider().provideHover(document, position, token), null);
    assert.deepStrictEqual(
      new SwaggerCodeActionProvider().provideCodeActions(
        document,
        new vscode.Range(position, position),
        { diagnostics: [] } as unknown as vscode.CodeActionContext,
        token,
      ),
      [],
    );
  });

  // Same document without the exclusion does get CodeLens
  assert.ok(new SwaggerCodeLensProvider().provideCodeLenses(document, token).length > 0);
});
