const { supabaseAdmin } = require('../config/supabase');

/**
 * List all users in the system, combining profile data with auth credential info
 * Supporting filtering, searching, and pagination
 *
 * @param {object} params
 * @param {string} [params.search] - search in name, display name, phone, or email
 * @param {string} [params.role] - filter by 'customer', 'admin', or 'super_admin'
 * @param {string} [params.status] - filter by 'active', 'inactive', 'banned'
 * @param {number} [params.limit=20] - number of users to return
 * @param {number} [params.offset=0] - offset pagination start
 * @returns {object} { users, totalCount }
 */
const listUsers = async ({ search, role, status, limit = 20, offset = 0 } = {}) => {
  try {
    // 1. Fetch all auth users to match emails and search across email addresses
    // We fetch a larger batch of users (up to 1000) for merging in memory
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authError) {
      throw new Error(`Failed to fetch auth users: ${authError.message}`);
    }

    // Create lookup map of user ID -> email & last_sign_in_at
    const authMap = new Map();
    authUsers.forEach((u) => {
      authMap.set(u.id, {
        email: u.email,
        lastSignInAt: u.last_sign_in_at || null,
      });
    });

    // 2. Build the query for profiles table
    let query = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' });

    // Apply role filter
    if (role) {
      query = query.eq('role', role);
    }

    // Apply status filter
    if (status) {
      if (status === 'active') {
        query = query.eq('is_active', true).eq('is_banned', false);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      } else if (status === 'banned') {
        query = query.eq('is_banned', true);
      }
    }

    // Apply search filter (name, display name, phone, or email)
    if (search) {
      const cleanSearch = search.trim().toLowerCase();
      // Find user IDs whose emails match the search query in memory
      const matchedAuthIds = [];
      authUsers.forEach((u) => {
        if (u.email && u.email.toLowerCase().includes(cleanSearch)) {
          matchedAuthIds.push(u.id);
        }
      });

      const profileSearchFilters = [
        `full_name.ilike.%${cleanSearch}%`,
        `display_name.ilike.%${cleanSearch}%`,
        `phone_number.ilike.%${cleanSearch}%`,
      ];

      // If we found matches in auth emails, include those IDs in our profiles search
      if (matchedAuthIds.length > 0) {
        // Break into chunks of 50 to prevent postgrest URI length errors if there are massive amounts of matches
        const idListStr = matchedAuthIds.slice(0, 100).join(',');
        profileSearchFilters.push(`id.in.(${idListStr})`);
      }

      query = query.or(profileSearchFilters.join(','));
    }

    // Apply sorting (newest first)
    query = query.order('created_at', { ascending: false });

    // Apply pagination range
    const startRange = Number(offset);
    const endRange = startRange + Number(limit) - 1;
    query = query.range(startRange, endRange);

    // Execute query
    const { data: profiles, count, error } = await query;

    if (error) {
      throw new Error(`Failed to query user profiles: ${error.message}`);
    }

    // 3. Merge profiles with auth details
    const mergedUsers = profiles.map((profile) => {
      const authInfo = authMap.get(profile.id) || { email: null, lastSignInAt: null };
      return {
        ...profile,
        email: authInfo.email,
        last_login_at: profile.last_login_at || authInfo.lastSignInAt, // Fallback to auth login time
      };
    });

    return {
      users: mergedUsers,
      totalCount: count || 0,
    };
  } catch (error) {
    console.error('List users service error:', error);
    throw error;
  }
};

/**
 * Get detailed profile of a single user
 *
 * @param {string} id - user UUID
 * @returns {object} user profile details with email
 */
const getUserById = async (id) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Profile not found: ${error.message}`);
    }

    // Fetch auth user to get email and latest sign in time
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);

    if (authError) {
      console.warn(`Could not fetch auth user for profile ${id}: ${authError.message}`);
    }

    return {
      ...profile,
      email: authUser?.email || null,
      last_login_at: profile.last_login_at || authUser?.last_sign_in_at || null,
    };
  } catch (error) {
    console.error('Get user by id service error:', error);
    throw error;
  }
};

/**
 * Update a user profile and role/status
 *
 * @param {string} id - user UUID
 * @param {object} updateData - columns to update
 * @returns {object} updated profile data
 */
const updateUser = async (id, updateData) => {
  try {
    // 1. Sanitize updates
    const allowedFields = [
      'full_name',
      'display_name',
      'phone_number',
      'role',
      'is_active',
      'is_banned',
      'banned_reason',
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new Error('No valid fields to update');
    }

    // If unbanning, clear banned_reason
    if (updates.is_banned === false) {
      updates.banned_reason = null;
    }

    // 2. Perform database update using supabaseAdmin (bypassing RLS)
    const { data: updatedProfile, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }

    // 3. Fetch matching auth user details to return fully merged response
    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(id).catch(() => ({ data: {} }));

    return {
      ...updatedProfile,
      email: authUser?.email || null,
      last_login_at: updatedProfile.last_login_at || authUser?.last_sign_in_at || null,
    };
  } catch (error) {
    console.error('Update user service error:', error);
    throw error;
  }
};

module.exports = {
  listUsers,
  getUserById,
  updateUser,
};
