import * as vscode from 'vscode';
import { findSwaggerBlocks, validateSwagger, clearBlocksCache, SwaggerBlock } from './swaggerUtils';
import { activateDecorations, updateDecorations } from './decorator';
import { activateCodeLens, SwaggerCodeLensProvider } from './codeLens';
import { activateHoverProvider } from './hoverProvider';
import { activateCodeActions } from './codeActions';
import { activateStatusBar, updateStatusBar, disposeStatusBar } from './statusBar';
import { exportCurrentFile, exportProject, copyBlockAsJson } from './exporter';
import { showSwaggerPreview, disposePreview } from './preview';
import {
  DIAGNOSTIC_COLLECTION_NAME,
  COMMANDS,
  isSupportedLanguage,
  configManager,
  isFileExcluded,
} from './constants';
import { debounce } from './utils';

// Debounce delay in milliseconds
const VALIDATION_DEBOUNCE_MS = 300;
const DECORATION_DEBOUNCE_MS = 150;

let diagnosticCollection: vscode.DiagnosticCollection;
let codeLensProvider: SwaggerCodeLensProvider;

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

  // Initialize CodeLens
  codeLensProvider = activateCodeLens(context);

  // Initialize Hover Provider
  activateHoverProvider(context);

  // Initialize Code Actions
  activateCodeActions(context);

  // Initialize Status Bar
  activateStatusBar(context);

  // Create debounced functions
  debouncedValidation = debounce((doc: vscode.TextDocument) => {
    triggerValidation(doc);
  }, VALIDATION_DEBOUNCE_MS);

  debouncedDecoration = debounce((editor: vscode.TextEditor) => {
    updateDecorations(editor);
  }, DECORATION_DEBOUNCE_MS);

  // Register commands
  const commands = [
    // Fold command
    vscode.commands.registerCommand(COMMANDS.FOLD_NOW, handleManualFold),

    // Unfold command
    vscode.commands.registerCommand(COMMANDS.UNFOLD_NOW, handleManualUnfold),

    // Toggle fold at cursor
    vscode.commands.registerCommand(COMMANDS.TOGGLE_FOLD, handleToggleFold),

    // Navigation commands
    vscode.commands.registerCommand(COMMANDS.NEXT_BLOCK, handleNextBlock),
    vscode.commands.registerCommand(COMMANDS.PREVIOUS_BLOCK, handlePreviousBlock),

    // Export commands
    vscode.commands.registerCommand(COMMANDS.EXPORT_FILE, exportCurrentFile),
    vscode.commands.registerCommand(COMMANDS.EXPORT_PROJECT, exportProject),
    vscode.commands.registerCommand(COMMANDS.COPY_AS_JSON, (block?: SwaggerBlock) =>
      copyBlockAsJson(block),
    ),

    // Preview command
    vscode.commands.registerCommand(COMMANDS.PREVIEW, () => showSwaggerPreview(context)),
  ];

  // Event: Document opened
  const onOpen = vscode.workspace.onDidOpenTextDocument((doc) => {
    if (shouldProcessDocument(doc)) {
      triggerValidation(doc);
    }
  });

  // Event: Document changed
  const onChange = vscode.workspace.onDidChangeTextDocument((e) => {
    const doc = e.document;
    if (!shouldProcessDocument(doc)) {
      return;
    }

    // Debounced validation
    debouncedValidation(doc);

    // Debounced decoration update
    const editor = vscode.window.activeTextEditor;
    if (editor?.document === doc) {
      debouncedDecoration(editor);
    }

    // Update status bar
    updateStatusBar();

    // Refresh CodeLens
    codeLensProvider.refresh();
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

  context.subscriptions.push(...commands, onOpen, onChange, onClose, onEditorChange);

  // Initial processing for active editor
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && shouldProcessDocument(activeEditor.document)) {
    triggerValidation(activeEditor.document);
    updateDecorations(activeEditor);
    updateStatusBar();

    if (configManager.autoFold) {
      foldSwaggerBlocks(activeEditor).catch(console.error);
    }
  }
}

export function deactivate(): void {
  // Cancel pending debounced calls
  debouncedValidation?.cancel();
  debouncedDecoration?.cancel();

  // Dispose status bar
  disposeStatusBar();

  // Dispose preview
  disposePreview();

  // Clear cache
  clearBlocksCache();
}

/**
 * Check if document should be processed (language supported and not excluded)
 */
function shouldProcessDocument(doc: vscode.TextDocument): boolean {
  if (!isSupportedLanguage(doc.languageId)) {
    return false;
  }

  const excludePatterns = configManager.exclude;
  if (excludePatterns.length > 0 && isFileExcluded(doc.uri.fsPath, excludePatterns)) {
    return false;
  }

  return true;
}

async function handleManualFold(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    await foldSwaggerBlocks(editor);
  }
}

async function handleManualUnfold(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  if (!shouldProcessDocument(document)) {
    return;
  }

  const blocks = findSwaggerBlocks(document);
  if (blocks.length === 0) {
    return;
  }

  // Create selections at the start of each block for unfolding
  const selections = blocks.map(
    (block) => new vscode.Selection(block.range.start, block.range.start),
  );

  const originalSelections = editor.selections;

  try {
    editor.selections = selections;
    await vscode.commands.executeCommand('editor.unfold');
  } finally {
    editor.selections = originalSelections;
  }
}

async function handleToggleFold(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  if (!shouldProcessDocument(document)) {
    return;
  }

  const position = editor.selection.active;
  const blocks = findSwaggerBlocks(document);
  const blockAtCursor = blocks.find((b) => b.range.contains(position));

  if (!blockAtCursor) {
    vscode.window.showInformationMessage('Cursor is not inside a Swagger block');
    return;
  }

  const originalSelections = editor.selections;

  try {
    editor.selection = new vscode.Selection(blockAtCursor.range.start, blockAtCursor.range.start);
    await vscode.commands.executeCommand('editor.toggleFold');
  } finally {
    editor.selections = originalSelections;
  }
}

async function handleNextBlock(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  if (!shouldProcessDocument(document)) {
    return;
  }

  const position = editor.selection.active;
  const blocks = findSwaggerBlocks(document);

  if (blocks.length === 0) {
    vscode.window.showInformationMessage('No Swagger blocks found');
    return;
  }

  // Find next block after current position
  const nextBlock = blocks.find((b) => b.range.start.line > position.line);

  if (nextBlock) {
    const newPosition = new vscode.Position(nextBlock.range.start.line, 0);
    editor.selection = new vscode.Selection(newPosition, newPosition);
    editor.revealRange(nextBlock.range, vscode.TextEditorRevealType.InCenter);
  } else {
    // Wrap to first block
    const firstBlock = blocks[0];
    const newPosition = new vscode.Position(firstBlock.range.start.line, 0);
    editor.selection = new vscode.Selection(newPosition, newPosition);
    editor.revealRange(firstBlock.range, vscode.TextEditorRevealType.InCenter);
  }
}

async function handlePreviousBlock(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  if (!shouldProcessDocument(document)) {
    return;
  }

  const position = editor.selection.active;
  const blocks = findSwaggerBlocks(document);

  if (blocks.length === 0) {
    vscode.window.showInformationMessage('No Swagger blocks found');
    return;
  }

  // Find previous block before current position
  const previousBlocks = blocks.filter((b) => b.range.start.line < position.line);
  const previousBlock = previousBlocks[previousBlocks.length - 1];

  if (previousBlock) {
    const newPosition = new vscode.Position(previousBlock.range.start.line, 0);
    editor.selection = new vscode.Selection(newPosition, newPosition);
    editor.revealRange(previousBlock.range, vscode.TextEditorRevealType.InCenter);
  } else {
    // Wrap to last block
    const lastBlock = blocks[blocks.length - 1];
    const newPosition = new vscode.Position(lastBlock.range.start.line, 0);
    editor.selection = new vscode.Selection(newPosition, newPosition);
    editor.revealRange(lastBlock.range, vscode.TextEditorRevealType.InCenter);
  }
}

async function handleActiveEditorChange(editor: vscode.TextEditor): Promise<void> {
  const doc = editor.document;

  if (!shouldProcessDocument(doc)) {
    return;
  }

  // Validate and update decorations
  triggerValidation(doc);
  updateDecorations(editor);
  updateStatusBar();

  // Auto-fold if enabled
  if (configManager.autoFold) {
    await foldSwaggerBlocks(editor);
  }
}

/**
 * Validates the document and updates diagnostics
 */
async function triggerValidation(document: vscode.TextDocument): Promise<void> {
  if (!shouldProcessDocument(document)) {
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

  if (!shouldProcessDocument(document)) {
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
