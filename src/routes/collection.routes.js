const express = require('express');
const {
  getCollections,
  getCollection,
  create,
  update,
  remove,
  addProducts,
  removeProduct,
  updateProductSort,
} = require('../controllers/collection.controller');
const { authenticate } = require('../middlewares/authenticate');
const { authorizeAdmin } = require('../middlewares/authorize');

const router = express.Router();

/**
 * @swagger
 * /api/collections:
 *   get:
 *     summary: List collections with pagination and filters
 *     tags: [Collections]
 *     parameters:
 *       - name: cursor
 *         in: query
 *         schema: { type: string }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: type
 *         in: query
 *         schema: { type: string }
 *       - name: is_featured
 *         in: query
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of collections
 */
router.get('/', getCollections);

/**
 * @swagger
 * /api/collections/{id}:
 *   get:
 *     summary: Get collection by ID with products
 *     tags: [Collections]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Collection detail
 *       404:
 *         description: Collection not found
 */
router.get('/:id', getCollection);

/**
 * @swagger
 * /api/collections:
 *   post:
 *     summary: Create new collection (admin only)
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               collection_type: { type: string }
 *               is_active: { type: boolean }
 *               is_featured: { type: boolean }
 *               starts_at: { type: string, format: date-time }
 *               ends_at: { type: string, format: date-time }
 *               cover_image_url: { type: string }
 *               banner_image_url: { type: string }
 *             required: [name, slug, collection_type]
 *     responses:
 *       201:
 *         description: Collection created
 *       403:
 *         description: Forbidden - admin only
 */
router.post('/', authenticate, authorizeAdmin, create);

/**
 * @swagger
 * /api/collections/{id}:
 *   patch:
 *     summary: Update collection (admin only)
 *     tags: [Collections]
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
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               collection_type: { type: string }
 *               is_active: { type: boolean }
 *               is_featured: { type: boolean }
 *               starts_at: { type: string, format: date-time }
 *               ends_at: { type: string, format: date-time }
 *               countdown_visible: { type: boolean }
 *               meta_title: { type: string }
 *               meta_description: { type: string }
 *               cover_image_url: { type: string }
 *               banner_image_url: { type: string }
 *               sort_order: { type: integer }
 *     responses:
 *       200:
 *         description: Collection updated
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden - admin only
 *       404:
 *         description: Collection not found
 */
router.patch('/:id', authenticate, authorizeAdmin, update);

/**
 * @swagger
 * /api/collections/{id}:
 *   delete:
 *     summary: Delete collection (admin only)
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticate, authorizeAdmin, remove);

/**
 * @swagger
 * /api/collections/{id}/products:
 *   post:
 *     summary: Add products to collection (admin only)
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_ids:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *             required: [product_ids]
 */
router.post('/:id/products', authenticate, authorizeAdmin, addProducts);

/**
 * @swagger
 * /api/collections/{id}/products/{productId}:
 *   delete:
 *     summary: Remove product from collection (admin only)
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id/products/:productId', authenticate, authorizeAdmin, removeProduct);

/**
 * @swagger
 * /api/collections/{id}/products/{productId}/sort:
 *   patch:
 *     summary: Update product sort order in collection (admin only)
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/products/:productId/sort', authenticate, authorizeAdmin, updateProductSort);

module.exports = router;
