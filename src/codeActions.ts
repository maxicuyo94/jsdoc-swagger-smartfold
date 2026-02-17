import * as vscode from 'vscode';
import { COMMANDS } from './constants';
import { findSwaggerBlocks, parseYamlContent } from './swaggerUtils';
import { isSupportedLanguage, DIAGNOSTICS_SOURCE, DOCUMENT_SELECTORS } from './constants';

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

  /**
   * Detect the indentation used in the JSDoc block near the diagnostic line.
   * Returns the leading whitespace + asterisk prefix (e.g., " *   ") for the
   * property level, and a deeper level for nested values.
   */
  private detectIndentation(
    document: vscode.TextDocument,
    line: number,
  ): { property: string; nested: string } {
    // Scan the diagnostic line and up to 5 lines above to find a YAML content line
    // (one with " * key:" pattern) for reliable indentation detection.
    const safeLine = Math.min(line, document.lineCount - 1);
    for (let i = safeLine; i >= Math.max(0, safeLine - 5); i--) {
      const text = document.lineAt(i).text;
      // Match a line like " *   get:" or " *     summary: ..."
      const contentMatch = text.match(/^(\s*\*\s+)\S/);
      if (contentMatch) {
        const base = contentMatch[1];
        return { property: base, nested: base + '  ' };
      }
    }
    // Fallback: use standard JSDoc indentation
    return { property: ' *     ', nested: ' *       ' };
  }

  private createAddResponsesFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    const fix = new vscode.CodeAction('Add default responses', vscode.CodeActionKind.QuickFix);

    const { property, nested } = this.detectIndentation(document, diagnostic.range.end.line);
    const deep = nested + '  ';
    const responsesSnippet =
      `${property}responses:\n` +
      `${nested}200:\n` +
      `${deep}description: Successful response\n` +
      `${nested}400:\n` +
      `${deep}description: Bad request\n` +
      `${nested}500:\n` +
      `${deep}description: Internal server error\n`;

    const edit = new vscode.WorkspaceEdit();
    const insertPosition = new vscode.Position(diagnostic.range.end.line, 0);
    edit.insert(document.uri, insertPosition, responsesSnippet);

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

    const { nested } = this.detectIndentation(document, diagnostic.range.start.line);
    const edit = new vscode.WorkspaceEdit();
    const insertPosition = new vscode.Position(diagnostic.range.start.line + 1, 0);
    edit.insert(document.uri, insertPosition, `${nested}summary: TODO: Add summary\n`);

    fix.edit = edit;
    fix.diagnostics = [diagnostic];

    return fix;
  }

  private createAddOperationIdFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction | null {
    const fix = new vscode.CodeAction('Add operationId', vscode.CodeActionKind.QuickFix);

    const { nested } = this.detectIndentation(document, diagnostic.range.start.line);
    const edit = new vscode.WorkspaceEdit();
    const insertPosition = new vscode.Position(diagnostic.range.start.line + 1, 0);
    edit.insert(document.uri, insertPosition, `${nested}operationId: myOperation\n`);

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
        command: COMMANDS.ADD_TAGS,
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
    [...DOCUMENT_SELECTORS],
    provider,
    {
      providedCodeActionKinds: SwaggerCodeActionProvider.providedCodeActionKinds,
    },
  );

  context.subscriptions.push(disposable);
}
