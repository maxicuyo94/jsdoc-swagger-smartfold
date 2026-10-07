import * as vscode from 'vscode';
import { COMMANDS } from './constants';
import { findSwaggerBlocks, SwaggerBlock } from './swaggerUtils';
import { isSupportedLanguage, DIAGNOSTICS_SOURCE, DOCUMENT_SELECTORS } from './constants';
import {
  buildAddOperationFieldChange,
  buildAddResponsesChange,
  findTypeValueRange,
  getOperationDefinition,
  listOperations,
  OperationRef,
  suggestOperationId,
  TextChange,
  toBlockSegments,
} from './swaggerEdits';
import { parseJsonPointer } from './yamlLocator';

// Validator messages carry one error per line, each starting with a JSON pointer
const MISSING_RESPONSES_REGEX = /(#\/\S*) must have required property 'responses'/g;
const INVALID_TYPE_REGEX = /(#\/\S*\/type) must be equal to one of the allowed values/g;

const OPENAPI_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'];

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

    const blocks = findSwaggerBlocks(document);
    const actions: vscode.CodeAction[] = [];

    // Quick fixes for swagger diagnostics in range
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== DIAGNOSTICS_SOURCE) {
        continue;
      }
      const block = blocks.find((b) => b.range.contains(diagnostic.range.start));
      if (block) {
        actions.push(...this.getQuickFixesForDiagnostic(document, block, diagnostic));
      }
    }

    // Refactoring actions for the block at cursor
    const blockAtCursor = blocks.find((b) => b.range.contains(range.start));
    if (blockAtCursor) {
      actions.push(...this.getRefactoringActions(document, blockAtCursor, range.start));
    }

    return actions;
  }

  private getQuickFixesForDiagnostic(
    document: vscode.TextDocument,
    block: SwaggerBlock,
    diagnostic: vscode.Diagnostic,
  ): vscode.CodeAction[] {
    const fixes: vscode.CodeAction[] = [];

    for (const [, pointer] of diagnostic.message.matchAll(MISSING_RESPONSES_REGEX)) {
      const [path, method] = toBlockSegments(block, parseJsonPointer(pointer)).slice(-2);
      const change = buildAddResponsesChange(document, block, path, method);
      if (change) {
        const fix = this.createAction(
          document,
          `Add default responses to ${method.toUpperCase()} ${path}`,
          vscode.CodeActionKind.QuickFix,
          change,
        );
        fix.diagnostics = [diagnostic];
        fix.isPreferred = true;
        fixes.push(fix);
      }
    }

    for (const [, pointer] of diagnostic.message.matchAll(INVALID_TYPE_REGEX)) {
      fixes.push(...this.createTypeFixes(document, block, diagnostic, pointer));
    }

    return fixes;
  }

  private createTypeFixes(
    document: vscode.TextDocument,
    block: SwaggerBlock,
    diagnostic: vscode.Diagnostic,
    pointer: string,
  ): vscode.CodeAction[] {
    const segments = toBlockSegments(block, parseJsonPointer(pointer));
    const valueRange = findTypeValueRange(document, block, segments);
    if (!valueRange) {
      return [];
    }

    const current = document.getText(valueRange).replace(/['"]/g, '');
    return suggestTypes(current).map((type, index) => {
      const fix = this.createAction(
        document,
        `Change type "${current}" to "${type}"`,
        vscode.CodeActionKind.QuickFix,
        { range: valueRange, newText: type },
      );
      fix.diagnostics = [diagnostic];
      fix.isPreferred = index === 0;
      return fix;
    });
  }

  private getRefactoringActions(
    document: vscode.TextDocument,
    block: SwaggerBlock,
    position: vscode.Position,
  ): vscode.CodeAction[] {
    const operations = listOperations(block);
    if (operations.length === 0) {
      return [];
    }

    const actions: vscode.CodeAction[] = [];

    const addTagsAction = new vscode.CodeAction(
      'Add tags to endpoint',
      vscode.CodeActionKind.Refactor,
    );
    addTagsAction.command = {
      command: COMMANDS.ADD_TAGS,
      title: 'Add Tags',
      arguments: [document.uri, position],
    };
    actions.push(addTagsAction);

    // Optional fields, offered for the operation under the cursor when missing
    const operation = findOperationAt(operations, position.line);
    if (operation) {
      actions.push(...this.getMissingFieldActions(document, block, operation));
    }

    return actions;
  }

  private getMissingFieldActions(
    document: vscode.TextDocument,
    block: SwaggerBlock,
    operation: OperationRef,
  ): vscode.CodeAction[] {
    const { path, method } = operation;
    const definition = getOperationDefinition(block, path, method);
    const actions: vscode.CodeAction[] = [];
    const fields: Array<[string, string]> = [
      ['summary', 'TODO'],
      ['operationId', suggestOperationId(path, method)],
    ];

    for (const [field, value] of fields) {
      if (field in definition) {
        continue;
      }
      const change = buildAddOperationFieldChange(document, block, path, method, field, value);
      if (change) {
        actions.push(
          this.createAction(
            document,
            `Add ${field} to ${method.toUpperCase()} ${path}`,
            vscode.CodeActionKind.Refactor,
            change,
          ),
        );
      }
    }

    return actions;
  }

  private createAction(
    document: vscode.TextDocument,
    title: string,
    kind: vscode.CodeActionKind,
    change: TextChange,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(title, kind);
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(document.uri, change.range, change.newText);
    return action;
  }
}

/**
 * Operation whose lines contain `line`
 */
export function findOperationAt(
  operations: OperationRef[],
  line: number,
): OperationRef | undefined {
  return operations.find((op) => line >= op.line && line <= op.endLine);
}

/**
 * Valid OpenAPI types to suggest for an invalid `type` value: only the closest
 * one when it is a clear match (e.g. `strng`, `obj`, `bool`), otherwise all of
 * them, closest first.
 */
export function suggestTypes(invalidType: string): string[] {
  // Abbreviations: a prefix of exactly one type (int, obj, bool, num, str)
  const lower = invalidType.toLowerCase();
  const prefixMatches = OPENAPI_TYPES.filter((type) => lower.length >= 2 && type.startsWith(lower));
  if (prefixMatches.length === 1) {
    return prefixMatches;
  }

  const ranked = OPENAPI_TYPES.map((type) => ({
    type,
    distance: editDistance(invalidType, type),
  })).sort((a, b) => a.distance - b.distance);
  const [best, second] = ranked;
  const isClearMatch =
    best.distance <= Math.ceil(best.type.length / 2) && best.distance < second.distance;
  return isClearMatch ? [best.type] : ranked.map((r) => r.type);
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const previous = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1].toLowerCase() === b[j - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return row[b.length];
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
