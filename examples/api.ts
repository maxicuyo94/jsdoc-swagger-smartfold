/**
 * Example file to test JSDoc Swagger SmartFold extension
 * Open this file and see the extension in action!
 */

import express from 'express';

const app = express();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     description: Returns a list of all registered users
 *     tags:
 *       - Users
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of users to return
 *         schema:
 *           type: integer
 *           default: 10
 *       - name: offset
 *         in: query
 *         description: Number of users to skip
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: A list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *       500:
 *         description: Internal server error
 */
app.get('/api/users', (req, res) => {
  res.json([{ id: 1, name: 'John Doe' }]);
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Returns a single user by their ID
 *     tags:
 *       - Users
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                   format: email
 *       404:
 *         description: User not found
 */
app.get('/api/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'John Doe' });
});

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     description: Creates a new user in the system
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input
 */
app.post('/api/users', (req, res) => {
  res.status(201).json({ id: 2, ...req.body });
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     tags:
 *       - Products
 *     responses:
 *       200:
 *         description: List of products
 */
app.get('/api/products', (req, res) => {
  res.json([]);
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update a product
 *     tags:
 *       - Products
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Product updated
 *       404:
 *         description: Product not found
 */
app.put('/api/products/:id', (req, res) => {
  res.json({ id: req.params.id, ...req.body });
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags:
 *       - Products
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Product deleted
 *       404:
 *         description: Product not found
 */
app.delete('/api/products/:id', (req, res) => {
  res.status(204).send();
});

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *         name:
 *           type: string
 *           description: User name
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *       required:
 *         - id
 *         - name
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Product ID
 *         name:
 *           type: string
 *           description: Product name
 *         price:
 *           type: number
 *           format: float
 *           description: Product price
 *         description:
 *           type: string
 *           description: Product description
 *       required:
 *         - id
 *         - name
 *         - price
 */
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
