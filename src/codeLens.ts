import * as vscode from 'vscode';
import { findSwaggerBlocks, SwaggerBlock } from './swaggerUtils';
import { isSupportedLanguage, COMMANDS } from './constants';

/**
 * CodeLens provider for Swagger blocks
 * Shows endpoint info (method + path) and quick actions
 */
export class SwaggerCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    if (!isSupportedLanguage(document.languageId)) {
      return [];
    }

    const blocks = findSwaggerBlocks(document);
    const codeLenses: vscode.CodeLens[] = [];

    for (const block of blocks) {
      const lenses = this.createCodeLensesForBlock(block);
      codeLenses.push(...lenses);
    }

    return codeLenses;
  }

  private createCodeLensesForBlock(block: SwaggerBlock): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const range = new vscode.Range(block.range.start.line, 0, block.range.start.line, 0);

    // Main endpoint info lens
    if (block.endpointInfo) {
      const { method, path, summary, parameters, responses } = block.endpointInfo;

      // Method + Path lens
      let title = `${method} ${path}`;
      if (summary) {
        title += ` - ${summary}`;
      }

      lenses.push(
        new vscode.CodeLens(range, {
          title,
          command: COMMANDS.TOGGLE_FOLD,
          tooltip: 'Click to toggle fold',
        }),
      );

      // Parameters info
      if (parameters && parameters > 0) {
        lenses.push(
          new vscode.CodeLens(range, {
            title: `${parameters} param${parameters > 1 ? 's' : ''}`,
            command: '',
            tooltip: `${parameters} parameter(s) defined`,
          }),
        );
      }

      // Responses info
      if (responses && responses.length > 0) {
        lenses.push(
          new vscode.CodeLens(range, {
            title: `${responses.join(', ')}`,
            command: '',
            tooltip: `Response codes: ${responses.join(', ')}`,
          }),
        );
      }
    } else {
      // Fallback for blocks without parseable endpoint info
      lenses.push(
        new vscode.CodeLens(range, {
          title: '📋 Swagger Block',
          command: COMMANDS.TOGGLE_FOLD,
          tooltip: 'Click to toggle fold',
        }),
      );
    }

    // Action lenses
    lenses.push(
      new vscode.CodeLens(range, {
        title: '📄 Copy JSON',
        command: COMMANDS.COPY_AS_JSON,
        arguments: [block],
        tooltip: 'Copy as JSON to clipboard',
      }),
    );

    return lenses;
  }
}

/**
 * Activate CodeLens provider
 */
export function activateCodeLens(context: vscode.ExtensionContext): SwaggerCodeLensProvider {
  const provider = new SwaggerCodeLensProvider();

  const disposable = vscode.languages.registerCodeLensProvider(
    [
      { language: 'javascript' },
      { language: 'typescript' },
      { language: 'javascriptreact' },
      { language: 'typescriptreact' },
      { language: 'vue' },
      { language: 'svelte' },
    ],
    provider,
  );

  context.subscriptions.push(disposable);

  return provider;
}

