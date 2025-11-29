import * as vscode from 'vscode';
import { findSwaggerBlocks, parseYamlContent } from './swaggerUtils';
import { isSupportedLanguage } from './constants';

let previewPanel: vscode.WebviewPanel | undefined;

/**
 * Show Swagger UI preview for current file's swagger blocks
 */
export async function showSwaggerPreview(_context: vscode.ExtensionContext): Promise<void> {
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

  const spec: Record<string, unknown> = {
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
      },
    );

    previewPanel.onDidDispose(() => {
      previewPanel = undefined;
    });
  }

  previewPanel.webview.html = getSwaggerUIHtml(spec);
}

/**
 * Generate HTML with embedded Swagger UI
 */
function getSwaggerUIHtml(spec: object): string {
  const specJson = JSON.stringify(spec);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Swagger Preview</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
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
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    const spec = ${specJson};
    
    if (Object.keys(spec.paths || {}).length === 0) {
      document.getElementById('swagger-ui').innerHTML = '<div class="no-endpoints">No endpoints found in Swagger blocks</div>';
    } else {
      SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
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
        tryItOutEnabled: false
      });
    }
  </script>
</body>
</html>`;
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
