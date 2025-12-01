import * as assert from 'node:assert';
import test from 'node:test';
import * as vscode from 'vscode';
import { findSwaggerBlocks } from '../src/swaggerUtils';

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

test('Swagger Block Detection - should detect @openapi tag as well', () => {
    const jsdoc = `/**\n * @openapi\n * /api/users:\n *   post:\n *     summary: Create user\n */`;
    const document = {
        getText: () => jsdoc,
        uri: { toString: () => 'test3' },
        version: 1,
        positionAt: (offset: number) => new vscode.Position(0, offset),
    } as unknown as vscode.TextDocument;
    const result = findSwaggerBlocks(document);
    assert.ok(result.length > 0, 'OpenAPI block should be detected');
});

test('Swagger Block Detection - should detect multiple swagger blocks', () => {
    const jsdoc = `/**\n * @swagger\n * /api/test:\n *   get:\n *     summary: Test\n */\n\n/**\n * @swagger\n * /api/users:\n *   post:\n *     summary: Users\n */`;
    const document = {
        getText: () => jsdoc,
        uri: { toString: () => 'test4' },
        version: 1,
        positionAt: (offset: number) => new vscode.Position(0, offset),
    } as unknown as vscode.TextDocument;
    const result = findSwaggerBlocks(document);
    assert.strictEqual(result.length, 2, 'Two swagger blocks should be detected');
});
