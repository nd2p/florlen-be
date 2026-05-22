-- supabase/migrations/20260428140018_019_create_checkout_function.sql
-- Postgres function chạy checkout trong 1 transaction atomic

CREATE OR REPLACE FUNCTION public.process_checkout(
  p_user_id          UUID,
  p_cart_id          UUID,
  p_recipient_name   VARCHAR,
  p_recipient_phone  VARCHAR,
  p_shipping_address JSONB,
  p_payment_option   TEXT,
  p_customer_note    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cart                public.carts%ROWTYPE;
  v_order_id            UUID;
  v_order_number        TEXT;
  v_order_code          BIGINT;
  v_subtotal            NUMERIC;
  v_total_items         INTEGER;
  v_deposit_amount      NUMERIC;
  v_remaining_amount    NUMERIC;
  v_estimated_prod_days INTEGER;
BEGIN
  -- 1. Lock cart để tránh race condition
  SELECT * INTO v_cart
  FROM public.carts
  WHERE id = p_cart_id AND (user_id = p_user_id OR (p_user_id IS NULL AND session_id IS NOT NULL))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart not found or unauthorized';
  END IF;

  -- 2. Calculate cart totals
  SELECT
    COALESCE(SUM(line_total), 0),
    COUNT(*),
    MAX(COALESCE(
      (SELECT production_days_max FROM public.products WHERE id = ci.product_id),
      0
    ))
  INTO v_subtotal, v_total_items, v_estimated_prod_days
  FROM public.cart_items ci
  WHERE ci.cart_id = p_cart_id;

  IF v_total_items = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- 3. Calculate deposit and remaining amounts
  IF p_payment_option = 'deposit' THEN
    v_deposit_amount = CEILING(v_subtotal * 0.30);
    v_remaining_amount = v_subtotal - v_deposit_amount;
  ELSE
    v_deposit_amount = v_subtotal;
    v_remaining_amount = 0;
  END IF;

  -- 4. Generate order number
  v_order_code := (nextval('public.order_number_seq')::text)::BIGINT;
  v_order_number := 'FLR-' || to_char(now(), 'YYYYMM') || LPAD(v_order_code::text, 6, '0');

  -- 5. Create order record
  INSERT INTO public.orders (
    order_number,
    user_id,
    payment_id,
    status,
    subtotal,
    discount_amount,
    shipping_fee,
    total_amount,
    currency,
    payment_option,
    deposit_rate,
    deposit_amount,
    remaining_amount,
    remaining_due_date,
    recipient_name,
    recipient_phone,
    shipping_address,
    estimated_production_days,
    estimated_delivery,
    customer_note
  ) VALUES (
    v_order_number,
    p_user_id,
    NULL, -- payment_id (will be set after payment)
    'confirmed',
    v_subtotal,
    v_cart.discount_amount,
    0, -- shipping_fee (can be added later)
    v_subtotal - v_cart.discount_amount,
    v_cart.currency,
    p_payment_option,
    0.30,
    v_deposit_amount,
    v_remaining_amount,
    CASE
      WHEN p_payment_option = 'deposit'
      THEN (now() + interval '15 days')::date
      ELSE NULL
    END,
    p_recipient_name,
    p_recipient_phone,
    p_shipping_address,
    COALESCE(v_estimated_prod_days, 7),
    (now()::date + COALESCE(v_estimated_prod_days, 7) * interval '1 day')::date,
    p_customer_note
  )
  RETURNING id INTO v_order_id;

  -- 5b. Create order items from cart items
  INSERT INTO public.order_items (
    order_id,
    product_id,
    product_name,
    product_sku,
    product_image_url,
    variant_label,
    design_mockup_url,
    design_summary,
    unit_price,
    customization_fee,
    quantity,
    subtotal,
    item_type
  )
  SELECT
    v_order_id,
    ci.product_id,
    ci.product_name,
    COALESCE(ci.product_snapshot->>'sku', 'N/A'),
    ci.product_snapshot->>'image_url',
    ci.product_snapshot->>'variant_label',
    ci.product_snapshot->>'mockup_image_url',
    ci.product_snapshot->>'design_summary',
    ci.unit_price,
    ci.customization_fee,
    ci.quantity,
    ci.line_total,
    ci.item_type
  FROM public.cart_items ci
  WHERE ci.cart_id = p_cart_id;

  -- 6. Log order creation
  INSERT INTO public.order_status_logs (order_id, from_status, to_status, change_source)
  VALUES (v_order_id, NULL, 'confirmed', 'system');

  -- 7. Clear cart items (but keep cart for reference)
  DELETE FROM public.cart_items WHERE cart_id = p_cart_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'order_code', v_order_code,
    'subtotal', v_subtotal,
    'discount_amount', v_cart.discount_amount,
    'total_amount', v_subtotal - v_cart.discount_amount,
    'payment_option', p_payment_option,
    'deposit_amount', v_deposit_amount,
    'remaining_amount', v_remaining_amount
  );
END;
$$;

-- Sequence cho order number
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;
