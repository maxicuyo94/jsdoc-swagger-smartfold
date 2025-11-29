import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { findSwaggerBlocks, parseYamlContent, SwaggerBlock } from './swaggerUtils';
import { isSupportedLanguage, configManager } from './constants';

interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    responses?: Record<string, unknown>;
  };
  tags?: Array<{ name: string; description?: string }>;
}

/**
 * Export all swagger blocks from current file to a single OpenAPI document
 */
export async function exportCurrentFile(): Promise<void> {
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

  const openApiDoc = mergeBlocksToOpenApi(blocks, path.basename(document.fileName));
  await saveOpenApiDocument(openApiDoc, document.fileName);
}

/**
 * Export all swagger blocks from entire project
 */
export async function exportProject(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage('No workspace folder open');
    return;
  }

  // Find all supported files
  const pattern = '**/*.{js,ts,jsx,tsx,vue,svelte}';
  const excludePattern = '**/node_modules/**';

  const files = await vscode.workspace.findFiles(pattern, excludePattern);

  if (files.length === 0) {
    vscode.window.showInformationMessage('No supported files found');
    return;
  }

  const allBlocks: SwaggerBlock[] = [];

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Scanning files for Swagger blocks...',
      cancellable: true,
    },
    async (progress, token) => {
      for (let i = 0; i < files.length; i++) {
        if (token.isCancellationRequested) {
          return;
        }

        progress.report({
          increment: 100 / files.length,
          message: `${i + 1}/${files.length} files`,
        });

        try {
          const document = await vscode.workspace.openTextDocument(files[i]);
          if (isSupportedLanguage(document.languageId)) {
            const blocks = findSwaggerBlocks(document);
            allBlocks.push(...blocks);
          }
        } catch {
          // Skip files that can't be opened
        }
      }
    },
  );

  if (allBlocks.length === 0) {
    vscode.window.showInformationMessage('No Swagger blocks found in project');
    return;
  }

  const projectName = workspaceFolders[0].name;
  const openApiDoc = mergeBlocksToOpenApi(allBlocks, projectName);
  await saveOpenApiDocument(openApiDoc, workspaceFolders[0].uri.fsPath);
}

/**
 * Merge multiple swagger blocks into a single OpenAPI document
 */
function mergeBlocksToOpenApi(blocks: SwaggerBlock[], title: string): OpenApiDocument {
  const paths: Record<string, unknown> = {};
  const schemas: Record<string, unknown> = {};
  const tagsSet = new Set<string>();

  for (const block of blocks) {
    const parsed = parseYamlContent(block.yamlContent);
    if (!parsed) {
      continue;
    }

    // Merge paths
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('/')) {
        // Path definition
        if (paths[key]) {
          // Merge methods
          paths[key] = { ...(paths[key] as object), ...(value as object) };
        } else {
          paths[key] = value;
        }

        // Collect tags
        if (typeof value === 'object' && value !== null) {
          for (const method of Object.values(value as Record<string, unknown>)) {
            if (typeof method === 'object' && method !== null) {
              const methodDef = method as Record<string, unknown>;
              if (Array.isArray(methodDef.tags)) {
                methodDef.tags.forEach((tag: string) => tagsSet.add(tag));
              }
            }
          }
        }
      } else if (key === 'components') {
        // Merge components
        const components = value as Record<string, unknown>;
        if (components.schemas) {
          Object.assign(schemas, components.schemas);
        }
      }
    }
  }

  const doc: OpenApiDocument = {
    openapi: '3.0.3',
    info: {
      title: `${title} API`,
      version: '1.0.0',
      description: `API documentation generated from ${blocks.length} Swagger blocks`,
    },
    paths,
  };

  // Add components if any schemas were found
  if (Object.keys(schemas).length > 0) {
    doc.components = { schemas };
  }

  // Add tags
  if (tagsSet.size > 0) {
    doc.tags = Array.from(tagsSet).map((name) => ({ name }));
  }

  return doc;
}

/**
 * Save OpenAPI document to file
 */
async function saveOpenApiDocument(doc: OpenApiDocument, basePath: string): Promise<void> {
  const format = configManager.exportFormat;
  const ext = format === 'json' ? 'json' : 'yaml';

  // Ask user for save location
  const defaultUri = vscode.Uri.file(path.join(path.dirname(basePath), `openapi.${ext}`));

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: {
      'OpenAPI files': [ext],
      'All files': ['*'],
    },
    title: 'Save OpenAPI Document',
  });

  if (!saveUri) {
    return;
  }

  let content: string;
  if (format === 'json') {
    content = JSON.stringify(doc, null, 2);
  } else {
    content = yaml.dump(doc, { indent: 2, lineWidth: -1 });
  }

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(saveUri, encoder.encode(content));

  const openDoc = await vscode.window.showInformationMessage(
    `OpenAPI document saved to ${saveUri.fsPath}`,
    'Open File',
  );

  if (openDoc === 'Open File') {
    const document = await vscode.workspace.openTextDocument(saveUri);
    await vscode.window.showTextDocument(document);
  }
}

/**
 * Copy current block as JSON to clipboard
 */
export async function copyBlockAsJson(block?: SwaggerBlock): Promise<void> {
  let targetBlock = block;

  if (!targetBlock) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    const document = editor.document;
    const position = editor.selection.active;
    const blocks = findSwaggerBlocks(document);
    targetBlock = blocks.find((b) => b.range.contains(position));

    if (!targetBlock) {
      vscode.window.showWarningMessage('Cursor is not inside a Swagger block');
      return;
    }
  }

  const parsed = parseYamlContent(targetBlock.yamlContent);
  if (!parsed) {
    vscode.window.showErrorMessage('Failed to parse YAML content');
    return;
  }

  const json = JSON.stringify(parsed, null, 2);
  await vscode.env.clipboard.writeText(json);
  vscode.window.showInformationMessage('Swagger block copied as JSON');
}
