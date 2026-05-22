const { verifyWebhookData } = require('../services/payment.service');
const { confirmPayment } = require('../services/order.service');

/**
 * POST /api/webhooks/payos
 *
 * PayOS sends webhook notifications when payment status changes.
 * This handler:
 * 1. Verifies the webhook signature (checksum)
 * 2. Processes PAID status → confirms payment, updates order, clears cart
 * 3. Returns 200 to acknowledge receipt
 *
 * No authentication middleware — PayOS calls this endpoint directly.
 * Security is ensured by checksum verification.
 */
const handlePayOSWebhook = async (req, res) => {
  try {
    // Parse body — may arrive as raw buffer or parsed JSON
    let webhookBody = req.body;
    if (Buffer.isBuffer(webhookBody)) {
      webhookBody = JSON.parse(webhookBody.toString());
    }

    // Verify checksum
    let verifiedData;
    try {
      verifiedData = verifyWebhookData(webhookBody);
    } catch (verifyError) {
      console.error('PayOS webhook verification failed:', verifyError.message);
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const { orderCode, amount, description, code } = verifiedData;

    console.log(
      `[PayOS Webhook] orderCode=${orderCode}, amount=${amount}, code=${code}, desc=${description}`
    );

    // PayOS uses code "00" for successful payment
    if (code === '00') {
      const result = await confirmPayment(orderCode, amount, verifiedData);

      if (result.alreadyProcessed) {
        console.log(`[PayOS Webhook] Payment ${orderCode} already processed (idempotent)`);
      } else {
        console.log(
          `[PayOS Webhook] Payment ${orderCode} confirmed → order ${result.orderId} status: ${result.newStatus}`
        );
      }
    } else {
      console.log(`[PayOS Webhook] Payment ${orderCode} — non-success code: ${code}`);
    }

    // Always return 200 to acknowledge receipt (PayOS retries on non-2xx)
    return res.json({ success: true });
  } catch (error) {
    console.error('PayOS webhook error:', error);
    // Still return 200 to prevent PayOS from retrying on application errors
    // Log the error for investigation
    return res.json({ success: true });
  }
};

module.exports = {
  handlePayOSWebhook,
};
