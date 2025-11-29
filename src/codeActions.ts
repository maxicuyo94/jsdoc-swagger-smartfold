import * as vscode from 'vscode';
import { findSwaggerBlocks, parseYamlContent } from './swaggerUtils';
import { isSupportedLanguage, DIAGNOSTICS_SOURCE } from './constants';

/**
 * Code Action provider for Swagger blocks
 * Provides quick fixes for common OpenAPI issues
 */
export class SwaggerCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): vscode.CodeAction[] {
    if (!isSupportedLanguage(document.languageId)) {
      return [];
    }

    const actions: vscode.CodeAction[] = [];

    // Find swagger diagnostics in range
    const swaggerDiagnostics = context.diagnostics.filter((d) => d.source === DIAGNOSTICS_SOURCE);

    // Add quick fixes for diagnostics
    for (const diagnostic of swaggerDiagnostics) {
      const fixes = this.getQuickFixesForDiagnostic(document, diagnostic);
      actions.push(...fixes);
    }

    // Find block at cursor for refactoring actions
    const blocks = findSwaggerBlocks(document);
    const blockAtCursor = blocks.find((b) => b.range.contains(range.start));

    if (blockAtCursor) {
      // Add refactoring actions
      actions.push(...this.getRefactoringActions(document, blockAtCursor));
    }

    return actions;
  }

  private getQuickFixesForDiagnostic(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction[] {
    const fixes: vscode.CodeAction[] = [];
    const message = diagnostic.message.toLowerCase();

    // Missing responses
    if (message.includes('responses') && message.includes('required')) {
      const fix = this.createAddResponsesFix(document, diagnostic);
      if (fix) {
        fixes.push(fix);
      }
    }

    // Missing summary
    if (message.includes('summary')) {
      const fix = this.createAddSummaryFix(document, diagnostic);
      if (fix) {
        fixes.push(fix);
      }
    }

    // Missing operationId
    if (message.includes('operationid')) {
      const fix = this.createAddOperationIdFix(document, diagnostic);
      if (fix) {
        fixes.push(fix);
      }
    }

    // Invalid type
    if (message.includes('type') && message.includes('invalid')) {
      fixes.push(...this.createTypeFixSuggestions(document, diagnostic));
    }

    return fixes;
  }

  private createAddResponsesFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    const fix = new vscode.CodeAction('Add default responses', vscode.CodeActionKind.QuickFix);

    const responsesSnippet = `      responses:
        200:
          description: Successful response
        400:
          description: Bad request
        500:
          description: Internal server error`;

    const edit = new vscode.WorkspaceEdit();
    const insertPosition = new vscode.Position(diagnostic.range.end.line, 0);
    edit.insert(document.uri, insertPosition, responsesSnippet + '\n');

    fix.edit = edit;
    fix.diagnostics = [diagnostic];
    fix.isPreferred = true;

    return fix;
  }

  private createAddSummaryFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    const fix = new vscode.CodeAction('Add summary field', vscode.CodeActionKind.QuickFix);

    const edit = new vscode.WorkspaceEdit();
    const insertPosition = new vscode.Position(diagnostic.range.start.line + 1, 0);
    edit.insert(document.uri, insertPosition, '        summary: TODO: Add summary\n');

    fix.edit = edit;
    fix.diagnostics = [diagnostic];

    return fix;
  }

  private createAddOperationIdFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    const fix = new vscode.CodeAction('Add operationId', vscode.CodeActionKind.QuickFix);

    const edit = new vscode.WorkspaceEdit();
    const insertPosition = new vscode.Position(diagnostic.range.start.line + 1, 0);
    edit.insert(document.uri, insertPosition, '        operationId: myOperation\n');

    fix.edit = edit;
    fix.diagnostics = [diagnostic];

    return fix;
  }

  private createTypeFixSuggestions(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction[] {
    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object'];
    const fixes: vscode.CodeAction[] = [];

    for (const type of validTypes) {
      const fix = new vscode.CodeAction(`Change to "${type}"`, vscode.CodeActionKind.QuickFix);

      const edit = new vscode.WorkspaceEdit();
      const line = document.lineAt(diagnostic.range.start.line);
      const typeMatch = line.text.match(/type:\s*(\S+)/);

      if (typeMatch) {
        const start = line.text.indexOf(typeMatch[1]);
        const range = new vscode.Range(
          diagnostic.range.start.line,
          start,
          diagnostic.range.start.line,
          start + typeMatch[1].length,
        );
        edit.replace(document.uri, range, type);
        fix.edit = edit;
        fix.diagnostics = [diagnostic];
        fixes.push(fix);
      }
    }

    return fixes;
  }

  private getRefactoringActions(
    document: vscode.TextDocument,
    block: { range: vscode.Range; yamlContent: string },
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // Add tags action
    const parsed = parseYamlContent(block.yamlContent);
    if (parsed) {
      const addTagsAction = new vscode.CodeAction(
        'Add tags to endpoint',
        vscode.CodeActionKind.Refactor,
      );
      addTagsAction.command = {
        command: 'swaggerFold.addTags',
        title: 'Add Tags',
        arguments: [document.uri, block.range],
      };
      actions.push(addTagsAction);
    }

    return actions;
  }
}

/**
 * Activate code action provider
 */
export function activateCodeActions(context: vscode.ExtensionContext): void {
  const provider = new SwaggerCodeActionProvider();

  const disposable = vscode.languages.registerCodeActionsProvider(
    [
      { language: 'javascript' },
      { language: 'typescript' },
      { language: 'javascriptreact' },
      { language: 'typescriptreact' },
      { language: 'vue' },
      { language: 'svelte' },
    ],
    provider,
    {
      providedCodeActionKinds: SwaggerCodeActionProvider.providedCodeActionKinds,
    },
  );

  context.subscriptions.push(disposable);
}
