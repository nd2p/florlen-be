const express = require('express');
const {
  getProducts,
  getProduct,
  uploadImages,
  create,
  update,
  remove,
} = require('../controllers/product.controller');
const { authenticate } = require('../middlewares/authenticate');
const { authorizeAdmin } = require('../middlewares/authorize');
const multer = require('multer');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 20,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png']);
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Only JPEG, JPG, and PNG images are allowed');
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  },
});

/**
 * @swagger
 * /api/products/images/upload:
 *   post:
 *     summary: Upload product images to Supabase Storage (admin/super_admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *             required: [images]
 *     responses:
 *       201:
 *         description: Images uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       bucket: { type: string }
 *                       url: { type: string }
 *                       storage_path: { type: string }
 *                       original_name: { type: string }
 *                       mime_type: { type: string }
 *                       size: { type: integer }
 *       400:
 *         description: Upload validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Forbidden - admin/super_admin only
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post(
  '/images/upload',
  authenticate,
  authorizeAdmin,
  upload.array('images', 20),
  uploadImages
);

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
 *         schema: { type: string, enum: [ai_base, physical, digital] }
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
 *               sku: { type: string }
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               short_description: { type: string }
 *               product_type: { type: string, enum: [ai_base, physical, digital] }
 *               base_price: { type: number }
 *               customization_fee: { type: number }
 *               production_days_min: { type: integer }
 *               production_days_max: { type: integer }
 *               is_active: { type: boolean, default: true }
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
 *             required: [sku, name, slug, product_type, base_price, production_days_min, production_days_max, images, variants]
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
 *               name: { type: string }
 *               description: { type: string }
 *               short_description: { type: string }
 *               base_price: { type: number }
 *               customization_fee: { type: number }
 *               production_days_min: { type: integer }
 *               production_days_max: { type: integer }
 *               is_active: { type: boolean }
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
 *         description: Product deleted (soft delete - is_active set to false)
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
