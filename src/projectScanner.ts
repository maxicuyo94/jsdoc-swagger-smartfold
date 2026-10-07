import * as vscode from 'vscode';
import { configManager, isFileExcluded } from './constants';
import { findSwaggerYamlInText } from './swaggerUtils';

// Source files that may contain Swagger blocks
const PROJECT_FILES_GLOB = '**/*.{js,ts,jsx,tsx,mjs,cjs,vue,svelte}';

// Dependencies, build output and type declarations: JSDoc comments survive
// compilation, so scanning these would duplicate every endpoint
const PROJECT_EXCLUDE_GLOB =
  '{**/node_modules/**,**/dist/**,**/out/**,**/build/**,**/coverage/**,' +
  '**/.next/**,**/.nuxt/**,**/.svelte-kit/**,**/*.d.ts,**/*.min.js}';

/**
 * Workspace files that may contain Swagger blocks, honoring `swaggerFold.exclude`.
 */
export async function findProjectFiles(): Promise<vscode.Uri[]> {
  const files = await vscode.workspace.findFiles(PROJECT_FILES_GLOB, PROJECT_EXCLUDE_GLOB);
  const excludePatterns = configManager.exclude;
  return excludePatterns.length === 0
    ? files
    : files.filter((file) => !isFileExcluded(file.fsPath, excludePatterns));
}

/**
 * YAML of every Swagger block in `files`. Unreadable files are skipped.
 */
export async function readSwaggerYaml(
  files: vscode.Uri[],
  onFile?: (index: number) => boolean | void,
): Promise<string[]> {
  const yamlContents: string[] = [];
  for (let i = 0; i < files.length; i++) {
    // The callback may return false to cancel the scan
    if (onFile?.(i) === false) {
      break;
    }
    try {
      yamlContents.push(...findSwaggerYamlInText(await readFileText(files[i])));
    } catch {
      // Skip files that can't be read
    }
  }
  return yamlContents;
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
