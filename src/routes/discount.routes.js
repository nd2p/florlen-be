const express = require('express');
const router = express.Router();
const { authenticate, optionalAuthenticate } = require('../middlewares/authenticate');
const { authorizeAdmin } = require('../middlewares/authorize');
const {
  getVouchersHandler,
  createVoucherHandler,
  updateVoucherHandler,
  deleteVoucherHandler,
  validateVoucherHandler,
} = require('../controllers/discount.controller');

/**
 * @swagger
 * /api/discounts/validate:
 *   post:
 *     summary: Validate and calculate discount for a voucher code (Public/Authenticated)
 *     tags: [Discounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 description: The raw voucher coupon code to validate
 *               subtotal:
 *                 type: number
 *                 default: 0
 *                 description: Current cart subtotal before discounts
 *     responses:
 *       200:
 *         description: Voucher validated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 code:
 *                   type: string
 *                 discountType:
 *                   type: string
 *                   enum: [percentage, fixed_amount, free_shipping]
 *                 discountValue:
 *                   type: number
 *                 discountAmount:
 *                   type: number
 *       400:
 *         description: Voucher code invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/validate', optionalAuthenticate, validateVoucherHandler);

// Admin-protected operations
router.use(authenticate);
router.use(authorizeAdmin);

/**
 * @swagger
 * /api/discounts:
 *   get:
 *     summary: Get all system vouchers (Admin only)
 *     tags: [Admin Discounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *       - name: cursor
 *         in: query
 *         schema:
 *           type: string
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of all vouchers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vouchers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Voucher'
 *                 hasMore:
 *                   type: boolean
 *                 nextCursor:
 *                   type: string
 *                   nullable: true
 */
router.get('/', getVouchersHandler);

/**
 * @swagger
 * /api/discounts:
 *   post:
 *     summary: Create a new voucher (Admin only)
 *     tags: [Admin Discounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - discount_type
 *             properties:
 *               code:
 *                 type: string
 *               discount_type:
 *                 type: string
 *                 enum: [percentage, fixed_amount, free_shipping]
 *               discount_value:
 *                 type: number
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               end_date:
 *                 type: string
 *                 format: date-time
 *               usage_limit:
 *                 type: integer
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Voucher created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 voucher:
 *                   $ref: '#/components/schemas/Voucher'
 */
router.post('/', createVoucherHandler);

/**
 * @swagger
 * /api/discounts/{id}:
 *   patch:
 *     summary: Update an existing voucher (Admin only)
 *     tags: [Admin Discounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               discount_type:
 *                 type: string
 *                 enum: [percentage, fixed_amount, free_shipping]
 *               discount_value:
 *                 type: number
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               end_date:
 *                 type: string
 *                 format: date-time
 *               usage_limit:
 *                 type: integer
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Voucher updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 voucher:
 *                   $ref: '#/components/schemas/Voucher'
 */
router.patch('/:id', updateVoucherHandler);

/**
 * @swagger
 * /api/discounts/{id}:
 *   delete:
 *     summary: Soft delete a voucher (Admin only)
 *     tags: [Admin Discounts]
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
 *         description: Voucher deleted successfully
 */
router.delete('/:id', deleteVoucherHandler);

module.exports = router;
