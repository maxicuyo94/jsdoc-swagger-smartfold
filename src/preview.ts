import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { findSwaggerBlocks, mergeBlocksToOpenApi } from './swaggerUtils';
import { isSupportedLanguage, configManager, isFileExcluded } from './constants';

let previewPanel: vscode.WebviewPanel | undefined;

/**
 * Escapes JSON for safe embedding inside a <script type="application/json"> tag.
 * Only need to prevent "</script>" from appearing in the content.
 */
function escapeJsonForHtml(json: string): string {
  return json.replace(/<\//g, '<\\/');
}

/**
 * Sanitizes a spec object by removing potentially dangerous properties
 */
function sanitizeSpec(spec: Record<string, unknown>): Record<string, unknown> {
  const sanitized = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;

  // Remove any javascript: URLs or dangerous content
  const sanitizeValue = (obj: unknown): unknown => {
    if (typeof obj === 'string') {
      // Remove javascript: and data: URLs
      if (/^(javascript|data|vbscript):/i.test(obj.trim())) {
        return '';
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeValue);
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip __proto__ and constructor to prevent prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        result[key] = sanitizeValue(value);
      }
      return result;
    }
    return obj;
  };

  return sanitizeValue(sanitized) as Record<string, unknown>;
}

/**
 * Show Swagger UI preview for current file's swagger blocks
 */
export async function showSwaggerPreview(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const document = editor.document;
  if (!isSupportedLanguage(document.languageId)) {
    vscode.window.showWarningMessage('Current file is not a supported language');
    return;
  }

  const excludePatterns = configManager.exclude;
  if (excludePatterns.length > 0 && isFileExcluded(document.uri.fsPath, excludePatterns)) {
    vscode.window.showInformationMessage('Current file is excluded by swaggerFold.exclude');
    return;
  }

  const blocks = findSwaggerBlocks(document);
  if (blocks.length === 0) {
    vscode.window.showInformationMessage('No Swagger blocks found in current file');
    return;
  }

  // Merge blocks into OpenAPI spec using shared logic
  const fileName = document.fileName.split(/[\\/]/).pop() ?? 'Untitled';
  let spec: Record<string, unknown> = mergeBlocksToOpenApi(blocks, fileName);

  // Sanitize the spec to prevent XSS
  spec = sanitizeSpec(spec);

  // Create or reveal panel
  if (previewPanel) {
    previewPanel.reveal(vscode.ViewColumn.Beside);
  } else {
    previewPanel = vscode.window.createWebviewPanel(
      'swaggerPreview',
      'Swagger Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        // Restrict webview to only load resources from extension's media folder
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      },
    );

    previewPanel.onDidDispose(() => {
      previewPanel = undefined;
    });
  }

  previewPanel.webview.html = getSwaggerUIHtml(previewPanel.webview, context.extensionUri, spec);
}

/**
 * Get URI for a media resource
 */
function getMediaUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  fileName: string,
): vscode.Uri {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', fileName));
}

/**
 * Generate HTML with embedded Swagger UI - secured version
 */
function getSwaggerUIHtml(webview: vscode.Webview, extensionUri: vscode.Uri, spec: object): string {
  // Get URIs for local resources
  const swaggerCssUri = getMediaUri(webview, extensionUri, 'swagger-ui.css');
  const swaggerJsUri = getMediaUri(webview, extensionUri, 'swagger-ui-bundle.js');

  // Generate nonce for inline scripts (CSP requirement)
  const nonce = getNonce();

  // Serialize spec safely for embedding in application/json script tag
  const specJson = escapeJsonForHtml(JSON.stringify(spec));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}';
    img-src ${webview.cspSource} data: https:;
    font-src ${webview.cspSource};
  ">
  <title>Swagger Preview</title>
  <link rel="stylesheet" type="text/css" href="${swaggerCssUri}">
  <style nonce="${nonce}">
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      background: var(--vscode-editor-background, #1e1e1e);
    }
    #swagger-ui {
      height: 100%;
    }
    .swagger-ui {
      background: var(--vscode-editor-background, #1e1e1e);
    }
    .swagger-ui .topbar {
      display: none;
    }
    .swagger-ui .info {
      margin: 20px 0;
    }
    .swagger-ui .scheme-container {
      background: transparent;
      box-shadow: none;
    }
    /* Dark theme adjustments */
    .swagger-ui .opblock-tag {
      color: var(--vscode-foreground, #d4d4d4);
      border-bottom-color: var(--vscode-panel-border, #444);
    }
    .swagger-ui .opblock .opblock-summary-description {
      color: var(--vscode-descriptionForeground, #9d9d9d);
    }
    .swagger-ui .opblock .opblock-section-header {
      background: var(--vscode-sideBar-background, #252526);
    }
    .swagger-ui .opblock .opblock-section-header h4 {
      color: var(--vscode-foreground, #d4d4d4);
    }
    .swagger-ui table thead tr td, 
    .swagger-ui table thead tr th {
      color: var(--vscode-foreground, #d4d4d4);
      border-color: var(--vscode-panel-border, #444);
    }
    .swagger-ui .parameter__name {
      color: var(--vscode-foreground, #d4d4d4);
    }
    .swagger-ui .parameter__type {
      color: var(--vscode-descriptionForeground, #9d9d9d);
    }
    .swagger-ui .response-col_status {
      color: var(--vscode-foreground, #d4d4d4);
    }
    .swagger-ui .response-col_description {
      color: var(--vscode-descriptionForeground, #9d9d9d);
    }
    .swagger-ui .model-title {
      color: var(--vscode-foreground, #d4d4d4);
    }
    .swagger-ui section.models {
      border-color: var(--vscode-panel-border, #444);
    }
    .swagger-ui section.models h4 {
      color: var(--vscode-foreground, #d4d4d4);
    }
    .swagger-ui .model {
      color: var(--vscode-foreground, #d4d4d4);
    }
    .swagger-ui .info .title {
      color: var(--vscode-foreground, #d4d4d4);
    }
    .swagger-ui .info .description {
      color: var(--vscode-descriptionForeground, #9d9d9d);
    }
    /* No endpoints message */
    .no-endpoints {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--vscode-descriptionForeground, #9d9d9d);
      font-family: var(--vscode-font-family, sans-serif);
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script type="application/json" id="swagger-spec">${specJson}</script>
  <script nonce="${nonce}" src="${swaggerJsUri}"></script>
  <script nonce="${nonce}">
    (function() {
      'use strict';
      
      // Parse the spec from the application/json script tag (safe, no eval)
      let spec;
      try {
        spec = JSON.parse(document.getElementById('swagger-spec').textContent);
      } catch (e) {
        document.getElementById('swagger-ui').innerHTML = '<div class="no-endpoints">Error parsing spec: ' + e.message + '</div>';
        return;
      }
      
      if (!spec.paths || Object.keys(spec.paths).length === 0) {
        document.getElementById('swagger-ui').innerHTML = '<div class="no-endpoints">No endpoints found in Swagger blocks</div>';
      } else {
        SwaggerUIBundle({
          spec: spec,
          dom_id: '#swagger-ui',
          deepLinking: false, // Disabled for security
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIBundle.SwaggerUIStandalonePreset
          ],
          layout: "BaseLayout",
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 1,
          docExpansion: 'list',
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
          tryItOutEnabled: false, // Disabled - no external requests
          supportedSubmitMethods: [], // No submit methods allowed
          validatorUrl: null // Disable external validator
        });
      }
    })();
  </script>
</body>
</html>`;
}

/**
 * Generate a cryptographically secure nonce
 */
function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Dispose preview panel
 */
export function disposePreview(): void {
  if (previewPanel) {
    previewPanel.dispose();
    previewPanel = undefined;
  }
}
