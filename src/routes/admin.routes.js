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
const {
  listUsersHandler,
  getUserByIdHandler,
  updateUserHandler,
} = require('../controllers/admin-user.controller');
const {
  getReportsSummaryHandler,
  listTransactionsHandler,
} = require('../controllers/admin-report.controller');


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

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Retrieve all user profiles with details (Admin only)
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search query matching name, display name, phone, or email
 *       - name: role
 *         in: query
 *         schema:
 *           type: string
 *           enum: [customer, admin, super_admin]
 *         description: Filter users by role
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, inactive, banned]
 *         description: Filter users by account status
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of users to return (max 100)
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: List of user profiles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       role: { type: string, enum: [customer, admin, super_admin] }
 *                       full_name: { type: string, nullable: true }
 *                       display_name: { type: string, nullable: true }
 *                       avatar_url: { type: string, nullable: true }
 *                       phone_number: { type: string, nullable: true }
 *                       is_active: { type: boolean }
 *                       is_banned: { type: boolean }
 *                       banned_reason: { type: string, nullable: true }
 *                       email: { type: string, nullable: true }
 *                       last_login_at: { type: string, format: date-time, nullable: true }
 *                       created_at: { type: string, format: date-time }
 *                       updated_at: { type: string, format: date-time }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalCount: { type: integer }
 *                     limit: { type: integer }
 *                     offset: { type: integer }
 *                     hasMore: { type: boolean }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get('/users', listUsersHandler);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get a single user's detailed profile (Admin only)
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         description: User not found
 */
router.get('/users/:id', getUserByIdHandler);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   patch:
 *     summary: Update a user's details, role, or active/ban status (Admin only)
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name: { type: string }
 *               display_name: { type: string }
 *               phone_number: { type: string }
 *               role: { type: string, enum: [customer, admin, super_admin] }
 *               is_active: { type: boolean }
 *               is_banned: { type: boolean }
 *               banned_reason: { type: string }
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid input or role update error (e.g. self role modification)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         description: User not found
 */
router.patch('/users/:id', updateUserHandler);

/**
 * @swagger
 * /api/admin/reports/summary:
 *   get:
 *     summary: Get dashboard statistics and aggregations (Admin only)
 *     tags: [Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reports summary data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     totalRevenue: { type: number }
 *                     totalOrders: { type: integer }
 *                     completedOrders: { type: integer }
 *                     totalCustomers: { type: integer }
 *                 charts:
 *                   type: object
 *                   properties:
 *                     dailyRevenueHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date: { type: string }
 *                           amount: { type: number }
 *                     orderStatusBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status: { type: string }
 *                           count: { type: integer }
 *                     paymentMethodsBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           method: { type: string }
 *                           count: { type: integer }
 *                           amount: { type: number }
 *                     topSellingProducts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string }
 *                           quantity: { type: integer }
 *                           amount: { type: number }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get('/reports/summary', getReportsSummaryHandler);

/**
 * @swagger
 * /api/admin/reports/transactions:
 *   get:
 *     summary: Retrieve payment transaction logs list (Admin only)
 *     tags: [Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search query matching Transaction ID, Type, Method, Name, or Email
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, processing, succeeded, failed, refunded, partially_refunded]
 *         description: Filter transactions by status
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of records to return
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: List of transactions retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get('/reports/transactions', listTransactionsHandler);

module.exports = router;
