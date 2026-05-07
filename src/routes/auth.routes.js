const express = require('express');
const {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  googleOAuthCallback,
} = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/authenticate');

const router = express.Router();

/**
 * Public routes
 */

/**
 * POST /api/auth/register
 * Register new user
 *
 * Body:
 *   - email (string, required): User email
 *   - password (string, required): At least 8 characters
 *   - full_name (string, required): User's full name
 *
 * Response: 201
 *   {
 *     message: "User registered successfully",
 *     user: { id, email }
 *   }
 */
router.post('/register', register);

/**
 * POST /api/auth/login
 * Login with email and password
 *
 * Body:
 *   - email (string, required)
 *   - password (string, required)
 *
 * Response: 200
 *   {
 *     message: "Login successful",
 *     accessToken: string,
 *     refreshToken: string,
 *     expiresIn: number (seconds),
 *     user: { id, email }
 *   }
 */
router.post('/login', login);

/**
 * POST /api/auth/refresh
 * Refresh access token
 *
 * Body:
 *   - refreshToken (string, required): Refresh token from login/register
 *
 * Response: 200
 *   {
 *     message: "Token refreshed successfully",
 *     accessToken: string,
 *     refreshToken: string,
 *     expiresIn: number
 *   }
 */
router.post('/refresh', refresh);

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 *
 * Body:
 *   - email (string, required)
 *
 * Response: 200
 *   {
 *     message: "If an account with this email exists, a password reset link has been sent"
 *   }
 */
router.post('/forgot-password', forgotPassword);

/**
 * POST /api/auth/reset-password
 * Reset password with token from email
 *
 * Body:
 *   - token (string, required): Reset token from email link
 *   - newPassword (string, required): At least 8 characters
 *   - confirmPassword (string, required): Must match newPassword
 *
 * Response: 200
 *   {
 *     message: "Password reset successfully",
 *     accessToken: string,
 *     refreshToken: string
 *   }
 */
router.post('/reset-password', resetPassword);

/**
 * POST /api/auth/oauth/google/callback
 * (Optional) Google OAuth callback handler
 * Note: Supabase SDK handles most OAuth on frontend
 */
router.post('/oauth/google/callback', googleOAuthCallback);

/**
 * Protected routes (require authentication)
 */

/**
 * GET /api/auth/me
 * Get current authenticated user
 *
 * Headers:
 *   - Authorization: "Bearer <accessToken>"
 *
 * Response: 200
 *   {
 *     message: "Success",
 *     user: { id, email, full_name, avatar_url, role, is_active, ... }
 *   }
 */
router.get('/me', authenticate, getMe);

/**
 * PATCH /api/auth/profile
 * Update user profile
 *
 * Headers:
 *   - Authorization: "Bearer <accessToken>"
 *
 * Body (all optional):
 *   - full_name (string)
 *   - display_name (string)
 *   - avatar_url (string)
 *   - bio (string)
 *   - phone (string)
 *
 * Response: 200
 *   {
 *     message: "Profile updated successfully",
 *     user: { updated profile object }
 *   }
 */
router.patch('/profile', authenticate, updateProfile);

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 *
 * Headers:
 *   - Authorization: "Bearer <accessToken>"
 *
 * Body:
 *   - newPassword (string, required): At least 8 characters
 *   - confirmPassword (string, required): Must match newPassword
 *   - refreshToken (string, required): Needed for auth update
 *
 * Response: 200
 *   {
 *     message: "Password changed successfully"
 *   }
 */
router.post('/change-password', authenticate, changePassword);

/**
 * POST /api/auth/logout
 * Logout user
 *
 * Headers:
 *   - Authorization: "Bearer <accessToken>"
 *
 * Response: 200
 *   {
 *     message: "Logout successful"
 *   }
 */
router.post('/logout', authenticate, logout);

module.exports = router;
