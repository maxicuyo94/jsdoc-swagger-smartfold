import * as vscode from 'vscode';
import { HTTP_METHODS } from './constants';
import { parseYamlContent, SwaggerBlock } from './swaggerUtils';
import { locateYamlPath, YamlNode } from './yamlLocator';

/** A text replacement (an insertion when the range is empty). */
export interface TextChange {
  range: vscode.Range;
  newText: string;
}

export interface OperationRef {
  path: string;
  method: string;
  /** Document line of the method key */
  line: number;
  /** Last document line of the operation */
  endLine: number;
}

// Same prefix stripped from each line when extracting a block's YAML
const JSDOC_PREFIX_REGEX = /^\s*\*\s?/;

/**
 * JSON pointer segments of an operation inside the block. Blocks are usually
 * fragments whose root keys are paths; full documents nest them under `paths`.
 */
function operationSegments(block: SwaggerBlock, path: string, method: string): string[] {
  return hasPathsRoot(block) ? ['paths', path, method] : [path, method];
}

function hasPathsRoot(block: SwaggerBlock): boolean {
  const parsed = parseYamlContent(block.yamlContent);
  return !!parsed && typeof parsed.paths === 'object' && parsed.paths !== null;
}

/**
 * Converts a validator pointer (always rooted at `paths` for fragments, since
 * they are wrapped into a document before validation) to block segments.
 */
export function toBlockSegments(block: SwaggerBlock, segments: string[]): string[] {
  return segments[0] === 'paths' && !hasPathsRoot(block) ? segments.slice(1) : segments;
}

function documentLine(block: SwaggerBlock, yamlLine: number): number {
  return block.contentStartLine + yamlLine;
}

/** Builds a line with the JSDoc prefix used by `node`'s line (e.g. " * "). */
function createLineWriter(
  document: vscode.TextDocument,
  block: SwaggerBlock,
  node: YamlNode,
): (indent: number, content: string) => string {
  const text = document.lineAt(documentLine(block, node.line)).text;
  const prefix = JSDOC_PREFIX_REGEX.exec(text)?.[0] ?? '';
  return (indent, content) => `${prefix}${' '.repeat(indent)}${content}`;
}

function lineStart(line: number): vscode.Position {
  return new vscode.Position(line, 0);
}

function insertAfter(block: SwaggerBlock, yamlLine: number, lines: string[]): TextChange {
  const position = lineStart(documentLine(block, yamlLine) + 1);
  return { range: new vscode.Range(position, position), newText: lines.join('\n') + '\n' };
}

/** Quotes a scalar only when a plain YAML scalar would be misread. */
function yamlScalar(value: string): string {
  return /^[A-Za-z0-9_][\w .\-/]*$/.test(value) && !/\s$/.test(value)
    ? value
    : JSON.stringify(value);
}

/**
 * Lists the operations (path + method) defined in a block with their lines.
 */
export function listOperations(block: SwaggerBlock): OperationRef[] {
  const parsed = parseYamlContent(block.yamlContent);
  if (!parsed) {
    return [];
  }

  const pathsRoot = hasPathsRoot(block) ? (parsed.paths as Record<string, unknown>) : parsed;
  const operations: OperationRef[] = [];

  for (const [path, definition] of Object.entries(pathsRoot)) {
    if (!path.startsWith('/') || typeof definition !== 'object' || definition === null) {
      continue;
    }
    for (const method of HTTP_METHODS) {
      if (!(method in definition)) {
        continue;
      }
      const node = locateYamlPath(block.yamlContent, operationSegments(block, path, method));
      if (node) {
        operations.push({
          path,
          method,
          line: documentLine(block, node.line),
          endLine: documentLine(block, node.endLine),
        });
      }
    }
  }

  return operations;
}

/**
 * Parsed definition of an operation (empty when missing).
 */
export function getOperationDefinition(
  block: SwaggerBlock,
  path: string,
  method: string,
): Record<string, unknown> {
  const parsed = parseYamlContent(block.yamlContent) ?? {};
  const pathsRoot = hasPathsRoot(block) ? (parsed.paths as Record<string, unknown>) : parsed;
  const operation = (pathsRoot[path] as Record<string, unknown> | undefined)?.[method];
  return typeof operation === 'object' && operation !== null
    ? (operation as Record<string, unknown>)
    : {};
}

/**
 * Inserts default `responses` at the end of an operation.
 */
export function buildAddResponsesChange(
  document: vscode.TextDocument,
  block: SwaggerBlock,
  path: string,
  method: string,
): TextChange | undefined {
  const operation = locateYamlPath(block.yamlContent, operationSegments(block, path, method));
  if (!operation) {
    return undefined;
  }

  const write = createLineWriter(document, block, operation);
  const indent = operation.childIndent ?? operation.indent + 2;
  const step = indent - operation.indent;
  const responses: Array<[string, string]> = [
    ['200', 'Successful response'],
    ['400', 'Bad request'],
    ['500', 'Internal server error'],
  ];

  return insertAfter(block, operation.endLine, [
    write(indent, 'responses:'),
    ...responses.flatMap(([code, description]) => [
      write(indent + step, `'${code}':`),
      write(indent + step * 2, `description: ${description}`),
    ]),
  ]);
}

/**
 * Inserts a scalar field (e.g. `summary`) as the first entry of an operation.
 */
export function buildAddOperationFieldChange(
  document: vscode.TextDocument,
  block: SwaggerBlock,
  path: string,
  method: string,
  field: string,
  value: string,
): TextChange | undefined {
  const operation = locateYamlPath(block.yamlContent, operationSegments(block, path, method));
  if (!operation) {
    return undefined;
  }

  const write = createLineWriter(document, block, operation);
  const indent = operation.childIndent ?? operation.indent + 2;
  return insertAfter(block, operation.line, [write(indent, `${field}: ${yamlScalar(value)}`)]);
}

/**
 * Adds tags to an operation, merging with (and rewriting) any existing
 * `tags` entry. Returns undefined when every tag is already present.
 */
export function buildAddTagsChange(
  document: vscode.TextDocument,
  block: SwaggerBlock,
  path: string,
  method: string,
  tags: string[],
): TextChange | undefined {
  const segments = operationSegments(block, path, method);
  const operation = locateYamlPath(block.yamlContent, segments);
  if (!operation) {
    return undefined;
  }

  const existingTags = getOperationDefinition(block, path, method).tags;
  const currentTags = Array.isArray(existingTags) ? existingTags.map(String) : [];
  const mergedTags = [...new Set([...currentTags, ...tags])];
  if (mergedTags.length === currentTags.length) {
    return undefined;
  }

  const write = createLineWriter(document, block, operation);
  const tagsNode = locateYamlPath(block.yamlContent, [...segments, 'tags']);
  const indent = tagsNode?.indent ?? operation.childIndent ?? operation.indent + 2;
  const step = (operation.childIndent ?? operation.indent + 2) - operation.indent;
  const lines = [
    write(indent, 'tags:'),
    ...mergedTags.map((tag) => write(indent + step, `- ${yamlScalar(tag)}`)),
  ];

  if (!tagsNode) {
    return insertAfter(block, operation.line, lines);
  }

  return {
    range: new vscode.Range(
      lineStart(documentLine(block, tagsNode.line)),
      lineStart(documentLine(block, tagsNode.endLine) + 1),
    ),
    newText: lines.join('\n') + '\n',
  };
}

/**
 * Range of the value of the `type` key at `segments` (ending in `type`).
 */
export function findTypeValueRange(
  document: vscode.TextDocument,
  block: SwaggerBlock,
  segments: string[],
): vscode.Range | undefined {
  const node = locateYamlPath(block.yamlContent, segments);
  if (!node) {
    return undefined;
  }

  const line = documentLine(block, node.line);
  const text = document.lineAt(line).text;
  const match = /(\btype\s*:\s*)(['"]?[^\s#'"]+['"]?)/.exec(text);
  if (!match) {
    return undefined;
  }

  const start = match.index + match[1].length;
  return new vscode.Range(
    new vscode.Position(line, start),
    new vscode.Position(line, start + match[2].length),
  );
}

/**
 * Suggested operationId, e.g. `get /users/{id}` → `getUsersById`.
 */
export function suggestOperationId(path: string, method: string): string {
  const words = path
    .split('/')
    .filter(Boolean)
    .map((part) => {
      const param = /^\{(.+)\}$/.exec(part);
      return param ? `by ${param[1]}` : part;
    })
    .join(' ')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  return [method, ...words]
    .map((word, i) => (i === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1)))
    .join('');
}
