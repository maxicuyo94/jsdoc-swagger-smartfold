import Module from 'module';

class Position {
    constructor(public line: number, public character: number) { }
}

class Range {
    constructor(public start: Position, public end: Position) { }

    contains(position: Position): boolean {
        const isAfterStart =
            position.line > this.start.line ||
            (position.line === this.start.line && position.character >= this.start.character);
        const isBeforeEnd =
            position.line < this.end.line ||
            (position.line === this.end.line && position.character <= this.end.character);
        return isAfterStart && isBeforeEnd;
    }
}

class TextLine {
    constructor(public text: string, public range: Range) { }
}

class TextDocument {
    public readonly version = 1;
    public readonly lineCount: number;
    private readonly lines: string[];

    constructor(
        private readonly text: string,
        public readonly uri: { toString: () => string; fsPath?: string },
        public readonly languageId: string,
    ) {
        this.lines = text.split(/\r?\n/);
        this.lineCount = this.lines.length;
    }

    getText(range?: Range): string {
        if (!range) {
            return this.text;
        }
        const start = this.offsetAt(range.start);
        const end = this.offsetAt(range.end);
        return this.text.slice(start, end);
    }

    positionAt(offset: number): Position {
        const clamped = Math.max(0, Math.min(offset, this.text.length));
        let remaining = clamped;

        for (let i = 0; i < this.lines.length; i++) {
            const lineLength = this.lines[i].length;
            if (remaining <= lineLength) {
                return new Position(i, remaining);
            }
            // Skip newline
            remaining -= lineLength + 1;
        }

        const lastLine = this.lines.length - 1;
        const lastChar = this.lines[lastLine]?.length ?? 0;
        return new Position(lastLine, lastChar);
    }

    offsetAt(position: Position): number {
        const line = Math.min(Math.max(position.line, 0), this.lines.length - 1);
        const character = Math.max(position.character, 0);
        let offset = 0;

        for (let i = 0; i < line; i++) {
            offset += this.lines[i].length + 1;
        }

        return offset + Math.min(character, this.lines[line]?.length ?? 0);
    }

    lineAt(line: number): TextLine {
        if (line < 0 || line >= this.lines.length) {
            throw new Error('Line index out of bounds');
        }

        const text = this.lines[line];
        return new TextLine(text, new Range(new Position(line, 0), new Position(line, text.length)));
    }
}

class Diagnostic {
    public source?: string;

    constructor(
        public range: Range,
        public message: string,
        public severity: number,
    ) { }
}

class WorkspaceEdit {
    private edits = new Map<unknown, TextEdit[]>();

    insert(uri: unknown, position: Position, newText: string): void {
        const existing = this.edits.get(uri) ?? [];
        existing.push({ range: new Range(position, position), newText });
        this.edits.set(uri, existing);
    }

    entries(): [unknown, TextEdit[]][] {
        return Array.from(this.edits.entries());
    }
}

class CodeActionKind {
    constructor(public value: string) { }

    static readonly QuickFix = new CodeActionKind('quickfix');
    static readonly Refactor = new CodeActionKind('refactor');
}

class CodeAction {
    public edit?: WorkspaceEdit;
    public diagnostics?: Diagnostic[];
    public isPreferred?: boolean;
    public command?: unknown;

    constructor(public title: string, public kind?: CodeActionKind) { }
}

interface TextEdit {
    range: Range;
    newText: string;
}

const createTextDocument = (
    text: string,
    uri = 'file:///test.ts',
    languageId = 'javascript',
): TextDocument => {
    return new TextDocument(text, { toString: () => uri, fsPath: uri }, languageId);
};

const vscodeMock = {
    Position,
    Range,
    TextDocument,
    TextLine,
    Diagnostic,
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3,
    },
    WorkspaceEdit,
    CodeAction,
    CodeActionKind,
    Uri: {
        parse: (value: string) => ({ toString: () => value, fsPath: value }),
    },
    languages: {
        registerCodeActionsProvider: () => ({ dispose: () => undefined }),
    },
    workspace: {
        getConfiguration: () => ({
            get: (key: string, defaultValue?: unknown) => {
                const defaults: Record<string, unknown> = {
                    autoFold: true,
                    highlight: true,
                    exclude: [],
                    validationSeverity: 'warning',
                    autoFoldDelay: 300,
                    exportFormat: 'yaml',
                };
                return defaults[key] ?? defaultValue;
            },
        }),
    },
    testUtils: {
        createTextDocument,
    },
};

const originalRequire = Module.prototype.require;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Module.prototype as any).require = function mockRequire(request: string) {
    if (request === 'vscode') {
        return vscodeMock;
    }

    return originalRequire.apply(this, arguments as unknown as [string]);
};
