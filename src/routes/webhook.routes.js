const express = require('express');
const router = express.Router();
const { handlePayOSWebhook } = require('../controllers/webhook.controller');

/**
 * @swagger
 * /api/webhooks/payos:
 *   post:
 *     summary: PayOS payment webhook callback
 *     tags: [Webhooks]
 *     description: |
 *       Receives payment status notifications from PayOS.
 *       No authentication required — security is via checksum verification.
 *       Configure this URL in PayOS Dashboard → Webhook URL.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: "00 = success"
 *               desc:
 *                 type: string
 *               data:
 *                 type: object
 *                 properties:
 *                   orderCode:
 *                     type: integer
 *                   amount:
 *                     type: integer
 *                   description:
 *                     type: string
 *                   accountNumber:
 *                     type: string
 *                   reference:
 *                     type: string
 *                   transactionDateTime:
 *                     type: string
 *                   currency:
 *                     type: string
 *                   paymentLinkId:
 *                     type: string
 *                   code:
 *                     type: string
 *                   desc:
 *                     type: string
 *               signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Invalid signature
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.post('/payos', handlePayOSWebhook);

module.exports = router;
