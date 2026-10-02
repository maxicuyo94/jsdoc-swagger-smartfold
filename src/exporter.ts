import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as path from 'path';
import {
  findSwaggerBlocks,
  findSwaggerYamlInText,
  parseYamlContent,
  SwaggerBlock,
  mergeBlocksToOpenApi,
  OpenApiDocument,
} from './swaggerUtils';
import { isSupportedLanguage, configManager, isFileExcluded } from './constants';

// Source files scanned by the project export
const PROJECT_FILES_GLOB = '**/*.{js,ts,jsx,tsx,mjs,cjs,vue,svelte}';

// Dependencies, build output and type declarations: JSDoc comments survive
// compilation, so scanning these would duplicate every endpoint
const PROJECT_EXCLUDE_GLOB =
  '{**/node_modules/**,**/dist/**,**/out/**,**/build/**,**/coverage/**,' +
  '**/.next/**,**/.nuxt/**,**/.svelte-kit/**,**/*.d.ts,**/*.min.js}';

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

  const openApiDoc = mergeBlocksToOpenApi(blocks, path.basename(document.fileName));
  await saveOpenApiDocument(openApiDoc, path.dirname(document.fileName));
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

  const excludePatterns = configManager.exclude;

  const files = await vscode.workspace.findFiles(PROJECT_FILES_GLOB, PROJECT_EXCLUDE_GLOB);

  const candidateFiles =
    excludePatterns.length === 0
      ? files
      : files.filter((file) => !isFileExcluded(file.fsPath, excludePatterns));

  if (candidateFiles.length === 0) {
    vscode.window.showInformationMessage('No supported files found');
    return;
  }

  const allBlocks: Array<Pick<SwaggerBlock, 'yamlContent'>> = [];

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Scanning files for Swagger blocks...',
      cancellable: true,
    },
    async (progress, token) => {
      for (let i = 0; i < candidateFiles.length; i++) {
        if (token.isCancellationRequested) {
          return;
        }

        progress.report({
          increment: 100 / candidateFiles.length,
          message: `${i + 1}/${candidateFiles.length} files`,
        });

        try {
          const text = await readFileText(candidateFiles[i]);
          allBlocks.push(...findSwaggerYamlInText(text).map((yamlContent) => ({ yamlContent })));
        } catch {
          // Skip files that can't be read
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
 * Reads a file's text, preferring the open (possibly unsaved) editor contents.
 * Avoids openTextDocument, which would fire open events (and validation) for
 * every file in the project.
 */
async function readFileText(uri: vscode.Uri): Promise<string> {
  const openDocument = vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === uri.toString(),
  );
  if (openDocument) {
    return openDocument.getText();
  }
  return new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri));
}

/**
 * Save OpenAPI document to file
 */
async function saveOpenApiDocument(doc: OpenApiDocument, defaultDir: string): Promise<void> {
  const format = configManager.exportFormat;
  const ext = format === 'json' ? 'json' : 'yaml';

  // Ask user for save location
  const defaultUri = vscode.Uri.file(path.join(defaultDir, `openapi.${ext}`));

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
