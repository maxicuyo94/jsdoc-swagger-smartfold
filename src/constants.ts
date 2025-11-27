import * as vscode from 'vscode';

// Extension identifiers
export const EXTENSION_ID = 'jsdoc-swagger-smartfold';
export const DIAGNOSTICS_SOURCE = 'JSDoc Swagger';
export const DIAGNOSTIC_COLLECTION_NAME = 'jsdoc-swagger';

// Commands
export const COMMANDS = {
  FOLD_NOW: 'swaggerFold.foldNow',
} as const;

// Configuration
export const CONFIG = {
  SECTION: 'swaggerFold',
  AUTO_FOLD: 'autoFold',
  HIGHLIGHT: 'highlight',
} as const;

// Supported languages
export const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'javascriptreact',
  'typescriptreact',
]);

/**
 * Check if a language is supported by this extension
 */
export function isSupportedLanguage(languageId: string): boolean {
  return SUPPORTED_LANGUAGES.has(languageId);
}

/**
 * Configuration reader with caching
 */
class ConfigManager {
  private cachedConfig: vscode.WorkspaceConfiguration | null = null;
  private disposable: vscode.Disposable | null = null;

  initialize(context: vscode.ExtensionContext): void {
    // Invalidate cache when configuration changes
    this.disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(CONFIG.SECTION)) {
        this.cachedConfig = null;
      }
    });
    context.subscriptions.push(this.disposable);
  }

  private getConfig(): vscode.WorkspaceConfiguration {
    this.cachedConfig ??= vscode.workspace.getConfiguration(CONFIG.SECTION);
    return this.cachedConfig;
  }

  get autoFold(): boolean {
    return this.getConfig().get<boolean>(CONFIG.AUTO_FOLD, true);
  }

  get highlight(): boolean {
    return this.getConfig().get<boolean>(CONFIG.HIGHLIGHT, true);
  }
}

export const configManager = new ConfigManager();
