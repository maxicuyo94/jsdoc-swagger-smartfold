import * as assert from 'node:assert';
import { findSwaggerBlocks } from '../src/swaggerUtils';
import * as vscode from 'vscode';

function createTestDocument(text: string, uri = 'test'): vscode.TextDocument {
    const lineOffsets = [0];
    let searchIndex = 0;

    while (true) {
        const newlineIndex = text.indexOf('\n', searchIndex);
        if (newlineIndex === -1) {
            break;
        }
        const nextOffset = newlineIndex + 1;
        lineOffsets.push(nextOffset);
        searchIndex = nextOffset;
    }

    return {
        getText: () => text,
        uri: { toString: () => uri },
        version: 1,
        positionAt: (offset: number) => {
            const clampedOffset = Math.max(0, Math.min(offset, text.length));

            let line = 0;
            for (let i = 1; i < lineOffsets.length; i++) {
                if (lineOffsets[i] > clampedOffset) {
                    break;
                }
                line = i;
            }

            const character = clampedOffset - lineOffsets[line];
            return new vscode.Position(line, character);
        },
    } as unknown as vscode.TextDocument;
}

describe('Swagger Block Detection', () => {
    it('should detect a swagger block', () => {
        const jsdoc = `/**\n * @swagger\n * /api/test:\n *   get:\n *     summary: Test endpoint\n */`;
        // Simular un documento VSCode
        const document = createTestDocument(jsdoc, 'test');
        const result = findSwaggerBlocks(document);
        assert.ok(result.length > 0, 'Swagger block should be detected');
        assert.strictEqual(result[0].range.start.line, 0, 'Block should start on line 0');
        assert.strictEqual(result[0].range.end.line, 5, 'Block should end on line 5');
        assert.strictEqual(result[0].contentStartLine, 2, 'YAML content should start after tag line');
    });

    it('should not detect a swagger block in unrelated JSDoc', () => {
        const jsdoc = `/**\n * Just a regular comment\n */`;
        const document = createTestDocument(jsdoc, 'test2');
        const result = findSwaggerBlocks(document);
        assert.strictEqual(result.length, 0, 'No swagger block should be detected');
    });
});
