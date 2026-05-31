const { supabaseAdmin } = require('../config/supabase');

/**
 * List all vouchers with pagination and query options (Admin only)
 * Includes assigned user IDs from the voucher_users junction table
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

  // Step 1: Fetch all voucher_users assignments for these vouchers
  const voucherIds = data.map((v) => v.id);
  let userAssignments = [];
  if (voucherIds.length > 0) {
    const { data: assignments, error: assignError } = await supabaseAdmin
      .from('voucher_users')
      .select('voucher_id, user_id')
      .in('voucher_id', voucherIds);

    if (!assignError && assignments) {
      userAssignments = assignments;
    }
  }

  // Step 2: Fetch profile info + email for all assigned user_ids
  const allUserIds = [...new Set(userAssignments.map((a) => a.user_id))];
  let profilesMap = {};
  if (allUserIds.length > 0) {
    // 2a. Get profile data (full_name, display_name, avatar_url) from public.profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, display_name, avatar_url')
      .in('id', allUserIds);

    if (!profilesError && profiles) {
      profiles.forEach((p) => {
        profilesMap[p.id] = { ...p };
      });
    }

    // 2b. Get email from auth.users via Admin API (email is not stored in public.profiles)
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
      });
      if (authData?.users) {
        const authUserSet = new Set(allUserIds);
        authData.users
          .filter((u) => authUserSet.has(u.id))
          .forEach((u) => {
            if (profilesMap[u.id]) {
              profilesMap[u.id].email = u.email || null;
            } else {
              profilesMap[u.id] = { id: u.id, email: u.email || null };
            }
          });
      }
    } catch (authErr) {
      console.error('Failed to fetch auth users for email merge:', authErr);
    }
  }

  // Step 3: Attach user_ids array and assigned_users info to each voucher
  const vouchers = data.map((v) => {
    const assignments = userAssignments.filter((a) => a.voucher_id === v.id);
    return {
      ...v,
      user_ids: assignments.map((a) => a.user_id),
      assigned_users: assignments.map((a) => {
        const profile = profilesMap[a.user_id] || {};
        return {
          id: a.user_id,
          full_name: profile.full_name || null,
          display_name: profile.display_name || null,
          email: profile.email || null,
          avatar_url: profile.avatar_url || null,
        };
      }),
    };
  });

  return {
    vouchers,
    hasMore,
    nextCursor: hasMore ? data[data.length - 1].id : null,
  };
};

/**
 * Create a new voucher (Admin only)
 * Accepts user_ids array for multi-user assignment
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
    user_ids,
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

  // Insert user assignments into junction table
  const assignedUserIds = Array.isArray(user_ids) ? user_ids.filter(Boolean) : [];
  if (assignedUserIds.length > 0) {
    const rows = assignedUserIds.map((uid) => ({
      voucher_id: data.id,
      user_id: uid,
    }));
    const { error: assignError } = await supabaseAdmin
      .from('voucher_users')
      .insert(rows);
    if (assignError) {
      console.error('Failed to assign users to voucher:', assignError);
    }
  }

  return { ...data, user_ids: assignedUserIds };
};

/**
 * Update an existing voucher (Admin only)
 * Accepts user_ids array — replaces all existing assignments
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
    user_ids,
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

  // Update user assignments if user_ids was provided
  if (user_ids !== undefined) {
    // Delete all existing assignments
    await supabaseAdmin
      .from('voucher_users')
      .delete()
      .eq('voucher_id', id);

    // Insert new assignments
    const assignedUserIds = Array.isArray(user_ids) ? user_ids.filter(Boolean) : [];
    if (assignedUserIds.length > 0) {
      const rows = assignedUserIds.map((uid) => ({
        voucher_id: id,
        user_id: uid,
      }));
      const { error: assignError } = await supabaseAdmin
        .from('voucher_users')
        .insert(rows);
      if (assignError) {
        console.error('Failed to update user assignments:', assignError);
      }
    }

    return { ...data, user_ids: assignedUserIds };
  }

  return data;
};

/**
 * Soft delete a voucher (Admin only)
 */
const deleteVoucher = async (id) => {
  // Also clean up junction table
  await supabaseAdmin.from('voucher_users').delete().eq('voucher_id', id);

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

  // Check user-specific voucher assignment via junction table
  const { data: assignments } = await supabaseAdmin
    .from('voucher_users')
    .select('user_id')
    .eq('voucher_id', voucher.id);

  const assignedUserIds = (assignments || []).map((a) => a.user_id);

  // If the voucher has specific user assignments, check if current user is in the list
  if (assignedUserIds.length > 0 && (!userId || !assignedUserIds.includes(userId))) {
    throw new Error('Mã giảm giá này dành riêng cho tài khoản khác');
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

/**
 * Get all vouchers available for a specific user at checkout
 * Returns public vouchers + vouchers assigned to this user, all active and within date range
 * Pre-calculates discountAmount based on the provided subtotal
 */
const getAvailableVouchers = async (userId, subtotal = 0) => {
  const now = new Date().toISOString();

  // Fetch all active, non-deleted vouchers within date range
  const { data: allVouchers, error } = await supabaseAdmin
    .from('vouchers')
    .select('*')
    .is('deleted_at', null)
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const voucherIds = (allVouchers || []).map((v) => v.id);
  if (voucherIds.length === 0) return [];

  // Fetch all assignments for these vouchers
  const { data: assignments } = await supabaseAdmin
    .from('voucher_users')
    .select('voucher_id, user_id')
    .in('voucher_id', voucherIds);

  const assignmentsMap = {};
  (assignments || []).forEach((a) => {
    if (!assignmentsMap[a.voucher_id]) assignmentsMap[a.voucher_id] = [];
    assignmentsMap[a.voucher_id].push(a.user_id);
  });

  // Filter: include voucher if it's public (no assignments) OR assigned to this user
  const eligible = (allVouchers || []).filter((v) => {
    const assignedUsers = assignmentsMap[v.id] || [];
    if (assignedUsers.length === 0) return true; // public voucher
    return userId && assignedUsers.includes(userId);
  });

  // Check usage limits & calculate discount amount for each
  const results = await Promise.all(
    eligible.map(async (v) => {
      // Check global usage limit
      if (v.usage_limit !== null && v.used_count >= v.usage_limit) return null;

      // Check per-user usage limit
      if (userId && v.limit_per_user !== null) {
        const { count } = await supabaseAdmin
          .from('user_voucher_usages')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('voucher_id', v.id);
        if (count !== null && count >= v.limit_per_user) return null;
      }

      // Calculate discount amount
      let discountAmount = 0;
      if (v.discount_type === 'percentage') {
        discountAmount = Math.round(subtotal * (Number(v.discount_value) / 100));
      } else if (v.discount_type === 'fixed_amount') {
        discountAmount = Number(v.discount_value);
      }
      discountAmount = Math.min(discountAmount, subtotal);

      return {
        id: v.id,
        code: v.code,
        discount_type: v.discount_type,
        discount_value: v.discount_value,
        end_date: v.end_date,
        discountAmount,
      };
    })
  );

  return results.filter(Boolean);
};

module.exports = {
  listVouchers,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  validateVoucherCode,
  getAvailableVouchers,
};
