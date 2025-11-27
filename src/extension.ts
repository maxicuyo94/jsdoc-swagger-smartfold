import * as vscode from 'vscode';
import { findSwaggerBlocks, validateSwagger, clearBlocksCache } from './swaggerUtils';
import { activateDecorations, updateDecorations } from './decorator';
import {
  DIAGNOSTIC_COLLECTION_NAME,
  COMMANDS,
  isSupportedLanguage,
  configManager,
} from './constants';
import { debounce } from './utils';

// Debounce delay in milliseconds
const VALIDATION_DEBOUNCE_MS = 300;
const DECORATION_DEBOUNCE_MS = 150;

let diagnosticCollection: vscode.DiagnosticCollection;

// Debounced functions (initialized in activate)
let debouncedValidation: ReturnType<typeof debounce<(doc: vscode.TextDocument) => void>>;
let debouncedDecoration: ReturnType<typeof debounce<(editor: vscode.TextEditor) => void>>;

export function activate(context: vscode.ExtensionContext): void {
  // Initialize configuration manager
  configManager.initialize(context);

  // Initialize diagnostics collection
  diagnosticCollection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_COLLECTION_NAME);
  context.subscriptions.push(diagnosticCollection);

  // Initialize decorations
  activateDecorations(context);

  // Create debounced functions
  debouncedValidation = debounce((doc: vscode.TextDocument) => {
    triggerValidation(doc);
  }, VALIDATION_DEBOUNCE_MS);

  debouncedDecoration = debounce((editor: vscode.TextEditor) => {
    updateDecorations(editor);
  }, DECORATION_DEBOUNCE_MS);

  // Register command: Manual fold
  const foldCommand = vscode.commands.registerCommand(COMMANDS.FOLD_NOW, handleManualFold);

  // Event: Document opened
  const onOpen = vscode.workspace.onDidOpenTextDocument((doc) => {
    if (isSupportedLanguage(doc.languageId)) {
      triggerValidation(doc);
    }
  });

  // Event: Document changed
  const onChange = vscode.workspace.onDidChangeTextDocument((e) => {
    const doc = e.document;
    if (!isSupportedLanguage(doc.languageId)) {
      return;
    }

    // Debounced validation
    debouncedValidation(doc);

    // Debounced decoration update
    const editor = vscode.window.activeTextEditor;
    if (editor?.document === doc) {
      debouncedDecoration(editor);
    }
  });

  // Event: Document closed (cleanup cache)
  const onClose = vscode.workspace.onDidCloseTextDocument((doc) => {
    clearBlocksCache(doc.uri.toString());
    diagnosticCollection.delete(doc.uri);
  });

  // Event: Active editor changed
  const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      handleActiveEditorChange(editor);
    }
  });

  context.subscriptions.push(foldCommand, onOpen, onChange, onClose, onEditorChange);

  // Initial processing for active editor
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && isSupportedLanguage(activeEditor.document.languageId)) {
    triggerValidation(activeEditor.document);
    updateDecorations(activeEditor);

    if (configManager.autoFold) {
      foldSwaggerBlocks(activeEditor).catch(console.error);
    }
  }
}

export function deactivate(): void {
  // Cancel pending debounced calls
  debouncedValidation?.cancel();
  debouncedDecoration?.cancel();

  // Clear cache
  clearBlocksCache();
}

async function handleManualFold(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await foldSwaggerBlocks(editor);
  }
}

async function handleActiveEditorChange(editor: vscode.TextEditor): Promise<void> {
  const doc = editor.document;

  if (!isSupportedLanguage(doc.languageId)) {
    return;
  }

  // Validate and update decorations
  triggerValidation(doc);
  updateDecorations(editor);

  // Auto-fold if enabled
  if (configManager.autoFold) {
    await foldSwaggerBlocks(editor);
  }
}

/**
 * Validates the document and updates diagnostics
 */
async function triggerValidation(document: vscode.TextDocument): Promise<void> {
  if (!isSupportedLanguage(document.languageId)) {
    return;
  }

  try {
    const blocks = findSwaggerBlocks(document);
    const diagnostics = await validateSwagger(blocks);
    diagnosticCollection.set(document.uri, diagnostics);
  } catch (error) {
    console.error('[JSDoc Swagger SmartFold] Validation error:', error);
  }
}

/**
 * Folds all detected Swagger blocks in the editor
 */
async function foldSwaggerBlocks(editor: vscode.TextEditor): Promise<void> {
  const document = editor.document;

  if (!isSupportedLanguage(document.languageId)) {
    return;
  }

  const blocks = findSwaggerBlocks(document);

  if (blocks.length === 0) {
    return;
  }

  // Create selections at the start of each block for folding
  const selections = blocks.map(
    (block) => new vscode.Selection(block.range.start, block.range.start),
  );

  // Preserve original selections
  const originalSelections = editor.selections;

  try {
    editor.selections = selections;
    await vscode.commands.executeCommand('editor.fold');
  } finally {
    // Restore original selections
    editor.selections = originalSelections;
  }
}
