/**
 * Line-based locator for YAML nodes, used to map OpenAPI JSON pointers
 * (e.g. `#/paths/~1users/get`) back to lines inside a Swagger block.
 *
 * It only understands block-style mappings and sequences (the style used in
 * JSDoc Swagger blocks); flow collections and block scalars are treated as
 * opaque values.
 */

export interface YamlNode {
  /** Line (0-based, relative to the YAML content) where the node starts */
  line: number;
  /** Column where the node's key (or `-` for sequence items) starts */
  indent: number;
  /** Last non-blank line belonging to the node, including nested content */
  endLine: number;
  /** Indentation of the node's first nested entry, if it has any */
  childIndent?: number;
}

interface Entry {
  line: number;
  indent: number;
  key?: string;
  item: boolean;
}

// Mapping key at the start of a line: double-quoted, single-quoted or plain
const KEY_REGEX = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^']|'')*)'|([^\s#'"{[][^#]*?))\s*:(?=\s|$)/;

function parseEntries(lines: string[]): Entry[] {
  const entries: Entry[] = [];

  lines.forEach((raw, line) => {
    const text = raw.replace(/\s+$/, '');
    let rest = text.trimStart();
    if (!rest || rest.startsWith('#')) {
      return;
    }

    let indent = text.length - rest.length;

    // "- key: value" opens a sequence item and a mapping key on the same line
    while (rest === '-' || rest.startsWith('- ')) {
      entries.push({ line, indent, item: true });
      const afterDash = rest.slice(1);
      rest = afterDash.trimStart();
      indent += 1 + (afterDash.length - rest.length);
      if (!rest) {
        return;
      }
    }

    const match = KEY_REGEX.exec(rest);
    const key = match ? (match[1] ?? match[2]?.replace(/''/g, "'") ?? match[3]?.trim()) : undefined;
    entries.push({ line, indent, key, item: false });
  });

  return entries;
}

/** Index one past the last entry nested under `entries[index]`. */
function scopeEnd(entries: Entry[], index: number): number {
  const parent = entries[index];
  let end = index + 1;
  let sawSibling = false;

  for (; end < entries.length; end++) {
    const entry = entries[end];
    if (entry.indent > parent.indent) {
      continue;
    }
    // Sequences may sit at the same indentation as their parent key:
    //   tags:
    //   - Users
    if (!parent.item && !sawSibling && entry.item && entry.indent === parent.indent) {
      continue;
    }
    sawSibling = true;
    break;
  }

  return end;
}

function toNode(entries: Entry[], index: number): YamlNode {
  const end = scopeEnd(entries, index);
  const firstChild = index + 1 < end ? entries[index + 1] : undefined;
  return {
    line: entries[index].line,
    indent: entries[index].indent,
    endLine: entries[end - 1].line,
    childIndent: firstChild?.indent,
  };
}

/**
 * Finds the node at `segments` (mapping keys or sequence indexes) in `yaml`.
 */
export function locateYamlPath(yaml: string, segments: string[]): YamlNode | undefined {
  const entries = parseEntries(yaml.split(/\r?\n/));
  let start = 0;
  let end = entries.length;
  let found = -1;

  for (const segment of segments) {
    if (start >= end) {
      return undefined;
    }

    const childIndent = entries[start].indent;
    const children: number[] = [];
    for (let i = start; i < end; i++) {
      if (entries[i].indent === childIndent) {
        children.push(i);
      }
    }

    const isSequence = children.every((i) => entries[i].item);
    if (isSequence) {
      const position = Number(segment);
      found = Number.isInteger(position) ? (children[position] ?? -1) : -1;
    } else {
      found = children.find((i) => !entries[i].item && entries[i].key === segment) ?? -1;
    }

    if (found === -1) {
      return undefined;
    }

    start = found + 1;
    end = scopeEnd(entries, found);
  }

  return found === -1 ? undefined : toNode(entries, found);
}

/**
 * Splits a JSON pointer (`#/paths/~1users/get` or `/paths/~1users/get`) into
 * decoded segments.
 */
export function parseJsonPointer(pointer: string): string[] {
  return pointer
    .replace(/^#/, '')
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}
