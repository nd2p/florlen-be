const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authenticate');
const { authorizeAdmin } = require('../middlewares/authorize');
const {
  getAllOrdersAdminHandler,
  updateOrderStatusAdminHandler,
} = require('../controllers/order.controller');
const {
  getAdminAIConfig,
  updateAdminAIConfig,
} = require('../controllers/admin.controller');

// Apply auth middlewares to all admin routes
router.use(authenticate);
router.use(authorizeAdmin);

/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     summary: Retrieve all orders in system (Admin only)
 *     tags: [Admin Orders]
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
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter orders by status
 *       - name: paymentStage
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter orders by payment stage
 *       - name: userId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter orders by user ID
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter orders created on or after this date
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter orders created on or before this date
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search query matching order number, recipient name, phone, or product name
 *     responses:
 *       200:
 *         description: List of all system orders
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
 *       403:
 *         description: Forbidden (Admin only)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/orders', getAllOrdersAdminHandler);

/**
 * @swagger
 * /api/admin/orders/{id}/status:
 *   patch:
 *     summary: Update an order status manually (Admin only)
 *     tags: [Admin Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the order to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [
 *                   pending_payment,
 *                   confirmed,
 *                   in_production,
 *                   quality_check,
 *                   awaiting_remaining_payment,
 *                   ready_to_ship,
 *                   shipping,
 *                   completed,
 *                   cancelled
 *                 ]
 *                 description: The new status to transition to (strict state machine transitions apply)
 *     responses:
 *       200:
 *         description: Order status updated successfully
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
 *         description: Invalid status transition or payload error
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
 *       403:
 *         description: Forbidden (Admin only)
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
 */
router.patch('/orders/:id/status', updateOrderStatusAdminHandler);

// AI Configuration routes
router.get('/ai/config', getAdminAIConfig);
router.put('/ai/config', updateAdminAIConfig);

module.exports = router;
