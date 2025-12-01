import * as assert from 'node:assert';
import test from 'node:test';
import * as vscode from 'vscode';
import { findSwaggerBlocks } from '../src/swaggerUtils';

describe('Swagger Block Detection', () => {
    it('should detect a swagger block', () => {
        const jsdoc = `/**\n * @swagger\n * /api/test:\n *   get:\n *     summary: Test endpoint\n */`;
        // Simular un documento de VS Code
        const document = {
            getText: () => jsdoc,
            uri: { toString: () => 'test' },
            version: 1,
            positionAt: (offset: number) => new vscode.Position(0, offset),
        } as unknown as vscode.TextDocument;
        const result = findSwaggerBlocks(document);
        assert.ok(result.length > 0, 'Swagger block should be detected');
    });
test('Swagger Block Detection - should detect a swagger block', () => {
    const jsdoc = `/**\n * @swagger\n * /api/test:\n *   get:\n *     summary: Test endpoint\n */`;
    // Simular un documento VSCode
    const document = {
        getText: () => jsdoc,
        uri: { toString: () => 'test' },
        version: 1,
        positionAt: (offset: number) => new vscode.Position(0, offset),
    } as unknown as vscode.TextDocument;
    const result = findSwaggerBlocks(document);
    assert.ok(result.length > 0, 'Swagger block should be detected');
});

test('Swagger Block Detection - should not detect a swagger block in unrelated JSDoc', () => {
    const jsdoc = `/**\n * Just a regular comment\n */`;
    const document = {
        getText: () => jsdoc,
        uri: { toString: () => 'test2' },
        version: 1,
        positionAt: (offset: number) => new vscode.Position(0, offset),
    } as unknown as vscode.TextDocument;
    const result = findSwaggerBlocks(document);
    assert.strictEqual(result.length, 0, 'No swagger block should be detected');
});
