const { supabaseAdmin } = require('../config/supabase');

/**
 * List all addresses for a user
 * @param {string} userId
 */
const listAddresses = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('user_addresses')
    .select(
      'id, label, is_default, recipient_name, phone_number, address_line_1, city, country_code, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Get a single address (with ownership check)
 * @param {string} id
 * @param {string} userId
 */
const getAddress = async (id, userId) => {
  const { data, error } = await supabaseAdmin
    .from('user_addresses')
    .select(
      'id, label, is_default, recipient_name, phone_number, address_line_1, city, country_code, created_at, updated_at'
    )
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Create a new address.
 * Auto-sets is_default = true if it is the user's first address.
 * @param {string} userId
 * @param {object} data
 */
const createAddress = async (userId, data) => {
  const { recipientName, phone, addressLine1, city, countryCode, label, isDefault } = data;

  // Count existing addresses to decide auto-default
  const { count, error: countError } = await supabaseAdmin
    .from('user_addresses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) throw new Error(countError.message);

  const isFirstAddress = count === 0;
  const shouldSetDefault = isFirstAddress || Boolean(isDefault);

  // If this address will be default, unset existing default first
  if (shouldSetDefault && !isFirstAddress) {
    const { error: unsetError } = await supabaseAdmin
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    if (unsetError) throw new Error(unsetError.message);
  }

  const { data: created, error } = await supabaseAdmin
    .from('user_addresses')
    .insert({
      user_id: userId,
      label: label || null,
      is_default: shouldSetDefault,
      recipient_name: recipientName,
      phone_number: phone,
      address_line_1: addressLine1,
      city,
      country_code: countryCode || 'VN',
    })
    .select(
      'id, label, is_default, recipient_name, phone_number, address_line_1, city, country_code, created_at, updated_at'
    )
    .single();

  if (error) throw new Error(error.message);
  return created;
};

/**
 * Partially update an address (ownership check).
 * If is_default is set to true, unsets existing default first.
 * @param {string} id
 * @param {string} userId
 * @param {object} data
 */
const updateAddress = async (id, userId, data) => {
  // Verify ownership
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('user_addresses')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !existing) throw new Error('Address not found');

  const { recipientName, phone, addressLine1, city, countryCode, label, isDefault } = data;

  // Build update payload (only include provided fields)
  const updatePayload = {};
  if (label !== undefined) updatePayload.label = label;
  if (recipientName !== undefined) updatePayload.recipient_name = recipientName;
  if (phone !== undefined) updatePayload.phone_number = phone;
  if (addressLine1 !== undefined) updatePayload.address_line_1 = addressLine1;
  if (city !== undefined) updatePayload.city = city;
  if (countryCode !== undefined) updatePayload.country_code = countryCode;

  if (isDefault === true) {
    // Unset other defaults first
    const { error: unsetError } = await supabaseAdmin
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    if (unsetError) throw new Error(unsetError.message);
    updatePayload.is_default = true;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new Error('No fields to update');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('user_addresses')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', userId)
    .select(
      'id, label, is_default, recipient_name, phone_number, address_line_1, city, country_code, created_at, updated_at'
    )
    .single();

  if (error) throw new Error(error.message);
  return updated;
};

/**
 * Hard-delete an address (no soft-delete — no deleted_at column in schema).
 * @param {string} id
 * @param {string} userId
 */
const deleteAddress = async (id, userId) => {
  // Verify ownership and get is_default state
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('user_addresses')
    .select('id, is_default')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !existing) throw new Error('Address not found');

  const { error } = await supabaseAdmin
    .from('user_addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  // If deleted address was default, promote the most recent remaining address
  if (existing.is_default) {
    const { data: next } = await supabaseAdmin
      .from('user_addresses')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (next) {
      await supabaseAdmin
        .from('user_addresses')
        .update({ is_default: true })
        .eq('id', next.id);
    }
  }
};

/**
 * Set an address as default (unsets all others).
 * @param {string} id
 * @param {string} userId
 */
const setDefaultAddress = async (id, userId) => {
  // Verify ownership
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('user_addresses')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !existing) throw new Error('Address not found');

  // Unset all defaults
  const { error: unsetError } = await supabaseAdmin
    .from('user_addresses')
    .update({ is_default: false })
    .eq('user_id', userId);

  if (unsetError) throw new Error(unsetError.message);

  // Set new default
  const { data: updated, error } = await supabaseAdmin
    .from('user_addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', userId)
    .select(
      'id, label, is_default, recipient_name, phone_number, address_line_1, city, country_code, created_at, updated_at'
    )
    .single();

  if (error) throw new Error(error.message);
  return updated;
};

module.exports = {
  listAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
