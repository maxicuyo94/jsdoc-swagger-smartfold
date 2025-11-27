import * as vscode from 'vscode';
import * as path from 'path';

// Extension identifiers
export const EXTENSION_ID = 'jsdoc-swagger-smartfold';
export const DIAGNOSTICS_SOURCE = 'JSDoc Swagger';
export const DIAGNOSTIC_COLLECTION_NAME = 'jsdoc-swagger';

// Commands
export const COMMANDS = {
  FOLD_NOW: 'swaggerFold.foldNow',
  UNFOLD_NOW: 'swaggerFold.unfoldNow',
  NEXT_BLOCK: 'swaggerFold.nextBlock',
  PREVIOUS_BLOCK: 'swaggerFold.previousBlock',
  TOGGLE_FOLD: 'swaggerFold.toggleFold',
  EXPORT_FILE: 'swaggerFold.exportToFile',
  EXPORT_PROJECT: 'swaggerFold.exportProject',
  COPY_AS_JSON: 'swaggerFold.copyAsJson',
  PREVIEW: 'swaggerFold.preview',
} as const;

// Configuration
export const CONFIG = {
  SECTION: 'swaggerFold',
  AUTO_FOLD: 'autoFold',
  HIGHLIGHT: 'highlight',
  EXCLUDE: 'exclude',
  VALIDATION_SEVERITY: 'validationSeverity',
  AUTO_FOLD_DELAY: 'autoFoldDelay',
  EXPORT_FORMAT: 'exportFormat',
} as const;

// Swagger/OpenAPI tags to detect
export const SWAGGER_TAGS = ['@swagger', '@openapi'] as const;

// Supported languages
export const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'javascriptreact',
  'typescriptreact',
  'vue',
  'svelte',
]);

// HTTP Methods for display
export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

/**
 * Check if a language is supported by this extension
 */
export function isSupportedLanguage(languageId: string): boolean {
  return SUPPORTED_LANGUAGES.has(languageId);
}

/**
 * Check if a file should be excluded based on glob patterns
 */
export function isFileExcluded(filePath: string, excludePatterns: string[]): boolean {
  if (excludePatterns.length === 0) {
    return false;
  }

  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of excludePatterns) {
    // Simple glob matching for common patterns
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    const regex = new RegExp(regexPattern);
    if (regex.test(normalizedPath)) {
      return true;
    }
  }

  return false;
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

  get exclude(): string[] {
    return this.getConfig().get<string[]>(CONFIG.EXCLUDE, []);
  }

  get validationSeverity(): 'error' | 'warning' | 'info' {
    return this.getConfig().get<'error' | 'warning' | 'info'>(CONFIG.VALIDATION_SEVERITY, 'warning');
  }

  get autoFoldDelay(): number {
    return this.getConfig().get<number>(CONFIG.AUTO_FOLD_DELAY, 300);
  }

  get exportFormat(): 'yaml' | 'json' {
    return this.getConfig().get<'yaml' | 'json'>(CONFIG.EXPORT_FORMAT, 'yaml');
  }
}

export const configManager = new ConfigManager();
