const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin, supabaseAnon } = require('../config/supabase');

/**
 * Register new user with email and password
 * Triggers automatic profile creation via Supabase trigger
 *
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @returns {object} { user, session }
 */
const register = async (email, password, fullName) => {
  // Sign up user via Supabase Auth
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm for development
    user_metadata: {
      full_name: fullName,
    },
  });

  if (error) {
    throw new Error(`Registration failed: ${error.message}`);
  }

  // Profile is automatically created via trigger on auth.users insert
  // But we can explicitly set initial profile data here if needed
  // (trigger already handles this, so optional)

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };
};

/**
 * Login user with email and password
 * Returns session with access token and refresh token
 *
 * @param {string} email
 * @param {string} password
 * @returns {object} { session, user }
 */
const login = async (email, password) => {
  // Use anon client for login (user credentials)
  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Login failed: ${error.message}`);
  }

  // Try to read full profile (including role) from profiles table
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError) {
    // If profile not found, fallback to basic user info with role from auth user (if any)
    return {
      session: data.session,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user?.role || null,
      },
    };
  }

  return {
    session: data.session,
    user: {
      id: profileData.id,
      email: data.user.email,
      role: profileData.role,
    },
  };
};

/**
 * Refresh access token using refresh token
 *
 * @param {string} refreshToken
 * @returns {object} { session }
 */
const refreshSession = async (refreshToken) => {
  const { data, error } = await supabaseAnon.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    throw new Error(`Token refresh failed: ${error.message}`);
  }

  return {
    session: data.session,
  };
};

/**
 * Get user by ID from profiles table
 *
 * @param {string} userId
 * @returns {object} user profile
 */
const getUserById = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data;
};

/**
 * Update user profile
 *
 * @param {string} userId
 * @param {object} updateData - columns to update (full_name, avatar_url, bio, etc.)
 * @returns {object} updated profile
 */
const updateProfile = async (userId, updateData) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  return data;
};

/**
 * Update password for authenticated user
 *
 * @param {string} newPassword
 * @param {string} refreshToken - needed to update auth
 * @returns {void}
 */
const updatePassword = async (userId, newPassword) => {
  // Use admin client to update password directly by user ID, avoiding session refresh issues
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    throw new Error(`Password update failed: ${error.message}`);
  }
};

/**
 * Request password reset email
 *
 * @param {string} email
 * @returns {void}
 */
const requestPasswordReset = async (email) => {
  const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/auth/reset-password`,
  });

  if (error) {
    throw new Error(`Password reset request failed: ${error.message}`);
  }
};

/**
 * Reset password with reset token from email
 *
 * @param {string} token - reset token from email
 * @param {string} newPassword
 * @returns {object} { session }
 */
const resetPassword = async (token, newPassword) => {
  // Create a transient supabase client for this request to avoid session state collision
  const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let session;

  // 1. Try standard OTP verification (implicit/standard flow)
  const { data: otpData, error: otpError } = await supabaseUser.auth.verifyOtp({
    token_hash: token,
    type: 'recovery',
  });

  if (otpError) {
    // 2. If OTP verification fails, try exchanging it as a PKCE auth code
    const { data: exchangeData, error: exchangeError } =
      await supabaseUser.auth.exchangeCodeForSession(token);
    if (exchangeError) {
      throw new Error(
        `Token verification failed: ${otpError.message} (PKCE exchange also failed: ${exchangeError.message})`
      );
    }
    session = exchangeData.session;
  } else {
    session = otpData.session;
  }

  // Set the session on the transient client so updateUser knows the authorized user
  await supabaseUser.auth.setSession(session);

  // 3. Update the user's password using the active session
  const { error: updateError } = await supabaseUser.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    throw new Error(`Password reset failed: ${updateError.message}`);
  }

  return {
    session,
  };
};

/**
 * Sign out user (invalidate session)
 * In Supabase, this is primarily a client-side operation
 * Backend just acknowledgments the request
 *
 * @returns {void}
 */
const logout = async (accessToken) => {
  if (!accessToken) return;

  // Create a transient supabase client with the user's access token to sign out securely
  const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { error } = await supabaseUser.auth.signOut();

  if (error) {
    console.warn('Logout warning:', error.message);
    // Not throwing because logout should succeed even if there's a minor issue
  }
};

module.exports = {
  register,
  login,
  refreshSession,
  getUserById,
  updateProfile,
  updatePassword,
  requestPasswordReset,
  resetPassword,
  logout,
};
