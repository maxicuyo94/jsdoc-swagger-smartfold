import Module from 'module';

class Position {
    constructor(public line: number, public character: number) {}
}

class Range {
    constructor(public start: Position, public end: Position) {}

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

class Diagnostic {
    public source?: string;

    constructor(
        public range: Range,
        public message: string,
        public severity: number,
    ) {}
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
    constructor(public value: string) {}

    static readonly QuickFix = new CodeActionKind('quickfix');
    static readonly Refactor = new CodeActionKind('refactor');
}

class CodeAction {
    public edit?: WorkspaceEdit;
    public diagnostics?: Diagnostic[];
    public isPreferred?: boolean;
    public command?: unknown;

    constructor(public title: string, public kind?: CodeActionKind) {}
}

interface TextEdit {
    range: Range;
    newText: string;
}

const vscodeMock = {
    Position,
    Range,
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
        parse: (value: string) => ({ toString: () => value }),
    },
    languages: {
        registerCodeActionsProvider: () => ({ dispose: () => undefined }),
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
