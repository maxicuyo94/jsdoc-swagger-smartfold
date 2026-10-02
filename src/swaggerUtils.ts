import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import { DIAGNOSTICS_SOURCE, SWAGGER_TAGS, HTTP_METHODS, configManager } from './constants';
import { DocumentCache } from './utils';

export interface SwaggerBlock {
  range: vscode.Range;
  yamlContent: string;
  /** Line number where YAML content starts (relative to document) */
  contentStartLine: number;
  /** Parsed endpoint info for display */
  endpointInfo?: EndpointInfo;
}

export interface EndpointInfo {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: number;
  responses?: string[];
}

interface YamlError {
  mark?: { line?: number };
  message?: string;
}

// Pre-compiled regex for better performance
const JS_DOC_REGEX = /\/\*\*([\s\S]*?)\*\//g;
const CLOSING_COMMENT_REGEX = /\*\/$/;
const LEADING_ASTERISK_REGEX = /^\s*\*\s?/;
// Regex to match @swagger or @openapi as actual JSDoc tags (not mentioned in text)
// Matches a line that is only the tag, optionally after `*`. The asterisk is
// optional so `/** @swagger` (tag on the opening line) is detected too.
const SWAGGER_TAG_REGEX = /^[ \t]*\*?[ \t]*(@swagger|@openapi)[ \t]*\r?$/m;
// Comment decoration around a tag: leading `/**` or `*`, trailing `*/`
const TAG_LINE_PREFIX_REGEX = /^\s*(?:\/\*\*|\*)?/;
const TAG_LINE_SUFFIX_REGEX = /\*\/\s*$/;

// Cache for parsed blocks
const blocksCache = new DocumentCache<SwaggerBlock[]>(10);

/**
 * Check if content contains any swagger/openapi tag as an actual JSDoc tag
 * (not just mentioned in description text)
 */
function containsSwaggerTag(content: string): boolean {
  return SWAGGER_TAG_REGEX.test(content);
}

/**
 * Find which swagger tag is in the line (must be the tag itself, not mentioned in text)
 */
function findSwaggerTagInLine(line: string): string | null {
  // Remove the comment decoration, then check if line is just the tag
  const cleanLine = line
    .replace(TAG_LINE_PREFIX_REGEX, '')
    .replace(TAG_LINE_SUFFIX_REGEX, '')
    .trim();
  for (const tag of SWAGGER_TAGS) {
    if (cleanLine === tag) {
      return tag;
    }
  }
  return null;
}

/**
 * Finds all JSDoc blocks containing @swagger or @openapi in the document.
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

    // Quick check before expensive processing - supports both @swagger and @openapi
    if (!containsSwaggerTag(innerContent)) {
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
  const extracted = extractYamlFromComment(fullComment);
  if (!extracted) {
    return null;
  }

  const startPos = document.positionAt(startIndex);
  const endPos = document.positionAt(startIndex + fullComment.length);

  return {
    range: new vscode.Range(startPos, endPos),
    yamlContent: extracted.yamlContent,
    contentStartLine: startPos.line + extracted.yamlStartLineOffset,
    endpointInfo: extractEndpointInfo(extracted.yamlContent),
  };
}

/**
 * Extracts the YAML after the @swagger/@openapi tag of a JSDoc comment.
 * Line i of the YAML is line `yamlStartLineOffset + i` of the comment.
 */
function extractYamlFromComment(
  fullComment: string,
): { yamlContent: string; yamlStartLineOffset: number } | null {
  const lines = fullComment.split(/\r?\n/);
  const yamlLines: string[] = [];
  let swaggerFound = false;
  let yamlStartLineOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!swaggerFound) {
      // Check for any swagger tag (@swagger or @openapi)
      if (findSwaggerTagInLine(line)) {
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

  if (!swaggerFound) {
    return null;
  }

  return { yamlContent: yamlLines.join('\n'), yamlStartLineOffset };
}

/**
 * Finds the YAML of every Swagger block in raw source text, without needing a
 * TextDocument (used when scanning files that are not open).
 */
export function findSwaggerYamlInText(text: string): string[] {
  const yamlContents: string[] = [];
  for (const match of text.matchAll(JS_DOC_REGEX)) {
    if (!containsSwaggerTag(match[1])) {
      continue;
    }
    const extracted = extractYamlFromComment(match[0]);
    if (extracted) {
      yamlContents.push(extracted.yamlContent);
    }
  }
  return yamlContents;
}

/**
 * Extract endpoint information from YAML content for display
 */
export function extractEndpointInfo(yamlContent: string): EndpointInfo | undefined {
  try {
    const parsed = yaml.load(yamlContent) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }

    // Find the path and method
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('/') && typeof value === 'object' && value !== null) {
        // This is a path definition
        const pathDef = value as Record<string, unknown>;
        for (const method of HTTP_METHODS) {
          if (pathDef[method] && typeof pathDef[method] === 'object') {
            const methodDef = pathDef[method] as Record<string, unknown>;
            return {
              method: method.toUpperCase(),
              path: key,
              summary: methodDef.summary as string | undefined,
              description: methodDef.description as string | undefined,
              tags: methodDef.tags as string[] | undefined,
              parameters: Array.isArray(methodDef.parameters) ? methodDef.parameters.length : 0,
              responses: methodDef.responses ? Object.keys(methodDef.responses as object) : [],
            };
          }
        }
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse YAML content safely
 */
export function parseYamlContent(yamlContent: string): Record<string, unknown> | null {
  try {
    const parsed = yaml.load(yamlContent);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert YAML to JSON string
 */
export function yamlToJson(yamlContent: string): string | null {
  try {
    const parsed = yaml.load(yamlContent);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}

/**
 * Convert parsed object to YAML string
 */
export function objectToYaml(obj: unknown): string {
  return yaml.dump(obj, { indent: 2, lineWidth: -1 });
}

export interface OpenApiDocument {
  [key: string]: unknown;
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, unknown>;
  components?: Record<string, unknown>;
  tags?: Array<{ name: string; description?: string }>;
  servers?: unknown[];
  security?: unknown[];
  externalDocs?: unknown;
}

/**
 * Merge multiple swagger blocks into a single OpenAPI document.
 * Shared logic used by both exporter and preview.
 */
export function mergeBlocksToOpenApi(
  blocks: ReadonlyArray<Pick<SwaggerBlock, 'yamlContent'>>,
  title: string,
): OpenApiDocument {
  const paths: Record<string, unknown> = {};
  const components: Record<string, unknown> = {};
  const tagsSet = new Set<string>();
  const servers: unknown[] = [];
  const security: unknown[] = [];
  let externalDocs: unknown = undefined;

  for (const block of blocks) {
    const parsed = parseYamlContent(block.yamlContent);
    if (!parsed) {
      continue;
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('/')) {
        // Path definition — merge methods if path already exists
        if (paths[key]) {
          paths[key] = { ...(paths[key] as object), ...(value as object) };
        } else {
          paths[key] = value;
        }

        // Collect tags from method definitions
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
      } else if (key === 'components' && typeof value === 'object' && value !== null) {
        // Merge all component sub-keys (schemas, parameters, responses, securitySchemes, etc.)
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
        value.forEach((t: unknown) => {
          if (typeof t === 'object' && t !== null && 'name' in t) {
            tagsSet.add((t as { name: string }).name);
          } else if (typeof t === 'string') {
            tagsSet.add(t);
          }
        });
      } else if (key === 'servers' && Array.isArray(value)) {
        servers.push(...value);
      } else if (key === 'security' && Array.isArray(value)) {
        security.push(...value);
      } else if (key === 'externalDocs') {
        externalDocs = value;
      }
    }
  }

  const doc: OpenApiDocument = {
    openapi: '3.0.3',
    info: {
      title: `${title} API`,
      version: '1.0.0',
      description: `API documentation generated from ${blocks.length} Swagger block${blocks.length !== 1 ? 's' : ''}`,
    },
    paths,
  };

  if (Object.keys(components).length > 0) {
    doc.components = components;
  }
  if (tagsSet.size > 0) {
    doc.tags = Array.from(tagsSet).map((name) => ({ name }));
  }
  if (servers.length > 0) {
    doc.servers = servers;
  }
  if (security.length > 0) {
    doc.security = security;
  }
  if (externalDocs) {
    doc.externalDocs = externalDocs;
  }

  return doc;
}

/**
 * Validates YAML syntax and basic OpenAPI structure for all blocks.
 */
export async function validateSwagger(blocks: SwaggerBlock[]): Promise<vscode.Diagnostic[]> {
  if (blocks.length === 0) {
    return [];
  }

  // Components defined in any block of the file, so `$ref`s between blocks resolve
  const sharedComponents = mergeBlocksToOpenApi(blocks, '').components ?? {};

  // Validate all blocks in parallel for better performance
  const results = await Promise.all(blocks.map((block) => validateBlock(block, sharedComponents)));

  // Filter out null results
  return results.filter((d): d is vscode.Diagnostic => d !== null);
}

async function validateBlock(
  block: SwaggerBlock,
  sharedComponents: Record<string, unknown>,
): Promise<vscode.Diagnostic | null> {
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
    // Never resolve external $refs: validation runs on every edit and must not
    // read arbitrary files or make network requests on behalf of workspace content.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await SwaggerParser.validate(withSharedComponents(docToValidate, sharedComponents) as any, {
      resolve: { external: false },
    });
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

  // Get configured severity
  const severityMap: Record<string, vscode.DiagnosticSeverity> = {
    error: vscode.DiagnosticSeverity.Error,
    warning: vscode.DiagnosticSeverity.Warning,
    info: vscode.DiagnosticSeverity.Information,
  };
  const severity =
    severityMap[configManager.validationSeverity] ?? vscode.DiagnosticSeverity.Warning;

  const diagnostic = new vscode.Diagnostic(range, `OpenAPI Validation Error: ${message}`, severity);
  diagnostic.source = DIAGNOSTICS_SOURCE;
  return diagnostic;
}

// Top-level OpenAPI properties that should NOT be placed under paths
const OPENAPI_ROOT_PROPERTIES = new Set([
  'openapi',
  'swagger',
  'info',
  'servers',
  'paths',
  'components',
  'security',
  'tags',
  'externalDocs',
]);

function prepareOpenApiDoc(parsedYaml: unknown): Record<string, unknown> | null {
  if (typeof parsedYaml !== 'object' || parsedYaml === null) {
    return null;
  }

  const doc = parsedYaml as Record<string, unknown>;

  // Already a complete OpenAPI document
  if (doc.openapi || doc.swagger) {
    return doc;
  }

  // Separate root-level OpenAPI properties from path definitions
  const rootProps: Record<string, unknown> = {};
  const pathProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(doc)) {
    const normalizedKey = key.trim();
    if (OPENAPI_ROOT_PROPERTIES.has(normalizedKey)) {
      // This is a root-level OpenAPI property (components, tags, etc.)
      rootProps[normalizedKey] = value;
    } else if (normalizedKey.startsWith('/')) {
      // This is a path definition
      pathProps[normalizedKey] = value;
    } else {
      // Unknown property - treat as path for validation to catch the error
      pathProps[normalizedKey] = value;
    }
  }

  // Build the OpenAPI document
  const result: Record<string, unknown> = {
    openapi: '3.0.0',
    info: {
      title: 'Temp Validator',
      version: '1.0.0',
    },
    paths: Object.keys(pathProps).length > 0 ? pathProps : {},
    ...rootProps,
  };

  return result;
}

const COMPONENT_REF_PREFIX = '#/components/';

/**
 * Minimal valid definitions used for `$ref`s to components that are not
 * defined in the current file. With swagger-jsdoc, components usually live in
 * other files, so a file-level validator cannot tell them apart from typos.
 */
const COMPONENT_STUBS: Record<string, (name: string) => unknown> = {
  schemas: () => ({}),
  responses: () => ({ description: '' }),
  parameters: (name) => ({ name, in: 'query', schema: {} }),
  requestBodies: () => ({ content: {} }),
  headers: () => ({ schema: {} }),
  examples: () => ({}),
  links: () => ({}),
  callbacks: () => ({}),
  securitySchemes: () => ({ type: 'http', scheme: 'bearer' }),
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Returns a copy of `doc` whose components include those shared by the whole
 * file (the block's own definitions win) plus stubs for any other
 * `#/components/...` reference. The copy is deep so SwaggerParser, which
 * dereferences in place, never mutates the shared objects.
 */
function withSharedComponents(
  doc: Record<string, unknown>,
  sharedComponents: Record<string, unknown>,
): Record<string, unknown> {
  const ownComponents = asRecord(doc.components);
  const components: Record<string, Record<string, unknown>> = {};

  for (const section of new Set([
    ...Object.keys(sharedComponents),
    ...Object.keys(ownComponents),
  ])) {
    components[section] = {
      ...asRecord(sharedComponents[section]),
      ...asRecord(ownComponents[section]),
    };
  }

  for (const ref of collectComponentRefs(doc)) {
    const [section, name] = ref
      .slice(COMPONENT_REF_PREFIX.length)
      .split('/')
      .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
    const createStub = COMPONENT_STUBS[section];
    if (!name || !createStub) {
      continue;
    }
    components[section] ??= {};
    if (!(name in components[section])) {
      components[section][name] = createStub(name);
    }
  }

  const result = { ...doc };
  if (Object.keys(components).length > 0) {
    result.components = components;
  }
  return structuredClone(result);
}

function collectComponentRefs(value: unknown, refs = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectComponentRefs(item, refs));
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref' && typeof child === 'string' && child.startsWith(COMPONENT_REF_PREFIX)) {
        refs.add(child);
      } else {
        collectComponentRefs(child, refs);
      }
    }
  }
  return refs;
}
