import * as assert from 'node:assert';
import test from 'node:test';
import { addReferencedComponents } from '../src/swaggerUtils';

const ORDER_SCHEMA = {
  type: 'object',
  properties: { item: { $ref: '#/components/schemas/Item' } },
};
const ITEM_SCHEMA = { type: 'object', properties: { sku: { type: 'string' } } };

const spec = {
  paths: {
    '/orders': {
      get: {
        responses: {
          200: {
            description: 'ok',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
};

test('addReferencedComponents - copies referenced components and their own references', () => {
  const components: Record<string, Record<string, unknown>> = {};
  addReferencedComponents(spec, components, {
    schemas: { Order: ORDER_SCHEMA, Item: ITEM_SCHEMA, Unused: { type: 'string' } },
    responses: { NotFound: { description: 'Not found' } },
  });

  assert.deepStrictEqual(Object.keys(components.schemas).sort(), ['Item', 'Order']);
  assert.deepStrictEqual(components.schemas.Order, ORDER_SCHEMA);
  assert.deepStrictEqual(components.responses.NotFound, { description: 'Not found' });
});

test('addReferencedComponents - keeps components that are already defined', () => {
  const ownOrder = { type: 'string' };
  const components: Record<string, Record<string, unknown>> = { schemas: { Order: ownOrder } };
  addReferencedComponents(spec, components, { schemas: { Order: ORDER_SCHEMA } });

  assert.strictEqual(components.schemas.Order, ownOrder);
});

test('addReferencedComponents - stubs components that are not available anywhere', () => {
  const components: Record<string, Record<string, unknown>> = {};
  addReferencedComponents(spec, components, {}, 'Not found in the workspace');

  assert.deepStrictEqual(components.schemas.Order, { description: 'Not found in the workspace' });
  assert.deepStrictEqual(components.responses.NotFound, {
    description: 'Not found in the workspace',
  });
});

test('addReferencedComponents - handles reference cycles', () => {
  const components: Record<string, Record<string, unknown>> = {};
  addReferencedComponents({ $ref: '#/components/schemas/Node' }, components, {
    schemas: {
      Node: { type: 'object', properties: { next: { $ref: '#/components/schemas/Node' } } },
    },
  });

  assert.deepStrictEqual(Object.keys(components.schemas), ['Node']);
});
