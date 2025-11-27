import * as vscode from 'vscode';
import { findSwaggerBlocks, validateSwagger } from './swaggerUtils';
import { activateDecorations, updateDecorations } from './decorator';

const JSDOC_SWAGGER_DIAGNOSTICS = 'jsdoc-swagger';
const SWAGGER_FOLD_COMMAND = 'swaggerFold.foldNow';
const CONFIG_SECTION = 'swaggerFold';
const AUTO_FOLD_SETTING = 'autoFold';
const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'javascriptreact',
  'typescriptreact',
]);

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  // Initialize Diagnostics
  diagnosticCollection = vscode.languages.createDiagnosticCollection(JSDOC_SWAGGER_DIAGNOSTICS);
  context.subscriptions.push(diagnosticCollection);

  // Initialize Decorations
  activateDecorations(context);

  // Register Command: Manual Fold
  const foldCommand = vscode.commands.registerCommand(SWAGGER_FOLD_COMMAND, handleManualFold);

  // Event: Document Open / Changed (Validation)
  const onOpen = vscode.workspace.onDidOpenTextDocument(triggerValidation);
  const onChange = vscode.workspace.onDidChangeTextDocument((e) => {
    triggerValidation(e.document);
    if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
      updateDecorations(vscode.window.activeTextEditor);
    }
  });

  // Event: Editor Changed (Auto Fold)
  const onEditorChange = vscode.window.onDidChangeActiveTextEditor((editor) => {
    handleActiveEditorChange(editor);
    if (editor) {
      updateDecorations(editor);
    }
  });

  context.subscriptions.push(diagnosticCollection, foldCommand, onOpen, onChange, onEditorChange);

  // Initial check for active editor on activation
  if (vscode.window.activeTextEditor) {
    const editor = vscode.window.activeTextEditor;
    triggerValidation(editor.document);
    updateDecorations(editor);
    if (shouldAutoFold()) {
      // We handle the promise rejection internally or ignore it as it's fire-and-forget
      foldSwaggerBlocks(editor).catch((err) => console.error(err));
    }
  }
}

export function deactivate() {
  // Resources are disposed by subscriptions
}

async function handleManualFold() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await foldSwaggerBlocks(editor);
  }
}

async function handleActiveEditorChange(editor: vscode.TextEditor | undefined) {
  if (editor) {
    // Validate
    triggerValidation(editor.document);
    // Auto Fold if enabled
    if (shouldAutoFold()) {
      await foldSwaggerBlocks(editor);
    }
  }
}

/**
 * Checks configuration for auto-fold
 */
function shouldAutoFold(): boolean {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<boolean>(AUTO_FOLD_SETTING, true);
}

/**
 * Validates the document and updates diagnostics
 */
async function triggerValidation(document: vscode.TextDocument) {
  if (!isValidLanguage(document.languageId)) {
    return;
  }

  try {
    const blocks = findSwaggerBlocks(document);
    const diagnostics = await validateSwagger(blocks);
    diagnosticCollection.set(document.uri, diagnostics);
  } catch (error) {
    console.error('Error validating Swagger blocks:', error);
  }
}

/**
 * Folds all detected Swagger blocks in the editor
 */
async function foldSwaggerBlocks(editor: vscode.TextEditor) {
  const document = editor.document;
  if (!isValidLanguage(document.languageId)) {
    return;
  }

  const blocks = findSwaggerBlocks(document);
  if (blocks.length === 0) {
    return;
  }

  // To fold, we need to set the selection to the start of each block
  // and execute 'editor.fold'.
  // However, 'editor.fold' folds the current selection's region.
  // If we have multiple blocks, we can try to set multiple selections.

  const selections = blocks.map((block) => {
    // We fold the whole block. Selection at the start line is enough for 'editor.fold'
    // usually to pick up the block.
    return new vscode.Selection(block.range.start, block.range.start);
  });

  // Preserve original selections (plural to handle multiple cursors)
  const originalSelections = editor.selections;

  try {
    editor.selections = selections;

    // Execute fold command
    // 'editor.fold' folds the innermost uncollapsed region at the cursor.
    // If we select the start of JSDoc (/**), it should fold the comment.
    await vscode.commands.executeCommand('editor.fold');
  } finally {
    // Restore original selections
    // Note: If the original selection was inside a now-folded region,
    // VS Code might adjust it, but we try our best.
    editor.selections = originalSelections;
  }
}

function isValidLanguage(languageId: string): boolean {
  return SUPPORTED_LANGUAGES.has(languageId);
}
