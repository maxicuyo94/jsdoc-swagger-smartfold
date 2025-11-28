import * as assert from 'node:assert';
import { findSwaggerBlocks } from '../src/swaggerUtils';
import * as vscode from 'vscode';

describe('Swagger Block Detection', () => {
    it('should detect a swagger block', () => {
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

    it('should not detect a swagger block in unrelated JSDoc', () => {
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
});
