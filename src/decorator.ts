import * as vscode from 'vscode';
import { findSwaggerBlocks, SwaggerBlock } from './swaggerUtils';

let blockDecorationType: vscode.TextEditorDecorationType;
let keyDecorationType: vscode.TextEditorDecorationType;
let valueDecorationType: vscode.TextEditorDecorationType;

export function activateDecorations(context: vscode.ExtensionContext) {
  // 1. Block Background & Border
  blockDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.hoverHighlightBackground'),
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('textLink.foreground'),
  });

  // 2. YAML Keys
  keyDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('entity.name.tag'),
    fontWeight: 'bold',
  });

  // 3. YAML Values
  valueDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('string.quoted.double'),
  });

  context.subscriptions.push(blockDecorationType, keyDecorationType, valueDecorationType);
}

export function updateDecorations(editor: vscode.TextEditor) {
  if (!editor) {
    return;
  }

  const config = vscode.workspace.getConfiguration('swaggerFold');
  const shouldHighlight = config.get<boolean>('highlight', true);

  if (!shouldHighlight) {
    editor.setDecorations(blockDecorationType, []);
    editor.setDecorations(keyDecorationType, []);
    editor.setDecorations(valueDecorationType, []);
    return;
  }

  const document = editor.document;
  // Only process supported languages to avoid unnecessary work
  const supportedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
  if (!supportedLanguages.includes(document.languageId)) {
    return;
  }

  const blocks = findSwaggerBlocks(document);

  const blockRanges: vscode.Range[] = [];
  const keyRanges: vscode.Range[] = [];
  const valueRanges: vscode.Range[] = [];

  for (const block of blocks) {
    blockRanges.push(block.range);
    parseBlockLines(document, block, keyRanges, valueRanges);
  }

  editor.setDecorations(blockDecorationType, blockRanges);
  editor.setDecorations(keyDecorationType, keyRanges);
  editor.setDecorations(valueDecorationType, valueRanges);
}

function parseBlockLines(
  document: vscode.TextDocument,
  block: SwaggerBlock,
  keyRanges: vscode.Range[],
  valueRanges: vscode.Range[],
) {
  const startLine = block.contentStartLine;
  // We stop before the last line if it only contains */
  const endLine = block.range.end.line;

  // Regex to capture key and value, ignoring JSDoc asterisk
  // Matches: [optional whitespace*whitespace] [key] : [value]
  const regex = /^(\s*\*\s*)?([\w\-./'"]+):(.*)$/;

  for (let i = startLine; i <= endLine; i++) {
    if (i >= document.lineCount) break;

    const line = document.lineAt(i);
    const text = line.text;

    // Use exec instead of match
    const match = regex.exec(text);

    if (match) {
      const prefix = match[1] || '';
      const key = match[2];
      const valueWithWhitespace = match[3] || '';

      // Key Range
      const keyStart = (match.index || 0) + prefix.length;
      const keyEnd = keyStart + key.length;
      keyRanges.push(new vscode.Range(i, keyStart, i, keyEnd));

      // Value Range (Trim whitespace)
      const trimmedValue = valueWithWhitespace.trim();
      if (trimmedValue.length > 0) {
        // Calculate where the trimmed value starts
        // valueWithWhitespace includes leading whitespace after colon
        const leadingSpaces = valueWithWhitespace.indexOf(trimmedValue);
        const valueStart = keyEnd + 1 + leadingSpaces; // +1 for the colon
        const valueEnd = valueStart + trimmedValue.length;

        valueRanges.push(new vscode.Range(i, valueStart, i, valueEnd));
      }
    }
  }
}
