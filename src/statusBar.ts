import * as vscode from 'vscode';
import { findSwaggerBlocks } from './swaggerUtils';
import { isSupportedLanguage, COMMANDS } from './constants';

let statusBarItem: vscode.StatusBarItem;

/**
 * Activate status bar item showing swagger block count
 */
export function activateStatusBar(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );

  statusBarItem.command = COMMANDS.FOLD_NOW;
  statusBarItem.tooltip = 'Click to fold all Swagger blocks';

  context.subscriptions.push(statusBarItem);

  // Update on editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateStatusBar();
    }),
  );

  // Update on document change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && e.document === editor.document) {
        updateStatusBar();
      }
    }),
  );

  // Initial update
  updateStatusBar();
}

/**
 * Update status bar with current swagger block count
 */
export function updateStatusBar(): void {
  const editor = vscode.window.activeTextEditor;

  if (!editor || !isSupportedLanguage(editor.document.languageId)) {
    statusBarItem.hide();
    return;
  }

  const blocks = findSwaggerBlocks(editor.document);
  const count = blocks.length;

  if (count === 0) {
    statusBarItem.hide();
    return;
  }

  statusBarItem.text = `$(symbol-interface) Swagger: ${count} block${count > 1 ? 's' : ''}`;
  statusBarItem.show();
}

/**
 * Dispose status bar item
 */
export function disposeStatusBar(): void {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}

