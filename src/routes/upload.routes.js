const express = require('express');
const multer = require('multer');
const { uploadImages } = require('../controllers/upload.controller');
const { authenticate } = require('../middlewares/authenticate');

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
 * /api/uploads:
 *   post:
 *     summary: Upload images to Supabase Storage by type
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [product, collection, reference, blog, mockup]
 *         description: Upload type (controls bucket and permissions)
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
 *                       type: { type: string }
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
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', authenticate, upload.array('images', 20), uploadImages);

module.exports = router;
