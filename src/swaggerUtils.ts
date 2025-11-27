import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import { DIAGNOSTICS_SOURCE } from './constants';
import { DocumentCache } from './utils';

export interface SwaggerBlock {
  range: vscode.Range;
  yamlContent: string;
  /** Line number where YAML content starts (relative to document) */
  contentStartLine: number;
}

interface YamlError {
  mark?: { line?: number };
  message?: string;
}

// Pre-compiled regex for better performance
const JS_DOC_REGEX = /\/\*\*([\s\S]*?)\*\//g;
const SWAGGER_TAG = '@swagger';
const CLOSING_COMMENT_REGEX = /\*\/$/;
const LEADING_ASTERISK_REGEX = /^\s*\*\s?/;

// Cache for parsed blocks
const blocksCache = new DocumentCache<SwaggerBlock[]>(10);

/**
 * Finds all JSDoc blocks containing @swagger in the document.
 * Results are cached per document version for performance.
 */
export function findSwaggerBlocks(document: vscode.TextDocument): SwaggerBlock[] {
  const uri = document.uri.toString();
  const version = document.version;

  // Check cache first
  const cached = blocksCache.get(uri, version);
  if (cached) {
    return cached;
  }

  const text = document.getText();
  const blocks: SwaggerBlock[] = [];

  // Reset regex lastIndex for reuse
  JS_DOC_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = JS_DOC_REGEX.exec(text)) !== null) {
    const innerContent = match[1];

    // Quick check before expensive processing
    if (!innerContent.includes(SWAGGER_TAG)) {
      continue;
    }

    const block = processCommentBlock(document, match[0], match.index);
    if (block) {
      blocks.push(block);
    }
  }

  // Cache the result
  blocksCache.set(uri, version, blocks);

  return blocks;
}

/**
 * Clear cache for a specific document or all documents
 */
export function clearBlocksCache(uri?: string): void {
  if (uri) {
    blocksCache.delete(uri);
  } else {
    blocksCache.clear();
  }
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

  const lines = fullComment.split(/\r?\n/);
  const yamlLines: string[] = [];
  let swaggerFound = false;
  let yamlStartLineOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!swaggerFound) {
      if (line.includes(SWAGGER_TAG)) {
        swaggerFound = true;
        yamlStartLineOffset = i + 1;
      }
      continue;
    }

    let cleanLine = line;

    // Remove closing */ if it's the last line
    if (i === lines.length - 1) {
      cleanLine = cleanLine.replace(CLOSING_COMMENT_REGEX, '');
    }

    // Remove leading whitespace and asterisk
    cleanLine = cleanLine.replace(LEADING_ASTERISK_REGEX, '');

    yamlLines.push(cleanLine);
  }

  return {
    range,
    yamlContent: yamlLines.join('\n'),
    contentStartLine: startPos.line + yamlStartLineOffset,
  };
}

/**
 * Validates YAML syntax and basic OpenAPI structure for all blocks.
 */
export async function validateSwagger(blocks: SwaggerBlock[]): Promise<vscode.Diagnostic[]> {
  if (blocks.length === 0) {
    return [];
  }

  // Validate all blocks in parallel for better performance
  const results = await Promise.all(blocks.map(validateBlock));

  // Filter out null results
  return results.filter((d): d is vscode.Diagnostic => d !== null);
}

async function validateBlock(block: SwaggerBlock): Promise<vscode.Diagnostic | null> {
  // 1. Validate YAML Syntax
  let parsedYaml: unknown;
  try {
    parsedYaml = yaml.load(block.yamlContent);
  } catch (e: unknown) {
    return createYamlErrorDiagnostic(block, e as YamlError);
  }

  // Skip empty content
  if (!parsedYaml) {
    return null;
  }

  // 2. Validate OpenAPI Structure
  const docToValidate = prepareOpenApiDoc(parsedYaml);

  if (!docToValidate) {
    return new vscode.Diagnostic(
      new vscode.Range(block.contentStartLine, 0, block.contentStartLine, 100),
      'Swagger content must be an object (e.g. paths).',
      vscode.DiagnosticSeverity.Error,
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await SwaggerParser.validate(docToValidate as any);
  } catch (err: unknown) {
    return createOpenApiErrorDiagnostic(block, err);
  }

  return null;
}

function createYamlErrorDiagnostic(
  block: SwaggerBlock,
  error: YamlError,
): vscode.Diagnostic | null {
  if (!error?.mark) {
    return null;
  }

  const errorLine = block.contentStartLine + (error.mark.line ?? 0);
  const range = new vscode.Range(errorLine, 0, errorLine, 100);
  const message = error.message ?? 'Unknown YAML error';

  const diagnostic = new vscode.Diagnostic(
    range,
    `YAML Syntax Error: ${message}`,
    vscode.DiagnosticSeverity.Error,
  );
  diagnostic.source = DIAGNOSTICS_SOURCE;
  return diagnostic;
}

function createOpenApiErrorDiagnostic(block: SwaggerBlock, err: unknown): vscode.Diagnostic {
  const message = err instanceof Error ? err.message : 'Invalid OpenAPI definition';
  const range = new vscode.Range(block.contentStartLine, 0, block.range.end.line, 0);

  const diagnostic = new vscode.Diagnostic(
    range,
    `OpenAPI Validation Error: ${message}`,
    vscode.DiagnosticSeverity.Warning,
  );
  diagnostic.source = DIAGNOSTICS_SOURCE;
  return diagnostic;
}

function prepareOpenApiDoc(parsedYaml: unknown): Record<string, unknown> | null {
  if (typeof parsedYaml !== 'object' || parsedYaml === null) {
    return null;
  }

  const doc = parsedYaml as Record<string, unknown>;

  // Already a complete OpenAPI document
  if (doc.openapi || doc.swagger) {
    return doc;
  }

  // Wrap fragment in minimal OpenAPI structure
  return {
    openapi: '3.0.0',
    info: {
      title: 'Temp Validator',
      version: '1.0.0',
    },
    paths: parsedYaml,
  };
}
