import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';

export interface SwaggerBlock {
  range: vscode.Range;
  yamlContent: string;
  contentStartLine: number; // Relative to the document, line number where YAML starts
}

// Regex to match JSDoc blocks: /** ... */
// We use [\s\S]*? for non-greedy match across lines
const JS_DOC_REGEX = /\/\*\*([\s\S]*?)\*\//g;

/**
 * Finds all JSDoc blocks containing @swagger in the document.
 */
export function findSwaggerBlocks(document: vscode.TextDocument): SwaggerBlock[] {
  const text = document.getText();
  const blocks: SwaggerBlock[] = [];

  let match;
  while ((match = JS_DOC_REGEX.exec(text)) !== null) {
    const fullComment = match[0];
    const innerContent = match[1];
    const startIndex = match.index;

    // Check if @swagger is present
    if (!innerContent.includes('@swagger')) {
      continue;
    }

    const result = processCommentBlock(document, fullComment, startIndex);
    if (result) {
      blocks.push(result);
    }
  }

  return blocks;
}

function processCommentBlock(
  document: vscode.TextDocument,
  fullComment: string,
  startIndex: number,
): SwaggerBlock | null {
  const endIndex = startIndex + fullComment.length;
  const startPos = document.positionAt(startIndex);
  const endPos = document.positionAt(endIndex);
  const range = new vscode.Range(startPos, endPos);

  // Extract content after @swagger
  const lines = fullComment.split(/\r?\n/);
  const yamlLines: string[] = [];
  let swaggerFound = false;
  let yamlStartLineOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!swaggerFound) {
      if (line.includes('@swagger')) {
        swaggerFound = true;
        yamlStartLineOffset = i + 1;
      }
      continue;
    }

    let cleanLine = line;

    // Remove closing */ if it's the last line
    if (i === lines.length - 1) {
      cleanLine = cleanLine.replace(/\*\/$/, '');
    }

    // Remove leading whitespace and *
    cleanLine = cleanLine.replace(/^\s*\*\s?/, '');

    yamlLines.push(cleanLine);
  }

  const contentStartLine = startPos.line + yamlStartLineOffset;

  return {
    range,
    yamlContent: yamlLines.join('\n'),
    contentStartLine,
  };
}

/**
 * Validates YAML syntax and basic OpenAPI structure.
 */
export async function validateSwagger(blocks: SwaggerBlock[]): Promise<vscode.Diagnostic[]> {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const block of blocks) {
    const result = await validateBlock(block);
    if (result) {
      diagnostics.push(result);
    }
  }

  return diagnostics;
}

async function validateBlock(block: SwaggerBlock): Promise<vscode.Diagnostic | null> {
  // 1. Validate YAML Syntax
  let parsedYaml: unknown;
  try {
    parsedYaml = yaml.load(block.yamlContent);
  } catch (e: unknown) {
    const yamlError = e as { mark?: { line?: number }; message?: string };
    if (
      yamlError &&
      typeof yamlError === 'object' &&
      yamlError.mark &&
      typeof yamlError.mark === 'object'
    ) {
      const errorLine = block.contentStartLine + (yamlError.mark.line || 0);
      const range = new vscode.Range(errorLine, 0, errorLine, 100);
      const message = yamlError.message || 'Unknown YAML error';

      const diagnostic = new vscode.Diagnostic(
        range,
        `YAML Syntax Error: ${message}`,
        vscode.DiagnosticSeverity.Error,
      );
      diagnostic.source = 'JSDoc Swagger';
      return diagnostic;
    }
    return null;
  }

  // If empty or null, skip
  if (!parsedYaml) {
    return null;
  }

  // 2. Validate OpenAPI Structure
  const docToValidate = prepareOpenApiDoc(parsedYaml);

  if (!docToValidate) {
    const range = new vscode.Range(block.contentStartLine, 0, block.contentStartLine, 100);
    return new vscode.Diagnostic(
      range,
      'Swagger content must be an object (e.g. paths).',
      vscode.DiagnosticSeverity.Error,
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await SwaggerParser.validate(docToValidate as any);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid OpenAPI definition';
    const range = new vscode.Range(block.contentStartLine, 0, block.range.end.line, 0);

    const diagnostic = new vscode.Diagnostic(
      range,
      `OpenAPI Validation Error: ${message}`,
      vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = 'JSDoc Swagger';
    return diagnostic;
  }

  return null;
}

function prepareOpenApiDoc(parsedYaml: unknown): Record<string, unknown> | null {
  if (typeof parsedYaml !== 'object' || parsedYaml === null) {
    return null;
  }

  const doc = parsedYaml as Record<string, unknown>;

  if (doc.openapi || doc.swagger) {
    return doc;
  }

  // Wrap fragment
  return {
    openapi: '3.0.0',
    info: {
      title: 'Temp Validator',
      version: '1.0.0',
    },
    paths: parsedYaml,
  };
}
