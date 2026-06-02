const {
  register: registerService,
  login: loginService,
  refreshSession: refreshSessionService,
  updateProfile: updateProfileService,
  updatePassword: updatePasswordService,
  requestPasswordReset: requestPasswordResetService,
  resetPassword: resetPasswordService,
  logout: logoutService,
} = require('../services/auth.service');
const { supabaseAnon, supabaseAdmin } = require('../config/supabase');


/**
 * POST /api/auth/register
 * Register new user
 */
const register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    // Validation
    if (!email || !password || !full_name) {
      return res.status(400).json({ message: 'Email, password, and full name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await registerService(email, password, full_name);

    res.status(201).json({
      message: 'User registered successfully',
      user: existingUser.user,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/auth/login
 * Login user with email and password
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const { session, user } = await loginService(email, password);

    // Set refresh token as httpOnly cookie (optional, can also send in response)
    res.cookie('refreshToken', session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Login successful',
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      user,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ message: error.message });
  }
};

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const { session } = await refreshSessionService(refreshToken);

    // Update refresh token cookie if needed
    res.cookie('refreshToken', session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Token refreshed successfully',
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(401).json({ message: error.message });
  }
};

/**
 * POST /api/auth/logout
 * Logout user
 */
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await logoutService(token);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    res.json({
      message: 'Success',
      user: req.user,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/auth/profile
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const updateData = {};
    const allowedFields = ['full_name', 'display_name', 'avatar_url', 'bio', 'phone'];

    // Only allow specific fields to be updated
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'phone') {
          updateData['phone_number'] = req.body[field];
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const updatedProfile = await updateProfileService(req.user.id, updateData);

    const userResponse = {
      ...updatedProfile,
      phone: updatedProfile.phone_number,
    };

    res.json({
      message: 'Profile updated successfully',
      user: userResponse,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
const changePassword = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Get refresh token from request (frontend should send it)
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    await updatePasswordService(newPassword, refreshToken);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    await requestPasswordResetService(email);

    // Don't reveal whether email exists for security
    res.json({
      message: 'If an account with this email exists, a password reset link has been sent',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json({
      message: 'If an account with this email exists, a password reset link has been sent',
    });
  }
};

/**
 * POST /api/auth/reset-password
 * Reset password with token from email
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Token, password and confirmation are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const { session } = await resetPasswordService(token, newPassword);

    res.json({
      message: 'Password reset successfully',
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * GET /api/auth/oauth/google
 * Generate Google OAuth authorization URL
 */
const getGoogleOAuthUrl = async (req, res) => {
  try {
    const redirectTo = `${process.env.FRONTEND_URL || 'https://florlen.id.vn'}/auth/callback`;

    const { data, error } = await supabaseAnon.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw error;
    }

    res.json({ url: data.url });
  } catch (error) {
    console.error('Get Google OAuth URL error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/auth/oauth/google/callback
 * Exchange authorization code for Supabase session and user profile
 */
const googleOAuthCallback = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    // Exchange code for session via Supabase
    const { data: authData, error: authError } = await supabaseAnon.auth.exchangeCodeForSession(code);

    if (authError) {
      throw authError;
    }

    const { session, user: authUser } = authData;

    // Fetch user profile from database to get their role and other metadata
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (profileError) {
      // Fallback in case profile trigger had a slight delay or error
      return res.json({
        message: 'Login successful (profile loading)',
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in,
        user: {
          id: authUser.id,
          email: authUser.email,
          role: 'customer',
          full_name: authUser.user_metadata?.full_name || '',
          avatar_url: authUser.user_metadata?.avatar_url || '',
        },
      });
    }

    // Set refresh token as httpOnly cookie (consistent with login endpoint)
    res.cookie('refreshToken', session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Login successful',
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      user: {
        id: profile.id,
        email: authUser.email,
        role: profile.role,
        full_name: profile.full_name,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getGoogleOAuthUrl,
  googleOAuthCallback,
};
