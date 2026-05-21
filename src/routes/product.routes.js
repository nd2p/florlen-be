const express = require('express');
const {
  getProducts,
  getProduct,
  create,
  update,
  remove,
} = require('../controllers/product.controller');
const { authenticate } = require('../middlewares/authenticate');
const { authorizeAdmin } = require('../middlewares/authorize');

const router = express.Router();

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: List products with pagination and filters
 *     tags: [Products]
 *     parameters:
 *       - name: cursor
 *         in: query
 *         schema: { type: string, format: uuid }
 *         description: Cursor for pagination
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *         description: Number of products per page
 *       - name: type
 *         in: query
 *         schema: { type: string, enum: [normal, ai_base, add_ons] }
 *         description: Filter by product type
 *       - name: tag
 *         in: query
 *         schema: { type: string }
 *         description: Filter by tag
 *       - name: collection
 *         in: query
 *         schema: { type: string, format: uuid }
 *         description: Filter by collection ID
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 products:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *                 hasMore: { type: boolean }
 *                 nextCursor: { type: string, format: uuid, nullable: true }
 */
router.get('/', getProducts);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product: { $ref: '#/components/schemas/Product' }
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', getProduct);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create new product (admin/super_admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product:
 *                 type: object
 *                 properties:
 *                   sku: { type: string }
 *                   name: { type: string }
 *                   slug: { type: string }
 *                   description: { type: string }
 *                   short_description: { type: string }
 *                   product_type: { type: string, enum: [normal, ai_base, add_ons] }
 *                   base_price: { type: number }
 *                   customization_fee: { type: number }
 *                   production_days_min: { type: integer }
 *                   production_days_max: { type: integer }
 *                   is_active: { type: boolean, default: true }
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url: { type: string }
 *                     storage_path: { type: string }
 *                     alt_text: { type: string }
 *                     is_primary: { type: boolean }
 *                     bucket: { type: string }
 *               variants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     sku_suffix: { type: string }
 *                     size: { type: string }
 *                     color_name: { type: string }
 *                     additional_price: { type: number }
 *                     stock_qty: { type: integer }
 *             required: [product, images, variants]
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product: { $ref: '#/components/schemas/Product' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Forbidden - admin/super_admin only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', authenticate, authorizeAdmin, create);

/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Update product (admin/super_admin only)
 *     tags: [Products]
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
 *               product:
 *                 type: object
 *                 properties:
 *                   sku: { type: string }
 *                   name: { type: string }
 *                   slug: { type: string }
 *                   description: { type: string }
 *                   short_description: { type: string }
 *                   product_type: { type: string, enum: [normal, ai_base] }
 *                   base_price: { type: number }
 *                   customization_fee: { type: number }
 *                   production_days_min: { type: integer }
 *                   production_days_max: { type: integer }
 *                   is_active: { type: boolean }
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     url: { type: string }
 *                     storage_path: { type: string }
 *                     alt_text: { type: string }
 *                     width: { type: integer }
 *                     height: { type: integer }
 *                     sort_order: { type: integer }
 *                     is_primary: { type: boolean }
 *               variants:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     sku_suffix: { type: string }
 *                     size: { type: string }
 *                     color_name: { type: string }
 *                     color_hex: { type: string }
 *                     additional_price: { type: number }
 *                     stock_qty: { type: integer }
 *                     is_active: { type: boolean }
 *                     image_url: { type: string }
 *     responses:
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 product: { $ref: '#/components/schemas/Product' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Forbidden - admin/super_admin only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id', authenticate, authorizeAdmin, update);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product (admin/super_admin only, soft delete)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product soft deleted, related images removed from storage, and variants hard deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 product: { $ref: '#/components/schemas/Product' }
 *       403:
 *         description: Forbidden - admin/super_admin only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id', authenticate, authorizeAdmin, remove);

module.exports = router;
