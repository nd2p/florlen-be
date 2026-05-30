const { supabaseAdmin } = require('../config/supabase');

/**
 * List all vouchers with pagination and query options (Admin only)
 */
const listVouchers = async ({ limit = 20, cursor, search }) => {
  let query = supabaseAdmin
    .from('vouchers')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(Number(limit) + 1);

  if (search) {
    query = query.ilike('code', `%${search}%`);
  }
  if (cursor) {
    query = query.lt('id', cursor);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const hasMore = data.length > limit;
  if (hasMore) data.pop();

  return {
    vouchers: data,
    hasMore,
    nextCursor: hasMore ? data[data.length - 1].id : null,
  };
};

/**
 * Create a new voucher (Admin only)
 */
const createVoucher = async (voucherData) => {
  const {
    code,
    discount_type,
    discount_value,
    start_date,
    end_date,
    usage_limit,
    limit_per_user,
    is_active,
  } = voucherData;

  if (!code || !code.trim()) throw new Error('Voucher code is required');
  if (!['percentage', 'fixed_amount', 'free_shipping'].includes(discount_type)) {
    throw new Error('Invalid discount type');
  }

  // Format code to uppercase alphanumeric
  const formattedCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!formattedCode) throw new Error('Voucher code must contain alphanumeric characters');

  // Verify unique code
  const { data: existing } = await supabaseAdmin
    .from('vouchers')
    .select('id')
    .eq('code', formattedCode)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    throw new Error('Voucher code already exists');
  }

  const insertData = {
    code: formattedCode,
    discount_type,
    discount_value: discount_type === 'free_shipping' ? 0 : Number(discount_value || 0),
    start_date: start_date ? new Date(start_date).toISOString() : new Date().toISOString(),
    end_date: end_date ? new Date(end_date).toISOString() : null,
    usage_limit: usage_limit ? parseInt(usage_limit) : null,
    limit_per_user: limit_per_user ? parseInt(limit_per_user) : null,
    is_active: is_active !== false,
  };

  const { data, error } = await supabaseAdmin
    .from('vouchers')
    .insert(insertData)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Update an existing voucher (Admin only)
 */
const updateVoucher = async (id, updateData) => {
  const {
    discount_type,
    discount_value,
    start_date,
    end_date,
    usage_limit,
    limit_per_user,
    is_active,
  } = updateData;

  const patchPayload = {};
  if (discount_type !== undefined) {
    if (!['percentage', 'fixed_amount', 'free_shipping'].includes(discount_type)) {
      throw new Error('Invalid discount type');
    }
    patchPayload.discount_type = discount_type;
  }
  if (discount_value !== undefined) {
    patchPayload.discount_value = Number(discount_value || 0);
  }
  if (start_date !== undefined) {
    patchPayload.start_date = start_date ? new Date(start_date).toISOString() : null;
  }
  if (end_date !== undefined) {
    patchPayload.end_date = end_date ? new Date(end_date).toISOString() : null;
  }
  if (usage_limit !== undefined) {
    patchPayload.usage_limit = usage_limit ? parseInt(usage_limit) : null;
  }
  if (limit_per_user !== undefined) {
    patchPayload.limit_per_user = limit_per_user ? parseInt(limit_per_user) : null;
  }
  if (is_active !== undefined) {
    patchPayload.is_active = Boolean(is_active);
  }

  const { data, error } = await supabaseAdmin
    .from('vouchers')
    .update(patchPayload)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Soft delete a voucher (Admin only)
 */
const deleteVoucher = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('vouchers')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Validate and calculate discount for a voucher code
 */
const validateVoucherCode = async (code, subtotal = 0, userId = null) => {
  if (!code || !code.trim()) {
    throw new Error('Voucher code is required');
  }

  const cleanCode = code.trim().toUpperCase();

  const { data: voucher, error } = await supabaseAdmin
    .from('vouchers')
    .select('*')
    .eq('code', cleanCode)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !voucher) {
    throw new Error('Mã giảm giá không tồn tại');
  }

  if (!voucher.is_active) {
    throw new Error('Mã giảm giá này đã tạm ngưng hoạt động');
  }

  const now = new Date();
  if (voucher.start_date && new Date(voucher.start_date) > now) {
    throw new Error('Chương trình giảm giá chưa bắt đầu');
  }

  if (voucher.end_date && new Date(voucher.end_date) < now) {
    throw new Error('Mã giảm giá này đã hết hạn sử dụng');
  }

  if (voucher.usage_limit !== null && voucher.used_count >= voucher.usage_limit) {
    throw new Error('Mã giảm giá đã đạt giới hạn lượt sử dụng');
  }

  // Check usage limit per user account if authenticated
  if (userId && voucher.limit_per_user !== null) {
    const { count, error: usageErr } = await supabaseAdmin
      .from('user_voucher_usages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('voucher_id', voucher.id);

    if (!usageErr && count !== null && count >= voucher.limit_per_user) {
      throw new Error(`Bạn đã đạt giới hạn sử dụng mã này (${voucher.limit_per_user} lần/tài khoản)`);
    }
  }

  // Calculate discount amount based on type
  let discountAmount = 0;
  if (voucher.discount_type === 'percentage') {
    // discount_value is percentage (e.g. 10 for 10%)
    const pct = Number(voucher.discount_value) / 100;
    discountAmount = Math.round(subtotal * pct);
  } else if (voucher.discount_type === 'fixed_amount') {
    discountAmount = Number(voucher.discount_value);
  } else if (voucher.discount_type === 'free_shipping') {
    // Freeship sets discount_amount equal to 0 or shipping fee, here we return a specific free_shipping state
    discountAmount = 0; 
  }

  return {
    voucherId: voucher.id,
    code: voucher.code,
    discountType: voucher.discount_type,
    discountValue: voucher.discount_value,
    discountAmount: Math.min(discountAmount, subtotal),
  };
};

module.exports = {
  listVouchers,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  validateVoucherCode,
};
