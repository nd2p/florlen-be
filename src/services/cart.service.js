const { supabaseAdmin } = require('../config/supabase');

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch a cart (with its items) by user_id or session_id.
 * Returns null when not found.
 */
const findCart = async ({ userId, sessionId }) => {
  let query = supabaseAdmin.from('carts').select(
    `*, cart_items(
        *,
        products(id, name, slug, base_price, customization_fee, product_type, is_active, deleted_at,
          product_images(url, is_primary, sort_order)),
        product_variants(id, sku_suffix, size, color_name, color_hex, additional_price, image_url)
      )`
  );

  if (userId) {
    query = query.eq('user_id', userId);
  } else if (sessionId) {
    query = query.eq('session_id', sessionId);
  } else {
    throw new Error('userId or sessionId is required');
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

/**
 * Get-or-create a cart for the given owner.
 */
const getOrCreateCart = async ({ userId, sessionId }) => {
  const existing = await findCart({ userId, sessionId });
  if (existing) return existing;

  const cartPayload = userId
    ? { user_id: userId }
    : {
        session_id: sessionId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

  const { data, error } = await supabaseAdmin.from('carts').insert(cartPayload).select().single();

  if (error) throw new Error(error.message);

  // Attach empty cart_items array so callers always get consistent shape
  data.cart_items = [];
  return data;
};

/**
 * Build the price snapshot object that goes into cart_items.product_snapshot.
 */
const buildProductSnapshot = (product, variant) => ({
  sku: product.sku,
  name: product.name,
  slug: product.slug,
  product_type: product.product_type,
  base_price: product.base_price,
  customization_fee: product.customization_fee ?? 0,
  production_days_min: product.production_days_min,
  production_days_max: product.production_days_max,
  image_url: (product.product_images ?? []).find((img) => img.is_primary)?.url ?? null,
  variant_label: variant ? [variant.size, variant.color_name].filter(Boolean).join(' / ') : null,
  variant_sku_suffix: variant?.sku_suffix ?? null,
});

// ─── service methods ──────────────────────────────────────────────────────────

/**
 * GET /api/cart
 * Returns the cart (with items) for the authenticated user or guest session.
 */
const getCart = async ({ userId, sessionId }) => {
  const cart = await getOrCreateCart({ userId, sessionId });
  return cart;
};

/**
 * POST /api/cart/items
 * Add a normal product (with optional variant) or a finalised AI design to cart.
 *
 * Body schema:
 *   item_type        'normal' | 'ai_personalization'
 *   product_id       UUID (required for normal)
 *   variant_id       UUID (optional for normal)
 *   quantity         integer >= 1 (default 1)
 *   design_id        UUID (required for ai_personalization)
 */
const addItem = async ({ userId, sessionId }, itemData) => {
  const { item_type, product_id, variant_id, quantity = 1, design_id } = itemData;

  if (!['normal', 'ai_personalization'].includes(item_type)) {
    throw new Error('item_type must be "normal" or "ai_personalization"');
  }
  if (quantity < 1) throw new Error('quantity must be >= 1');

  const cart = await getOrCreateCart({ userId, sessionId });

  // ── Fetch product & variant to snapshot prices ──
  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .select('*, product_images(url, is_primary, sort_order)')
    .eq('id', product_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (productError || !product) throw new Error('Product not found or inactive');

  let variant = null;
  if (variant_id) {
    const { data: v, error: vError } = await supabaseAdmin
      .from('product_variants')
      .select('*')
      .eq('id', variant_id)
      .eq('product_id', product_id)
      .eq('is_active', true)
      .single();

    if (vError || !v) throw new Error('Variant not found or inactive');
    variant = v;
  }

  // ── Validate design for AI items ──
  if (item_type === 'ai_personalization') {
    if (!design_id) throw new Error('design_id is required for ai_personalization items');
    const { data: design, error: designError } = await supabaseAdmin
      .from('designs')
      .select('id, status, mockup_image_url')
      .eq('id', design_id)
      .single();

    if (designError || !design) throw new Error('Design not found');
    if (design.status !== 'ready' && design.status !== 'finalized') {
      throw new Error('Design must be in "ready" or "finalized" status to add to cart');
    }
  }

  // ── Compute pricing ──
  const unit_price = Number(product.base_price) + Number(variant?.additional_price ?? 0);
  const customization_fee =
    item_type === 'ai_personalization' ? Number(product.customization_fee ?? 0) : 0;
  const line_total = (unit_price + customization_fee) * quantity;

  const snapshot = buildProductSnapshot(product, variant);

  // ── Insert cart item ──
  const { data: item, error: insertError } = await supabaseAdmin
    .from('cart_items')
    .insert({
      cart_id: cart.id,
      item_type,
      product_id,
      variant_id: variant_id || null,
      quantity,
      design_id: design_id || null,
      unit_price,
      customization_fee,
      line_total,
      product_name: product.name,
      product_snapshot: snapshot,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  // Touch cart updated_at
  await supabaseAdmin
    .from('carts')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', cart.id);

  return item;
};

/**
 * PATCH /api/cart/items/:itemId
 * Update quantity of a cart item.
 * Recalculates line_total based on stored unit_price + customization_fee.
 */
const updateItemQuantity = async ({ userId, sessionId }, itemId, quantity) => {
  if (quantity < 1) throw new Error('quantity must be >= 1');

  const cart = await findCart({ userId, sessionId });
  if (!cart) throw new Error('Cart not found');

  // Verify item belongs to this cart
  const { data: item, error: fetchError } = await supabaseAdmin
    .from('cart_items')
    .select('*, products(is_active, deleted_at)')
    .eq('id', itemId)
    .eq('cart_id', cart.id)
    .single();

  if (fetchError || !item) throw new Error('Cart item not found');

  if (!item.products?.is_active || item.products?.deleted_at) {
    throw new Error('Product is no longer available or inactive');
  }

  const line_total = (Number(item.unit_price) + Number(item.customization_fee)) * quantity;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('cart_items')
    .update({ quantity, line_total })
    .eq('id', itemId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  await supabaseAdmin
    .from('carts')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', cart.id);

  return updated;
};

/**
 * DELETE /api/cart/items/:itemId
 * Remove a single item from the cart.
 */
const removeItem = async ({ userId, sessionId }, itemId) => {
  const cart = await findCart({ userId, sessionId });
  if (!cart) throw new Error('Cart not found');

  const { error } = await supabaseAdmin
    .from('cart_items')
    .delete()
    .eq('id', itemId)
    .eq('cart_id', cart.id);

  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from('carts')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', cart.id);
};

/**
 * POST /api/cart/merge
 * After login: merge guest cart items into the authenticated user's cart.
 * Existing items in the user cart are kept; guest items with the same
 * product+variant combo increment their quantity.
 * The guest cart is deleted on success.
 */
const mergeCart = async (userId, sessionId) => {
  if (!userId || !sessionId) throw new Error('userId and sessionId are required');

  const guestCart = await findCart({ sessionId });
  if (!guestCart || !guestCart.cart_items?.length) return { merged: 0 };

  const userCart = await getOrCreateCart({ userId });

  // Build a map of existing user cart items (product_id+variant_id or ai:design_id as key)
  const existingKeys = new Map(
    (userCart.cart_items ?? []).map((ci) => {
      const key = ci.item_type === 'ai_personalization'
        ? `ai:${ci.design_id}`
        : `${ci.product_id}:${ci.variant_id ?? 'none'}`;
      return [key, ci];
    })
  );

  let merged = 0;

  for (const guestItem of guestCart.cart_items) {
    const key = guestItem.item_type === 'ai_personalization'
      ? `ai:${guestItem.design_id}`
      : `${guestItem.product_id}:${guestItem.variant_id ?? 'none'}`;
    const existing = existingKeys.get(key);

    if (existing) {
      // Increment quantity on existing item
      const newQty = existing.quantity + guestItem.quantity;
      const newLineTotal =
        (Number(existing.unit_price) + Number(existing.customization_fee)) * newQty;
      const { error: updateError } = await supabaseAdmin
        .from('cart_items')
        .update({ quantity: newQty, line_total: newLineTotal })
        .eq('id', existing.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      // Insert as new item in user cart
      const insertPayload = {
        cart_id: userCart.id,
        item_type: guestItem.item_type,
        product_id: guestItem.product_id,
        variant_id: guestItem.variant_id || null,
        quantity: guestItem.quantity,
        design_id: guestItem.design_id || null,
        unit_price: guestItem.unit_price,
        customization_fee: guestItem.customization_fee,
        line_total: guestItem.line_total,
        product_name: guestItem.product_name,
        product_snapshot: guestItem.product_snapshot,
      };
      const { error: insertError } = await supabaseAdmin
        .from('cart_items')
        .insert(insertPayload);
      if (insertError) throw new Error(insertError.message);
    }
    merged++;
  }

  // Delete the guest cart (cascade deletes remaining cart_items)
  const { error: deleteError } = await supabaseAdmin.from('carts').delete().eq('id', guestCart.id);
  if (deleteError) throw new Error(deleteError.message);

  const { error: touchError } = await supabaseAdmin
    .from('carts')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', userCart.id);
  if (touchError) throw new Error(touchError.message);

  return { merged };
};

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  mergeCart,
};
