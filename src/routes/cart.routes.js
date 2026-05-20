const express = require('express');
const {
  getCartHandler,
  addItemHandler,
  updateItemHandler,
  removeItemHandler,
  mergeCartHandler,
} = require('../controllers/cart.controller');
const { authenticate, optionalAuthenticate } = require('../middlewares/authenticate');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Cart
 *   description: Shopping cart management (supports authenticated users and guests)
 *
 * x-session-id:
 *   Guest clients MUST include the `x-session-id` header (a stable client-generated UUID)
 *   on every request. Authenticated users do not need this header.
 */

/**
 * @swagger
 * /api/cart:
 *   get:
 *     summary: Get cart (with items) for the current user or guest session
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *       - sessionId: []
 *     parameters:
 *       - in: header
 *         name: x-session-id
 *         schema: { type: string, format: uuid }
 *         description: Guest session ID (required when not authenticated)
 *     responses:
 *       200:
 *         description: Cart retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cart:
 *                   $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Missing owner context
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', optionalAuthenticate, getCartHandler);

/**
 * @swagger
 * /api/cart/items:
 *   post:
 *     summary: Add an item to the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *       - sessionId: []
 *     parameters:
 *       - in: header
 *         name: x-session-id
 *         schema: { type: string, format: uuid }
 *         description: Guest session ID (required when not authenticated)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [item_type, product_id]
 *             properties:
 *               item_type:
 *                 type: string
 *                 enum: [normal, ai_personalization]
 *               product_id:
 *                 type: string
 *                 format: uuid
 *               variant_id:
 *                 type: string
 *                 format: uuid
 *                 description: Required when the product has variants (size/color)
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *               design_id:
 *                 type: string
 *                 format: uuid
 *                 description: Required for ai_personalization items; design must be ready/finalized
 *     responses:
 *       201:
 *         description: Item added to cart
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 item: { $ref: '#/components/schemas/CartItem' }
 *       400:
 *         description: Validation error or product/design not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/items', optionalAuthenticate, addItemHandler);

/**
 * @swagger
 * /api/cart/merge:
 *   post:
 *     summary: Merge a guest cart into the authenticated user's cart (call after login)
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 description: The guest session ID used before login
 *     responses:
 *       200:
 *         description: Carts merged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 merged: { type: integer, description: 'Number of items merged' }
 *       400:
 *         description: Missing sessionId
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/merge', authenticate, mergeCartHandler);

/**
 * @swagger
 * /api/cart/items/{itemId}:
 *   patch:
 *     summary: Update the quantity of a cart item
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *       - sessionId: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: x-session-id
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Cart item updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 item: { $ref: '#/components/schemas/CartItem' }
 *       400:
 *         description: Validation error or item not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/items/:itemId', optionalAuthenticate, updateItemHandler);

/**
 * @swagger
 * /api/cart/items/{itemId}:
 *   delete:
 *     summary: Remove an item from the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *       - sessionId: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: x-session-id
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Item removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/items/:itemId', optionalAuthenticate, removeItemHandler);

module.exports = router;
