import * as assert from 'node:assert';
import * as vscode from 'vscode';
import test from 'node:test';
import { SwaggerCodeActionProvider } from '../src/codeActions';
import { findSwaggerBlocks, parseYamlContent } from '../src/swaggerUtils';

function positionAt(text: string, offset: number): vscode.Position {
    const lines = text.slice(0, offset).split(/\r?\n/);
    const line = lines.length - 1;
    const character = lines[lines.length - 1]?.length ?? 0;
    return new vscode.Position(line, character);
}

function offsetAt(text: string, position: vscode.Position): number {
    const lines = text.split(/\r?\n/);
    let offset = 0;

    for (let i = 0; i < position.line; i++) {
        offset += lines[i].length + 1;
    }

    return offset + position.character;
}

function applyTextEdit(content: string, edit: vscode.TextEdit): string {
    const start = offsetAt(content, edit.range.start);
    const end = offsetAt(content, edit.range.end);
    return content.slice(0, start) + edit.newText + content.slice(end);
}

function createDocument(text: string): vscode.TextDocument {
    return {
        getText: () => text,
        uri: vscode.Uri.parse('file:///test.ts'),
        version: 1,
        positionAt: (offset: number) => positionAt(text, offset),
        languageId: 'javascript',
    } as unknown as vscode.TextDocument;
}

test('Swagger code actions - should insert a valid default responses block', () => {
    const provider = new SwaggerCodeActionProvider();
    const swaggerBlock = `/**\n * @swagger\n * /api/test:\n *   get:\n *     summary: Test endpoint\n *     operationId: testEndpoint\n */`;
    const document = createDocument(swaggerBlock);
    const diagnostic = new vscode.Diagnostic(
        new vscode.Range(new vscode.Position(6, 0), new vscode.Position(6, 0)),
        'responses is required',
        vscode.DiagnosticSeverity.Warning,
    );

    const fix = (provider as unknown as {
        createAddResponsesFix(
            document: vscode.TextDocument,
            diagnostic: vscode.Diagnostic,
        ): vscode.CodeAction | null;
    }).createAddResponsesFix(document, diagnostic);

    assert.ok(fix, 'Quick fix should be generated for missing responses');
    const entries = fix.edit?.entries();
    assert.ok(entries && entries.length === 1, 'Workspace edit should target the document');

    let updatedText = swaggerBlock;
    for (const edit of entries[0][1]) {
        updatedText = applyTextEdit(updatedText, edit);
    }

    const updatedDocument = createDocument(updatedText);
    const blocks = findSwaggerBlocks(updatedDocument);
    assert.strictEqual(blocks.length, 1, 'Swagger block should be detected after applying the fix');

    const parsed = parseYamlContent(blocks[0].yamlContent);
    assert.ok(parsed, 'Swagger block should contain valid YAML after applying the responses fix');

    const pathDefinition = (parsed as Record<string, unknown>)['/api/test'] as
        | Record<string, unknown>
        | undefined;
    const methodDefinition = pathDefinition?.get as Record<string, unknown> | undefined;
    assert.ok(methodDefinition?.responses, 'Responses section should be present in the fixed YAML');
    assert.ok((methodDefinition?.responses as Record<string, unknown>)['200'], 'Default 200 response should be included');
});
