import * as vscode from 'vscode';
import { findSwaggerBlocks, parseYamlContent } from './swaggerUtils';
import { isSupportedLanguage, configManager, isFileExcluded } from './constants';

let previewPanel: vscode.WebviewPanel | undefined;

/**
 * Escapes special characters for safe JSON embedding in HTML
 * Prevents XSS by escaping characters that could break out of script context
 */
function escapeJsonForHtml(json: string): string {
  return json
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/</g, '\\u003c') // Escape < to prevent </script> injection
    .replace(/>/g, '\\u003e') // Escape >
    .replace(/&/g, '\\u0026') // Escape &
    .replace(/'/g, '\\u0027') // Escape single quotes
    .replace(/"/g, '\\u0022') // Escape double quotes (will be within template literal)
    .replace(/\u2028/g, '\\u2028') // Line separator
    .replace(/\u2029/g, '\\u2029'); // Paragraph separator
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

  // Merge blocks into OpenAPI spec
  const paths: Record<string, unknown> = {};
  const components: Record<string, unknown> = {};
  const tags: unknown[] = [];
  const servers: unknown[] = [];
  const security: unknown[] = [];
  let externalDocs: unknown = undefined;

  for (const block of blocks) {
    const parsed = parseYamlContent(block.yamlContent);
    if (parsed) {
      for (const [key, value] of Object.entries(parsed)) {
        if (key.startsWith('/')) {
          // Path definition
          if (paths[key]) {
            paths[key] = { ...(paths[key] as object), ...(value as object) };
          } else {
            paths[key] = value;
          }
        } else if (key === 'components' && typeof value === 'object' && value !== null) {
          // Merge components (schemas, responses, parameters, etc.)
          for (const [compKey, compValue] of Object.entries(value as Record<string, unknown>)) {
            if (components[compKey] && typeof components[compKey] === 'object') {
              components[compKey] = {
                ...(components[compKey] as object),
                ...(compValue as object),
              };
            } else {
              components[compKey] = compValue;
            }
          }
        } else if (key === 'tags' && Array.isArray(value)) {
          tags.push(...value);
        } else if (key === 'servers' && Array.isArray(value)) {
          servers.push(...value);
        } else if (key === 'security' && Array.isArray(value)) {
          security.push(...value);
        } else if (key === 'externalDocs') {
          externalDocs = value;
        }
      }
    }
  }

  let spec: Record<string, unknown> = {
    openapi: '3.0.3',
    info: {
      title: `${document.fileName.split(/[\\/]/).pop()} API`,
      version: '1.0.0',
    },
    paths,
  };

  // Add optional root-level properties if they exist
  if (Object.keys(components).length > 0) {
    spec.components = components;
  }
  if (tags.length > 0) {
    spec.tags = tags;
  }
  if (servers.length > 0) {
    spec.servers = servers;
  }
  if (security.length > 0) {
    spec.security = security;
  }
  if (externalDocs) {
    spec.externalDocs = externalDocs;
  }

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

  // Serialize spec safely
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
  <script nonce="${nonce}" src="${swaggerJsUri}"></script>
  <script nonce="${nonce}">
    (function() {
      'use strict';
      
      // Parse the safely serialized spec
      const specJson = '${specJson}';
      let spec;
      
      try {
        spec = JSON.parse(specJson.replace(/\\\\u003c/g, '<').replace(/\\\\u003e/g, '>').replace(/\\\\u0026/g, '&').replace(/\\\\u0027/g, "'").replace(/\\\\u0022/g, '"'));
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
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
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
