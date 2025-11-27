import * as vscode from 'vscode';
import { findSwaggerBlocks, SwaggerBlock } from './swaggerUtils';
import { isSupportedLanguage, configManager } from './constants';

// Decoration types (initialized once)
let blockDecorationType: vscode.TextEditorDecorationType;
let keyDecorationType: vscode.TextEditorDecorationType;
let valueDecorationType: vscode.TextEditorDecorationType;

// Pre-compiled regex for YAML key-value parsing
const YAML_KEY_VALUE_REGEX = /^(\s*\*\s*)?([\w\-./'"]+):(.*)$/;

export function activateDecorations(context: vscode.ExtensionContext): void {
  // Block background & border
  blockDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.hoverHighlightBackground'),
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('textLink.foreground'),
  });

  // YAML keys (bold)
  keyDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editor.foreground'),
    fontWeight: 'bold',
  });

  // YAML values (muted)
  valueDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('descriptionForeground'),
  });

  context.subscriptions.push(blockDecorationType, keyDecorationType, valueDecorationType);
}

export function updateDecorations(editor: vscode.TextEditor): void {
  if (!editor) {
    return;
  }

  const document = editor.document;

  // Skip unsupported languages
  if (!isSupportedLanguage(document.languageId)) {
    return;
  }

  // Check if highlighting is enabled
  if (!configManager.highlight) {
    clearDecorations(editor);
    return;
  }

  const blocks = findSwaggerBlocks(document);

  if (blocks.length === 0) {
    clearDecorations(editor);
    return;
  }

  const { blockRanges, keyRanges, valueRanges } = parseAllBlocks(document, blocks);

  editor.setDecorations(blockDecorationType, blockRanges);
  editor.setDecorations(keyDecorationType, keyRanges);
  editor.setDecorations(valueDecorationType, valueRanges);
}

function clearDecorations(editor: vscode.TextEditor): void {
  editor.setDecorations(blockDecorationType, []);
  editor.setDecorations(keyDecorationType, []);
  editor.setDecorations(valueDecorationType, []);
}

interface ParsedRanges {
  blockRanges: vscode.Range[];
  keyRanges: vscode.Range[];
  valueRanges: vscode.Range[];
}

function parseAllBlocks(document: vscode.TextDocument, blocks: SwaggerBlock[]): ParsedRanges {
  const blockRanges: vscode.Range[] = [];
  const keyRanges: vscode.Range[] = [];
  const valueRanges: vscode.Range[] = [];

  for (const block of blocks) {
    blockRanges.push(block.range);
    parseBlockLines(document, block, keyRanges, valueRanges);
  }

  return { blockRanges, keyRanges, valueRanges };
}

function parseBlockLines(
  document: vscode.TextDocument,
  block: SwaggerBlock,
  keyRanges: vscode.Range[],
  valueRanges: vscode.Range[],
): void {
  const startLine = block.contentStartLine;
  const endLine = Math.min(block.range.end.line, document.lineCount - 1);

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = document.lineAt(lineNum);
    const match = YAML_KEY_VALUE_REGEX.exec(line.text);

    if (!match) {
      continue;
    }

    const prefix = match[1] ?? '';
    const key = match[2];
    const valueWithWhitespace = match[3] ?? '';

    // Calculate key range
    const keyStart = (match.index ?? 0) + prefix.length;
    const keyEnd = keyStart + key.length;
    keyRanges.push(new vscode.Range(lineNum, keyStart, lineNum, keyEnd));

    // Calculate value range (trimmed)
    const trimmedValue = valueWithWhitespace.trim();
    if (trimmedValue.length > 0) {
      const leadingSpaces = valueWithWhitespace.indexOf(trimmedValue);
      const valueStart = keyEnd + 1 + leadingSpaces; // +1 for colon
      const valueEnd = valueStart + trimmedValue.length;
      valueRanges.push(new vscode.Range(lineNum, valueStart, lineNum, valueEnd));
    }
  }
}
