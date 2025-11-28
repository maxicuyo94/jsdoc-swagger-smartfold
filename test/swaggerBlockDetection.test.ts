import * as assert from 'assert';
import { detectSwaggerBlock } from '../src/swaggerUtils';

describe('Swagger Block Detection', () => {
    it('should detect a swagger block', () => {
        const jsdoc = `/**\n * @swagger\n * /api/test:\n *   get:\n *     summary: Test endpoint\n */`;
        const result = detectSwaggerBlock(jsdoc);
        assert.ok(result, 'Swagger block should be detected');
    });

    it('should not detect a swagger block in unrelated JSDoc', () => {
        const jsdoc = `/**\n * Just a regular comment\n */`;
        const result = detectSwaggerBlock(jsdoc);
        assert.strictEqual(result, false, 'No swagger block should be detected');
    });
});
