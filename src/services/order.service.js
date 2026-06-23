const { supabaseAdmin } = require('../config/supabase');
const { ORDER_STATUS, PAYMENT_STATUS, PAYMENT_TYPE, VALID_TRANSITIONS } = require('../config/constants');
const {
  generateOrderCode,
  createPaymentLink,
  createPaymentRecord,
  updatePaymentQR,
  findPaymentByIntentId,
} = require('./payment.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Insert an order status log entry for audit trail.
 */
const pushStatusLog = async (orderId, fromStatus, toStatus, source = 'system', changedBy = null) => {
  const { error } = await supabaseAdmin.from('order_status_logs').insert({
    order_id: orderId,
    from_status: fromStatus,
    to_status: toStatus,
    change_source: source,
    changed_by: changedBy,
  });

  if (error) {
    console.error('Failed to insert status log:', error.message);
  }
};

/**
 * Generate an order number in format FLR-YYYYNNNN.
 * Uses Supabase RPC to call nextval on the order_number_seq sequence.
 */
const generateOrderNumber = async () => {
  const year = new Date().getFullYear();

  // Try using the sequence; fall back to timestamp-based if sequence doesn't exist
  try {
    const { data, error } = await supabaseAdmin.rpc('nextval_order_number');
    if (!error && data) {
      return `FLR-${year}${String(data).padStart(4, '0')}`;
    }
  } catch {
    // sequence might not exist yet
  }

  // Fallback: count existing orders this year + 1
  const { count } = await supabaseAdmin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01T00:00:00Z`);

  const seq = (count || 0) + 1;
  return `FLR-${year}${String(seq).padStart(4, '0')}`;
};

// ─── Core Service Methods ─────────────────────────────────────────────────────

/**
 * POST /api/orders — Create a new order from cart items.
 *
 * Flow:
 * 1. Validate cart + address
 * 2. Calculate pricing
 * 3. Create order (status: pending_payment)
 * 4. Create payment record (status: pending)
 * 5. Create PayOS payment link
 * 6. Return order + checkout URL
 *
 * Cart is NOT cleared here — cleared only after webhook confirms payment.
 */
const createOrder = async ({ userId, cartId, paymentOption, addressId, note, voucherCode }) => {
  // 1. Fetch and validate cart
  const { data: cart, error: cartError } = await supabaseAdmin
    .from('carts')
    .select(
      `*, cart_items(
        *,
        products(id, name, slug, sku, base_price, customization_fee, product_type, is_active, deleted_at,
          production_days_min, production_days_max,
          product_images(url, is_primary, sort_order)),
        product_variants(id, sku_suffix, size, color_name, color_hex, additional_price, image_url, is_active)
      )`
    )
    .eq('id', cartId)
    .eq('user_id', userId)
    .single();

  if (cartError || !cart) throw new Error('Cart not found or does not belong to user');
  if (!cart.cart_items || cart.cart_items.length === 0) throw new Error('Cart is empty');

  // Filter active items only
  const rawActiveItems = cart.cart_items.filter(
    (item) =>
      item.products?.is_active !== false &&
      !item.products?.deleted_at &&
      (!item.variant_id || !item.product_variants || item.product_variants.is_active !== false)
  );
  if (rawActiveItems.length === 0) throw new Error('No active items in cart');

  // Recalculate pricing dynamically to ensure live pricing
  const activeItems = rawActiveItems.map((item) => {
    if (item.products) {
      const live_unit_price =
        Number(item.products.base_price) +
        Number(item.product_variants?.additional_price ?? 0);
      const live_line_total =
        (live_unit_price + Number(item.customization_fee)) * item.quantity;
      return {
        ...item,
        unit_price: live_unit_price,
        line_total: live_line_total,
      };
    }
    return item;
  });

  // 2. Fetch and validate address
  const { data: address, error: addrError } = await supabaseAdmin
    .from('user_addresses')
    .select('*')
    .eq('id', addressId)
    .eq('user_id', userId)
    .single();

  if (addrError || !address) throw new Error('Shipping address not found');

  // 3. Calculate pricing
  const subtotal = activeItems.reduce((sum, item) => sum + Number(item.line_total), 0);

  // Validate applied voucher on backend
  let discountAmount = 0;
  let appliedVoucher = null;

  if (voucherCode) {
    const { validateVoucherCode } = require('./discount.service');
    const validation = await validateVoucherCode(voucherCode, subtotal, userId);
    discountAmount = validation.discountAmount;
    
    const { data: v } = await supabaseAdmin
      .from('vouchers')
      .select('id, code')
      .eq('code', validation.code)
      .is('deleted_at', null)
      .single();
    appliedVoucher = v;
  }

  const totalAmount = Math.max(0, subtotal - discountAmount);

  const depositRate = paymentOption === 'full' ? 1.0 : 0.3;
  const depositAmount = Math.ceil(totalAmount * depositRate);
  const remainingAmount = totalAmount - depositAmount;

  // Calculate max production days across all active items
  const prodDays = activeItems.reduce(
    (max, item) => Math.max(max, item.products?.production_days_max || 14),
    0
  ) || 14;

  // 4. Generate order number and code
  const orderNumber = await generateOrderNumber();
  const orderCode = generateOrderCode();

  // 5. Build payment type and stage
  const paymentType =
    paymentOption === 'full' ? PAYMENT_TYPE.FULL_PAYMENT : PAYMENT_TYPE.DEPOSIT;
  const paymentStage =
    paymentOption === 'full' ? 'fully_paid' : 'deposit_pending';

  // 6. Build draft order data
  const draftOrder = {
    order_number: orderNumber,
    user_id: userId,
    subtotal,
    discount_amount: discountAmount,
    applied_voucher_id: appliedVoucher?.id || null,
    total_amount: totalAmount,
    currency: 'VND',
    payment_option: paymentOption,
    deposit_rate: depositRate,
    deposit_amount: depositAmount,
    remaining_amount: remainingAmount,
    payment_stage: paymentStage,
    recipient_name: address.recipient_name,
    recipient_phone: address.phone_number,
    shipping_address: {
      address_line_1: address.address_line_1,
      city: address.city,
      country_code: address.country_code,
      label: address.label,
    },
    customer_note: note || null,
    estimated_production_days: prodDays,
    estimated_delivery: new Date(
      Date.now() + prodDays * 24 * 60 * 60 * 1000
    ).toISOString().split('T')[0],
    items: activeItems.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_snapshot?.sku || 'N/A',
      product_image_url: item.product_snapshot?.image_url || null,
      variant_label: item.product_snapshot?.variant_label || null,
      design_mockup_url: item.product_snapshot?.mockup_image_url || null,
      design_summary: item.product_snapshot?.design_summary || item.product_snapshot?.design_info || null,
      unit_price: item.unit_price,
      customization_fee: item.customization_fee,
      quantity: item.quantity,
      subtotal: item.line_total,
      item_type: item.item_type,
    })),
  };

  // 7. Create payment record with draftOrder metadata
  const payment = await createPaymentRecord({
    userId,
    cartId,
    orderId: null, // Order is not created yet
    orderCode,
    amount: depositAmount,
    paymentType,
    gatewayResponse: { draftOrder },
  });

  // 8. Create PayOS payment link
  const frontendUrl = process.env.FRONTEND_URL || 'https://florlen.id.vn';
  const paymentLink = await createPaymentLink({
    orderCode,
    amount: depositAmount,
    description: `Florlen ${orderNumber}`,
    returnUrl: `${frontendUrl}/checkout/result?orderCode=${orderCode}`,
    cancelUrl: `${frontendUrl}/checkout?cancelled=true`,
  });

  // 9. Update payment with QR code URL
  if (paymentLink.qrCode) {
    await updatePaymentQR(payment.id, paymentLink.qrCode);
  }

  return {
    order: {
      id: null,
      orderNumber,
      status: ORDER_STATUS.PENDING_PAYMENT,
      totalAmount,
      depositAmount,
      remainingAmount,
      paymentOption,
    },
    paymentLink: {
      checkoutUrl: paymentLink.checkoutUrl,
      qrCode: paymentLink.qrCode,
    },
    orderCode,
  };
};

/**
 * GET /api/orders — List orders for authenticated user.
 */
const getOrders = async (userId, { cursor, limit = 20, status } = {}) => {
  let query = supabaseAdmin
    .from('orders')
    .select(
      'id, order_number, status, total_amount, deposit_amount, remaining_amount, payment_option, payment_stage, created_at, estimated_delivery, order_items(product_name, product_image_url, variant_label, unit_price, quantity, subtotal)'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Number(limit) + 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: orders, error } = await query;
  if (error) throw new Error(error.message);

  const hasMore = orders.length > limit;
  if (hasMore) orders.pop();

  const mappedOrders = orders.map((order) => {
    const firstItem = order.order_items?.[0] || {};
    const { order_items: itemsList, ...rest } = order;
    return {
      ...rest,
      product_name: firstItem.product_name || null,
      product_image_url: firstItem.product_image_url || null,
      variant_label: firstItem.variant_label || null,
      order_items: itemsList || [],
    };
  });

  return {
    orders: mappedOrders,
    hasMore,
    nextCursor: hasMore ? mappedOrders[mappedOrders.length - 1].created_at : null,
  };
};

/**
 * GET /api/orders/metrics — Count orders in in_production, shipping, completed statuses.
 */
const getOrderMetrics = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('status')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  const metrics = {
    all: 0,
    in_production: 0,
    shipping: 0,
    completed: 0,
  };

  if (data) {
    metrics.all = data.length;
    data.forEach((order) => {
      if (order.status === ORDER_STATUS.IN_PRODUCTION) {
        metrics.in_production++;
      } else if (order.status === ORDER_STATUS.SHIPPING) {
        metrics.shipping++;
      } else if (order.status === ORDER_STATUS.COMPLETED) {
        metrics.completed++;
      }
    });
  }

  return metrics;
};

/**
 * GET /api/orders/:id — Full order detail for authenticated user.
 */
const getOrderById = async (userId, orderId, isAdmin = false) => {
  let query = supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId);

  if (!isAdmin) {
    query = query.eq('user_id', userId);
  }

  const { data: order, error } = await query.single();

  if (error || !order) throw new Error('Order not found');

  const firstItem = order.order_items?.[0] || {};
  const mappedOrder = {
    ...order,
    product_name: firstItem.product_name || null,
    product_image_url: firstItem.product_image_url || null,
    variant_label: firstItem.variant_label || null,
    unit_price: firstItem.unit_price || null,
    customization_fee: firstItem.customization_fee || null,
    quantity: firstItem.quantity || null,
    subtotal: firstItem.subtotal || null,
  };

  // Fetch status logs
  const { data: statusLogs } = await supabaseAdmin
    .from('order_status_logs')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  // Fetch associated payments
  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('id, payment_type, amount, status, paid_at, qr_code_url, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  return {
    ...mappedOrder,
    status_logs: statusLogs || [],
    payments: payments || [],
  };
};

/**
 * POST /api/orders/:id/cancel — Cancel an order (user-initiated).
 * Only allowed when status is pending_payment.
 */
const cancelOrder = async (userId, orderId) => {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, status, user_id')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single();

  if (error || !order) throw new Error('Order not found');
  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    throw new Error('Order can only be cancelled when status is pending_payment');
  }

  // Update order status
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({
      status: ORDER_STATUS.CANCELLED,
      status_updated_at: new Date().toISOString(),
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
      cancellation_reason: 'Cancelled by customer',
    })
    .eq('id', orderId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  await pushStatusLog(orderId, ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.CANCELLED, 'system', userId);

  return updated;
};

/**
 * POST /api/orders/:id/pay-remaining — Create payment link for remaining 70%.
 * Only when status is awaiting_remaining_payment.
 */
const payRemaining = async (userId, orderId) => {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single();

  if (error || !order) throw new Error('Order not found');
  if (order.status === ORDER_STATUS.COMPLETED || order.status === ORDER_STATUS.CANCELLED) {
    throw new Error('Order is completed or cancelled and cannot be paid');
  }
  if (order.remaining_amount <= 0) {
    throw new Error('No remaining amount to pay');
  }

  const orderCode = generateOrderCode();
  const frontendUrl = process.env.FRONTEND_URL || 'https://florlen.id.vn';

  // Create payment record for remaining balance
  const payment = await createPaymentRecord({
    userId,
    cartId: null,
    orderId: order.id,
    orderCode,
    amount: order.remaining_amount,
    paymentType: PAYMENT_TYPE.REMAINING_BALANCE,
  });

  // Update order with remaining_payment_id
  await supabaseAdmin
    .from('orders')
    .update({ remaining_payment_id: payment.id })
    .eq('id', orderId);

  // Create PayOS link
  const paymentLink = await createPaymentLink({
    orderCode,
    amount: order.remaining_amount,
    description: `Florlen ${order.order_number}`,
    returnUrl: `${frontendUrl}/checkout/result?orderCode=${orderCode}`,
    cancelUrl: `${frontendUrl}/account/orders/${orderId}`,
  });

  if (paymentLink.qrCode) {
    await updatePaymentQR(payment.id, paymentLink.qrCode);
  }

  return {
    paymentLink: {
      checkoutUrl: paymentLink.checkoutUrl,
      qrCode: paymentLink.qrCode,
    },
    orderCode,
    amount: order.remaining_amount,
  };
};

/**
 * Called by PayOS webhook when payment is confirmed.
 * Updates payment + order status, clears cart items.
 *
 * Race condition protection:
 * Uses atomic CAS (Compare-And-Set) — updates payment status from
 * 'pending' → 'processing' only if it is still 'pending'.
 * If two webhooks arrive simultaneously, only one will claim the payment
 * (count > 0). The other will see count = 0 and return idempotent immediately.
 */
const confirmPayment = async (orderCode, amount, gatewayResponse) => {
  // 1. Atomic claim: update status pending → processing WHERE status = 'pending'
  //    This is a distributed lock: only one concurrent call can win this update.
  const { data: claimedPayments, error: claimError } = await supabaseAdmin
    .from('payments')
    .update({ status: PAYMENT_STATUS.PROCESSING })
    .eq('payment_intent_id', String(orderCode))
    .eq('status', PAYMENT_STATUS.PENDING)
    .select('id');

  if (claimError) {
    console.error('[confirmPayment] Failed to claim payment lock:', claimError.message);
    throw new Error(`Failed to claim payment: ${claimError.message}`);
  }

  if (!claimedPayments || claimedPayments.length === 0) {
    // Either already PROCESSING (another concurrent call won the race)
    // or already SUCCEEDED (idempotent). Either way, skip.
    console.log(`[confirmPayment] Payment ${orderCode} already claimed or processed — skipping (idempotent).`);
    return { alreadyProcessed: true };
  }

  // 2. Re-fetch the full payment record now that we own it
  const payment = await findPaymentByIntentId(orderCode);

  let orderId = payment.order_id;
  let newStatus = ORDER_STATUS.CONFIRMED;
  let newPaymentStage = 'fully_paid';
  const updates = {};

  if (!orderId) {
    // Initial payment: order needs to be created now!
    const draftOrder = payment.gateway_response?.draftOrder;
    if (!draftOrder) {
      // Roll back payment claim so it can be retried
      await supabaseAdmin
        .from('payments')
        .update({ status: PAYMENT_STATUS.FAILED })
        .eq('id', payment.id);
      console.error('[confirmPayment] Draft order not found for payment:', payment.id);
      throw new Error('Draft order not found in payment record. Cannot create order.');
    }

    // Insert the order into orders table
    const { data: newOrder, error: newOrderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: draftOrder.order_number,
        user_id: draftOrder.user_id,
        payment_id: payment.id, // link it!
        deposit_payment_id: payment.id,
        status: ORDER_STATUS.CONFIRMED, // paid and confirmed
        subtotal: draftOrder.subtotal,
        discount_amount: draftOrder.discount_amount || 0,
        total_amount: draftOrder.total_amount,
        currency: draftOrder.currency,
        payment_option: draftOrder.payment_option,
        deposit_rate: draftOrder.deposit_rate,
        deposit_amount: draftOrder.deposit_amount,
        remaining_amount: draftOrder.remaining_amount,
        payment_stage: draftOrder.payment_option === 'full' ? 'fully_paid' : 'deposit_paid',
        recipient_name: draftOrder.recipient_name,
        recipient_phone: draftOrder.recipient_phone,
        shipping_address: draftOrder.shipping_address,
        customer_note: draftOrder.customer_note,
        estimated_production_days: draftOrder.estimated_production_days,
        estimated_delivery: draftOrder.estimated_delivery,
        deposit_paid_at: new Date().toISOString()
      })
      .select()
      .single();

    if (newOrderError || !newOrder) {
      // Roll back payment claim so the state is clear for investigation
      await supabaseAdmin
        .from('payments')
        .update({ status: PAYMENT_STATUS.FAILED })
        .eq('id', payment.id);
      console.error('[confirmPayment] Failed to create order on payment confirmation:', newOrderError?.message);
      throw new Error(`Failed to create order: ${newOrderError?.message || 'Unknown error'}`);
    }

    orderId = newOrder.id;

    // Insert order items
    if (draftOrder.items && draftOrder.items.length > 0) {
      const orderItemsToInsert = draftOrder.items.map((item) => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        product_image_url: item.product_image_url,
        variant_label: item.variant_label,
        design_mockup_url: item.design_mockup_url,
        design_summary: item.design_summary,
        unit_price: item.unit_price,
        customization_fee: item.customization_fee,
        quantity: item.quantity,
        subtotal: item.subtotal,
        item_type: item.item_type,
      }));

      const { error: insertItemsErr } = await supabaseAdmin
        .from('order_items')
        .insert(orderItemsToInsert);

      if (insertItemsErr) {
        console.error('Failed to insert order items:', insertItemsErr.message);
      }
    }

    // Insert order status logs
    await pushStatusLog(orderId, null, ORDER_STATUS.PENDING_PAYMENT, 'system');
    await pushStatusLog(orderId, ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.CONFIRMED, 'webhook');

    // Handle voucher usage logging and count increment
    if (draftOrder.applied_voucher_id) {
      try {
        const { data: v } = await supabaseAdmin
          .from('vouchers')
          .select('used_count')
          .eq('id', draftOrder.applied_voucher_id)
          .single();
        if (v) {
          await supabaseAdmin
            .from('vouchers')
            .update({ used_count: (v.used_count || 0) + 1 })
            .eq('id', draftOrder.applied_voucher_id);
        }

        // Track usage for this account
        await supabaseAdmin
          .from('user_voucher_usages')
          .insert({
            user_id: draftOrder.user_id,
            voucher_id: draftOrder.applied_voucher_id,
            order_id: orderId
          });
      } catch (vErr) {
        console.error('Failed to register voucher usage details:', vErr.message || vErr);
      }
    }

    // Update the payment record with the new orderId and merge/save webhook response
    const mergedGatewayResponse = {
      ...payment.gateway_response,
      webhook_response: gatewayResponse
    };

    await supabaseAdmin
      .from('payments')
      .update({
        order_id: orderId,
        status: PAYMENT_STATUS.SUCCEEDED,
        gateway_response: mergedGatewayResponse,
        paid_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    newStatus = ORDER_STATUS.CONFIRMED;
  } else {
    // This is a payment for an existing order (like remaining_balance)
    // 2. Update payment status
    const mergedGatewayResponse = {
      ...payment.gateway_response,
      webhook_response: gatewayResponse
    };
    await supabaseAdmin
      .from('payments')
      .update({
        status: PAYMENT_STATUS.SUCCEEDED,
        gateway_response: mergedGatewayResponse,
        paid_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    // 3. Find the associated order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[confirmPayment] Order not found for payment:', orderId);
      throw new Error(`Order ${orderId} not found when confirming remaining payment`);
    }

    newStatus = order.status;
    newPaymentStage = order.payment_stage;

    if (payment.payment_type === PAYMENT_TYPE.REMAINING_BALANCE) {
      newPaymentStage = 'fully_paid';
      updates.remaining_paid_at = new Date().toISOString();
      if (order.status === 'awaiting_remaining_payment') {
        newStatus = ORDER_STATUS.READY_TO_SHIP;
      }
    }

    // 5. Update order
    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update({
        status: newStatus,
        status_updated_at: new Date().toISOString(),
        payment_stage: newPaymentStage,
        ...updates,
      })
      .eq('id', order.id);

    if (updateErr) {
      console.error('Failed to update order:', updateErr.message);
    }

    // 6. Insert status log
    if (newStatus !== order.status) {
      await pushStatusLog(order.id, order.status, newStatus, 'webhook');
    }
  }

  // 7. Clear cart items (only for initial payment, not remaining balance)
  if (
    payment.payment_type !== PAYMENT_TYPE.REMAINING_BALANCE &&
    payment.cart_id
  ) {
    try {
      // 1. Set cart_id to null on all payments referencing this cart to prevent foreign key violation
      const { error: updatePaymentsErr } = await supabaseAdmin
        .from('payments')
        .update({ cart_id: null })
        .eq('cart_id', payment.cart_id);

      if (updatePaymentsErr) {
        console.error('Failed to nullify cart_id in payments:', updatePaymentsErr.message);
      }

      // 2. Delete cart items
      const { error: deleteItemsErr } = await supabaseAdmin
        .from('cart_items')
        .delete()
        .eq('cart_id', payment.cart_id);

      if (deleteItemsErr) {
        console.error('Failed to delete cart items:', deleteItemsErr.message);
      }

      // 3. Delete the empty cart itself
      const { error: deleteCartErr } = await supabaseAdmin
        .from('carts')
        .delete()
        .eq('id', payment.cart_id);

      if (deleteCartErr) {
        console.error('Failed to delete cart:', deleteCartErr.message);
      }
    } catch (err) {
      console.error('Error during cart clearing:', err.message || err);
    }
  }

  return { alreadyProcessed: false, orderId, newStatus };
};

/**
 * GET /api/admin/orders — List all orders in the system with pagination, searching, sorting and filtering.
 */
const getAllOrdersAdmin = async ({
  cursor,
  limit = 20,
  status,
  paymentStage,
  userId,
  startDate,
  endDate,
  search,
}) => {
  let query = supabaseAdmin
    .from('orders')
    .select(
      'id, order_number, status, total_amount, deposit_amount, remaining_amount, payment_option, payment_stage, created_at, estimated_delivery, recipient_name, recipient_phone, user_id, order_items(product_name, product_image_url, variant_label)'
    )
    .order('created_at', { ascending: false })
    .limit(Number(limit) + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  // Filters
  if (status) {
    query = query.eq('status', status);
  }
  if (paymentStage) {
    query = query.eq('payment_stage', paymentStage);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }
  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  // Search by order number, recipient name, or recipient phone
  if (search) {
    query = query.or(
      `order_number.ilike.%${search}%,recipient_name.ilike.%${search}%,recipient_phone.ilike.%${search}%`
    );
  }

  const { data: orders, error } = await query;
  if (error) throw new Error(error.message);

  const hasMore = orders.length > limit;
  if (hasMore) orders.pop();

  const mappedOrders = orders.map((order) => {
    const firstItem = order.order_items?.[0] || {};
    const { order_items: itemsList, ...rest } = order;
    return {
      ...rest,
      product_name: firstItem.product_name || null,
      product_image_url: firstItem.product_image_url || null,
      variant_label: firstItem.variant_label || null,
      order_items: itemsList || [],
    };
  });

  return {
    orders: mappedOrders,
    hasMore,
    nextCursor: hasMore ? mappedOrders[mappedOrders.length - 1].created_at : null,
  };
};

/**
 * PATCH /api/admin/orders/:id/status — Update order status manually by admin (obeys state transitions).
 */
const updateOrderStatusAdmin = async (orderId, newStatus, changedBy) => {
  // 1. Fetch order
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !order) throw new Error('Order not found');

  const oldStatus = order.status;

  // If status is identical, return it (idempotent)
  if (oldStatus === newStatus) {
    return order;
  }

  // 2. Validate state transition
  const allowedNext = VALID_TRANSITIONS[oldStatus];
  if (!allowedNext || !allowedNext.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
  }

  // 3. Prepare updates
  const updates = {
    status: newStatus,
    status_updated_at: new Date().toISOString(),
  };

  // Handle special status transition side effects
  if (newStatus === ORDER_STATUS.CANCELLED) {
    updates.cancelled_at = new Date().toISOString();
    updates.cancelled_by = changedBy;
    updates.cancellation_reason = 'Cancelled by administrator';
  } else if (newStatus === ORDER_STATUS.COMPLETED) {
    updates.completed_at = new Date().toISOString();
  }

  // 4. Perform update
  const { data: updatedOrder, error: updateError } = await supabaseAdmin
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  // 5. Log status change
  await pushStatusLog(orderId, oldStatus, newStatus, 'admin', changedBy);

  return updatedOrder;
};

module.exports = {
  createOrder,
  getOrders,
  getOrderMetrics,
  getOrderById,
  cancelOrder,
  payRemaining,
  confirmPayment,
  pushStatusLog,
  getAllOrdersAdmin,
  updateOrderStatusAdmin,
};
