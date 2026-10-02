import * as vscode from 'vscode';
import { findSwaggerBlocks, validateSwagger, clearBlocksCache, SwaggerBlock } from './swaggerUtils';
import { activateDecorations, updateDecorations } from './decorator';
import { activateCodeLens, SwaggerCodeLensProvider } from './codeLens';
import { activateHoverProvider } from './hoverProvider';
import { activateCodeActions, findOperationAt } from './codeActions';
import { buildAddTagsChange, listOperations, OperationRef } from './swaggerEdits';
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

// Debounce delay in milliseconds (fallbacks if config not available)
const DEFAULT_VALIDATION_DEBOUNCE_MS = 300;
const DECORATION_DEBOUNCE_MS = 150;

let diagnosticCollection: vscode.DiagnosticCollection;
let codeLensProvider: SwaggerCodeLensProvider;

// Debounced functions (initialized in activate)
let debouncedValidation: ReturnType<typeof debounce<(doc: vscode.TextDocument) => void>>;
let debouncedDecoration: ReturnType<typeof debounce<(editor: vscode.TextEditor) => void>>;
let debouncedStatusBar: ReturnType<typeof debounce<() => void>>;
let debouncedCodeLensRefresh: ReturnType<typeof debounce<() => void>>;

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

  // Create debounced functions (use autoFoldDelay config for validation debounce)
  const validationDelay = configManager.autoFoldDelay || DEFAULT_VALIDATION_DEBOUNCE_MS;
  debouncedValidation = debounce((doc: vscode.TextDocument) => {
    triggerValidation(doc);
  }, validationDelay);

  debouncedDecoration = debounce((editor: vscode.TextEditor) => {
    updateDecorations(editor);
  }, DECORATION_DEBOUNCE_MS);

  debouncedStatusBar = debounce(() => {
    updateStatusBar();
  }, DECORATION_DEBOUNCE_MS);

  debouncedCodeLensRefresh = debounce(() => {
    codeLensProvider.refresh();
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

    // Add tags command
    vscode.commands.registerCommand(
      COMMANDS.ADD_TAGS,
      async (uri?: vscode.Uri, position?: vscode.Position) => {
        await handleAddTags(uri, position);
      },
    ),
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

    // Debounced status bar update
    debouncedStatusBar();

    // Debounced CodeLens refresh
    debouncedCodeLensRefresh();
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
  debouncedStatusBar?.cancel();
  debouncedCodeLensRefresh?.cancel();

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

async function handleToggleFold(block?: SwaggerBlock): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  if (!shouldProcessDocument(document)) {
    return;
  }

  let targetBlock = block;

  // If no block provided, find the block at cursor position
  if (!targetBlock) {
    const position = editor.selection.active;
    const blocks = findSwaggerBlocks(document);
    targetBlock = blocks.find((b) => b.range.contains(position));

    if (!targetBlock) {
      vscode.window.showInformationMessage('Cursor is not inside a Swagger block');
      return;
    }
  }

  const originalSelections = editor.selections;

  try {
    editor.selection = new vscode.Selection(targetBlock.range.start, targetBlock.range.start);
    await vscode.commands.executeCommand('editor.toggleFold');
  } finally {
    editor.selections = originalSelections;
  }
}

function handleNextBlock(): void {
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

function handlePreviousBlock(): void {
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

/**
 * Adds tags to the operation at `position` (or the cursor when invoked from
 * the command palette), asking which operation to use when it is ambiguous.
 */
async function handleAddTags(uri?: vscode.Uri, position?: vscode.Position): Promise<void> {
  const editor = uri
    ? await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri))
    : vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  const target = position ?? editor.selection.active;
  const block = findSwaggerBlocks(document).find((b) => b.range.contains(target));
  if (!block) {
    vscode.window.showInformationMessage('Cursor is not inside a Swagger block');
    return;
  }

  const operation = await pickOperation(listOperations(block), target.line);
  if (!operation) {
    return;
  }

  const tagsInput = await vscode.window.showInputBox({
    prompt: `Tags for ${operation.method.toUpperCase()} ${operation.path} (comma separated)`,
    placeHolder: 'Users, Authentication, API',
    validateInput: (value) => (value.trim().length === 0 ? 'Please enter at least one tag' : null),
  });
  if (!tagsInput) {
    return; // User cancelled
  }

  const tags = tagsInput
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  // The document may have changed while the input box was open
  const currentBlock = findSwaggerBlocks(document).find((b) =>
    b.range.contains(new vscode.Position(operation.line, 0)),
  );
  const change =
    currentBlock &&
    buildAddTagsChange(document, currentBlock, operation.path, operation.method, tags);
  if (!change) {
    vscode.window.showInformationMessage('All those tags are already present');
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, change.range, change.newText);
  if (await vscode.workspace.applyEdit(edit)) {
    vscode.window.showInformationMessage(`Added tags: ${tags.join(', ')}`);
  } else {
    vscode.window.showErrorMessage('Failed to add tags');
  }
}

async function pickOperation(
  operations: OperationRef[],
  line: number,
): Promise<OperationRef | undefined> {
  if (operations.length === 0) {
    vscode.window.showWarningMessage('No operations found in this Swagger block');
    return undefined;
  }

  const atCursor = findOperationAt(operations, line);
  if (atCursor || operations.length === 1) {
    return atCursor ?? operations[0];
  }

  const picked = await vscode.window.showQuickPick(
    operations.map((op) => ({ label: `${op.method.toUpperCase()} ${op.path}`, op })),
    { placeHolder: 'Select the operation to tag' },
  );
  return picked?.op;
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
