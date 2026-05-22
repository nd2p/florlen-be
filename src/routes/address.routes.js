const express = require('express');
const { authenticate } = require('../middlewares/authenticate');
const {
  getAddresses,
  getSingleAddress,
  createAddressHandler,
  updateAddressHandler,
  deleteAddressHandler,
  setDefaultAddressHandler,
} = require('../controllers/address.controller');

const router = express.Router();

// All address routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/addresses:
 *   get:
 *     summary: List all saved addresses for the authenticated user
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of addresses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 addresses:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/UserAddress' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', getAddresses);

/**
 * @swagger
 * /api/addresses/{id}:
 *   get:
 *     summary: Get a single address by ID
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Address UUID
 *     responses:
 *       200:
 *         description: Address retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 address: { $ref: '#/components/schemas/UserAddress' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Address not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', getSingleAddress);

/**
 * @swagger
 * /api/addresses:
 *   post:
 *     summary: Create a new address
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipientName, phone, addressLine1, city]
 *             properties:
 *               recipientName:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Nguyen Van A"
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *                 example: "0987654321"
 *               addressLine1:
 *                 type: string
 *                 maxLength: 255
 *                 example: "123 Nguyen Trai, Ward 2"
 *               city:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Ho Chi Minh City"
 *               countryCode:
 *                 type: string
 *                 maxLength: 2
 *                 default: "VN"
 *                 example: "VN"
 *               label:
 *                 type: string
 *                 maxLength: 50
 *                 example: "Home"
 *               isDefault:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Address created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 address: { $ref: '#/components/schemas/UserAddress' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', createAddressHandler);

/**
 * @swagger
 * /api/addresses/{id}:
 *   patch:
 *     summary: Partially update an existing address
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipientName: { type: string }
 *               phone: { type: string }
 *               addressLine1: { type: string }
 *               city: { type: string }
 *               countryCode: { type: string }
 *               label: { type: string }
 *               isDefault: { type: boolean }
 *     responses:
 *       200:
 *         description: Address updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 address: { $ref: '#/components/schemas/UserAddress' }
 *       400:
 *         description: Validation error or no fields to update
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Address not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id', updateAddressHandler);

/**
 * @swagger
 * /api/addresses/{id}:
 *   delete:
 *     summary: Delete an address
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Address deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Address not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id', deleteAddressHandler);

/**
 * @swagger
 * /api/addresses/{id}/set-default:
 *   post:
 *     summary: Set an address as the default shipping address
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Default address updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 address: { $ref: '#/components/schemas/UserAddress' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Address not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/:id/set-default', setDefaultAddressHandler);

module.exports = router;
