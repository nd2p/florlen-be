const { PayOS } = require('@payos/node');
const { supabaseAdmin } = require('../config/supabase');
const { PAYMENT_STATUS } = require('../config/constants');

// ─── PayOS Initialization ─────────────────────────────────────────────────────

let payos = null;

/**
 * Lazy-initialize PayOS client.
 * Fails fast if credentials are missing.
 */
const getPayOS = () => {
  if (payos) return payos;

  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

  if (!clientId || !apiKey || !checksumKey) {
    throw new Error(
      'PayOS credentials missing. Set PAYOS_CLIENT_ID, PAYOS_API_KEY, and PAYOS_CHECKSUM_KEY in .env'
    );
  }

  payos = new PayOS({ clientId, apiKey, checksumKey });
  return payos;
};

// ─── Order Code Generation ────────────────────────────────────────────────────

/**
 * Generate a unique positive integer orderCode for PayOS.
 * PayOS requires orderCode to be a positive integer (not UUID).
 * Uses timestamp (ms) truncated to fit within safe integer range + random suffix.
 */
const generateOrderCode = () => {
  // Use last 10 digits of timestamp + 3-digit random → 13-digit integer
  const ts = Date.now() % 10000000000; // last 10 digits
  const rand = Math.floor(100 + Math.random() * 900); // 3-digit random
  return Number(`${ts}${rand}`);
};

// ─── PayOS Payment Link ───────────────────────────────────────────────────────

/**
 * Create a PayOS payment link.
 *
 * @param {Object} params
 * @param {number} params.orderCode — unique positive integer
 * @param {number} params.amount — VND integer amount
 * @param {string} params.description — max 25 chars
 * @param {string} params.returnUrl — redirect URL after payment
 * @param {string} params.cancelUrl — redirect URL if cancelled
 * @returns {Promise<{checkoutUrl: string, qrCode: string}>}
 */
const createPaymentLink = async ({ orderCode, amount, description, returnUrl, cancelUrl }) => {
  const client = getPayOS();

  // PayOS description max 25 chars
  const trimmedDesc = description.length > 25 ? description.slice(0, 25) : description;

  const paymentData = {
    orderCode,
    amount: Math.round(amount), // PayOS requires integer VND
    description: trimmedDesc,
    returnUrl,
    cancelUrl,
  };

  const result = await client.paymentRequests.create(paymentData);

  return {
    checkoutUrl: result.checkoutUrl,
    qrCode: result.qrCode || null,
  };
};

// ─── Webhook Verification ─────────────────────────────────────────────────────

/**
 * Verify PayOS webhook data checksum.
 * @param {Object} webhookBody — raw webhook payload
 * @returns {Object} — verified webhook data
 */
const verifyWebhookData = (webhookBody) => {
  const client = getPayOS();
  return client.webhooks.verify(webhookBody);
};

// ─── Payment Record Management ────────────────────────────────────────────────

/**
 * Insert a new payment record into the payments table.
 */
const createPaymentRecord = async ({
  userId,
  cartId,
  orderId,
  orderCode,
  amount,
  paymentType,
  paymentMethod = 'payos_qr',
  gateway = 'payos',
  gatewayResponse = null,
}) => {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert({
      user_id: userId,
      cart_id: cartId,
      order_id: orderId,
      payment_intent_id: String(orderCode),
      payment_type: paymentType,
      payment_method: paymentMethod,
      gateway,
      amount,
      currency: 'VND',
      status: PAYMENT_STATUS.PENDING,
      gateway_response: gatewayResponse,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create payment record: ${error.message}`);
  return data;
};

/**
 * Update payment status and gateway response after webhook.
 */
const updatePaymentStatus = async (paymentIntentId, status, gatewayResponse = null) => {
  const updates = {
    status,
    gateway_response: gatewayResponse,
    ...(status === PAYMENT_STATUS.SUCCEEDED ? { paid_at: new Date().toISOString() } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from('payments')
    .update(updates)
    .eq('payment_intent_id', String(paymentIntentId))
    .select()
    .single();

  if (error) throw new Error(`Failed to update payment: ${error.message}`);
  return data;
};

/**
 * Update payment record with QR code URL from PayOS.
 */
const updatePaymentQR = async (paymentId, qrCodeUrl) => {
  const { error } = await supabaseAdmin
    .from('payments')
    .update({ qr_code_url: qrCodeUrl })
    .eq('id', paymentId);

  if (error) throw new Error(`Failed to update payment QR: ${error.message}`);
};

/**
 * Find a payment by its PayOS orderCode (stored as payment_intent_id).
 */
const findPaymentByIntentId = async (paymentIntentId) => {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('payment_intent_id', String(paymentIntentId))
    .single();

  if (error) throw new Error(`Payment not found: ${error.message}`);
  return data;
};

const getPaymentLogs = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select(`
      id,
      payment_intent_id,
      payment_type,
      payment_method,
      gateway,
      amount,
      currency,
      status,
      paid_at,
      qr_code_url,
      created_at,
      order_id,
      orders!fk_payments_order (
        order_number
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch payment logs: ${error.message}`);
  return data;
};

module.exports = {
  getPayOS,
  generateOrderCode,
  createPaymentLink,
  verifyWebhookData,
  createPaymentRecord,
  updatePaymentStatus,
  updatePaymentQR,
  findPaymentByIntentId,
  getPaymentLogs,
};
