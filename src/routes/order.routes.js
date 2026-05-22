const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authenticate');
const {
  createOrderHandler,
  getOrdersHandler,
  getOrderByIdHandler,
  cancelOrderHandler,
  payRemainingHandler,
  syncPaymentHandler,
} = require('../controllers/order.controller');

// ─── User Endpoints (authenticated) ──────────────────────────────────────────

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order from cart items and get PayOS payment link
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cartId
 *               - paymentOption
 *               - addressId
 *             properties:
 *               cartId:
 *                 type: string
 *                 format: uuid
 *                 description: The cart ID to create order from
 *               paymentOption:
 *                 type: string
 *                 enum: [full, deposit]
 *                 description: "full = 100% payment, deposit = 30% deposit"
 *               addressId:
 *                 type: string
 *                 format: uuid
 *                 description: Shipping address ID
 *               note:
 *                 type: string
 *                 description: Optional customer note
 *     responses:
 *       201:
 *         description: Order created with PayOS payment link
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 order:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     orderNumber:
 *                       type: string
 *                     status:
 *                       type: string
 *                     totalAmount:
 *                       type: number
 *                     depositAmount:
 *                       type: number
 *                     remainingAmount:
 *                       type: number
 *                     paymentOption:
 *                       type: string
 *                 paymentLink:
 *                   type: object
 *                   properties:
 *                     checkoutUrl:
 *                       type: string
 *                       format: uri
 *                     qrCode:
 *                       type: string
 *                 orderCode:
 *                   type: integer
 *       400:
 *         description: Validation error or cart/address issue
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authenticate, createOrderHandler);
router.post('/sync-payment', authenticate, syncPaymentHandler);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: List orders for the authenticated user
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: cursor
 *         in: query
 *         schema:
 *           type: string
 *         description: Cursor for pagination (created_at of last item)
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of orders to return
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 hasMore:
 *                   type: boolean
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', authenticate, getOrdersHandler);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get full order detail
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order detail with status logs and payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', authenticate, getOrderByIdHandler);

/**
 * @swagger
 * /api/orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order (customer). Only allowed for pending_payment status.
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 order:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Cannot cancel order in current status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/cancel', authenticate, cancelOrderHandler);

/**
 * @swagger
 * /api/orders/{id}/pay-remaining:
 *   post:
 *     summary: Create PayOS payment link for remaining 70% balance
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment link created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 paymentLink:
 *                   type: object
 *                   properties:
 *                     checkoutUrl:
 *                       type: string
 *                       format: uri
 *                     qrCode:
 *                       type: string
 *                 orderCode:
 *                   type: integer
 *                 amount:
 *                   type: number
 *       400:
 *         description: Order is not in awaiting_remaining_payment status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/pay-remaining', authenticate, payRemainingHandler);

module.exports = router;
