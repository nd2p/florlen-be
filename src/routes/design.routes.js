const express = require('express');
const {
  listDesignsHandler,
  getDesignByIdHandler,
  generateDesignHandler,
  saveDesignDraftHandler,
  finalizeDesignHandler,
  finalizeExistingDesignHandler,
  deleteDesignHandler,
  getDailyLimitHandler,
  getAIConfigHandler,
} = require('../controllers/design.controller');
const { authenticate } = require('../middlewares/authenticate');

const router = express.Router();

router.get('/config', authenticate, getAIConfigHandler);

/**
 * @swagger
 * tags:
 *   name: Designs
 *   description: AI Mockup Design management (authenticated users only)
 */

/**
 * @swagger
 * /api/designs:
 *   get:
 *     summary: Lấy danh sách các bản thiết kế của người dùng
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách bản thiết kế đã được tải
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 resources:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Design'
 */
router.get('/', authenticate, listDesignsHandler);

/**
 * @swagger
 * /api/designs/daily-limit:
 *   get:
 *     summary: Lấy giới hạn và số lượng thiết kế đã tạo trong ngày của người dùng
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đã lấy thông tin giới hạn ngày thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 resource:
 *                   type: object
 *                   properties:
 *                     count: { type: integer }
 *                     limit: { type: integer }
 */
router.get('/daily-limit', authenticate, getDailyLimitHandler);

/**
 * @swagger
 * /api/designs/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết một bản thiết kế cụ thể
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Thông tin chi tiết của bản thiết kế
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 resource: { $ref: '#/components/schemas/Design' }
 */
router.get('/:id', authenticate, getDesignByIdHandler);

/**
 * @swagger
 * /api/designs/generate:
 *   post:
 *     summary: Khởi tạo tạo thử nghiệm mockup AI (Ephemeral - Không lưu DB)
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productType]
 *             properties:
 *               productType:
 *                 type: string
 *                 enum: [mini_figure, tui, mu]
 *               options:
 *                 type: object
 *               customPrompt:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Thiết kế thử nghiệm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 resource:
 *                   type: object
 *                   properties:
 *                     mockup_image_url: { type: string }
 *                     ai_prompt_used: { type: string }
 *                     color_palette: { type: array, items: { type: string } }
 *                     material_suggestions: { type: array, items: { type: string } }
 *                     customization_fee: { type: number }
 *                     prompt_text: { type: string }
 */
router.post('/generate', authenticate, generateDesignHandler);

/**
 * @swagger
 * /api/designs/save:
 *   post:
 *     summary: Lưu bản vẽ thành bản nháp (DRAFT) vào thư viện (Kiểm tra giới hạn tạo theo ngày)
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productType, mockupImageUrl, customizationFee]
 *             properties:
 *               productType: { type: string }
 *               options: { type: object }
 *               customPrompt: { type: string }
 *               mockupImageUrl: { type: string }
 *               aiPromptUsed: { type: string }
 *               colorPalette: { type: array, items: { type: string } }
 *               materialSuggestions: { type: array, items: { type: string } }
 *               customizationFee: { type: number }
 *               attempts: { type: integer }
 *     responses:
 *       201:
 *         description: Đã lưu bản nháp thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 resource: { $ref: '#/components/schemas/Design' }
 */
router.post('/save', authenticate, saveDesignDraftHandler);

/**
 * @swagger
 * /api/designs/finalize:
 *   post:
 *     summary: Khóa bản vẽ và thêm thẳng vào giỏ hàng (Chuyển sang FINALIZED) từ phiên sinh ảnh
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productType, mockupImageUrl, customizationFee]
 *     responses:
 *       201:
 *         description: Khóa bản vẽ và thêm vào giỏ hàng thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 resource: { $ref: '#/components/schemas/Design' }
 *                 cartItem: { $ref: '#/components/schemas/CartItem' }
 */
router.post('/finalize', authenticate, finalizeDesignHandler);

/**
 * @swagger
 * /api/designs/{id}/finalize:
 *   post:
 *     summary: Khóa bản vẽ và thêm vào giỏ hàng từ một bản thiết kế nháp SẴN CÓ trong thư viện
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Thêm thành công bản thiết kế nháp có sẵn vào giỏ hàng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 resource: { $ref: '#/components/schemas/Design' }
 *                 cartItem: { $ref: '#/components/schemas/CartItem' }
 */
router.post('/:id/finalize', authenticate, finalizeExistingDesignHandler);

/**
 * @swagger
 * /api/designs/{id}:
 *   delete:
 *     summary: Xóa bản thiết kế nháp khỏi thư viện
 *     tags: [Designs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
router.delete('/:id', authenticate, deleteDesignHandler);

module.exports = router;
