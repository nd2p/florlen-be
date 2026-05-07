# Supabase & Auth Implementation Guide

## Overview

This guide explains the implemented Supabase Client Setup and Auth Module for Florlen Backend.

## Files Created

### 1. `src/config/supabase.js`

**Purpose:** Centralized Supabase client initialization

- **`supabaseAdmin`**: Uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
  - Use only in backend for administrative operations
  - **NEVER expose this key to frontend**
- **`supabaseAnon`**: Uses `SUPABASE_ANON_KEY` (respects RLS)
  - Safe to use on frontend
  - User operations are automatically restricted by RLS policies

### 2. `src/middlewares/authenticate.js`

**Purpose:** Verify JWT tokens and attach user data to requests

- Extracts token from `Authorization: Bearer <token>` header
- Verifies token using Supabase SDK (NOT manual JWT validation)
- Loads user profile with role information
- Checks if user is active
- Attaches `req.user` to request for protected routes

### 3. `src/services/auth.service.js`

**Purpose:** Core authentication business logic

**Exported Functions:**

- `register(email, password, fullName)` - Create new account
- `login(email, password)` - Authenticate user
- `refreshSession(refreshToken)` - Get new access token
- `getUserById(userId)` - Fetch user profile
- `updateProfile(userId, updateData)` - Update profile fields
- `updatePassword(newPassword, refreshToken)` - Change password
- `requestPasswordReset(email)` - Send reset email
- `resetPassword(token, newPassword)` - Complete password reset
- `logout(accessToken)` - Sign out user

### 4. `src/controllers/auth.controller.js`

**Purpose:** HTTP request handlers for auth endpoints

**Endpoints Implemented:**

- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user (protected)
- `PATCH /api/auth/profile` - Update profile (protected)
- `POST /api/auth/change-password` - Change password (protected)
- `POST /api/auth/forgot-password` - Request reset
- `POST /api/auth/reset-password` - Complete reset
- `POST /api/auth/oauth/google/callback` - OAuth callback

### 5. `src/routes/auth.routes.js`

**Purpose:** Route definitions with full API documentation

All endpoints are documented with:

- URL and HTTP method
- Required request body/headers
- Expected responses
- Status codes

## Integration Steps

### Step 1: Update `app.js` or `server.js`

```javascript
const express = require('express');
const authRoutes = require('./src/routes/auth.routes');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);

// Your other routes...
```

### Step 2: Environment Variables

Ensure your `.env` file contains:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:3000
```

Get these from: https://app.supabase.com → Project Settings → API

### Step 3: Database Migrations

Run the Supabase migrations to create the `profiles` table and trigger:

```bash
cd florlen-backend
supabase db push
```

The migrations include:

- `profiles` table with RLS policies
- Auto-trigger to create profile when user signs up
- `updated_at` auto-update trigger

### Step 4: Supabase Auth Configuration (Dashboard)

1. Go to https://app.supabase.com
2. Select your project → Authentication → Providers
3. Enable **Email/Password**
4. Enable **Google** (optional, requires Google Cloud credentials)
5. Auth → URL Configuration:
   - Add redirect URL: `http://localhost:3000` (dev)
   - Add redirect URL: `https://florlen.vn` (production)

## Usage Examples

### Register

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "full_name": "John Doe"
  }'
```

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'

# Response:
# {
#   "message": "Login successful",
#   "accessToken": "eyJ...",
#   "refreshToken": "refresh_token_...",
#   "expiresIn": 3600,
#   "user": { "id": "...", "email": "user@example.com" }
# }
```

### Get Current User (Protected)

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer eyJ..."
```

### Update Profile (Protected)

```bash
curl -X PATCH http://localhost:3001/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ..." \
  -d '{
    "full_name": "Jane Doe",
    "bio": "I love handmade crafts"
  }'
```

## Key Points

### ⚠️ Authentication Flow

1. **Signup**: User registers → Supabase creates auth user → Trigger creates profile
2. **Login**: User sends credentials → Get access + refresh tokens
3. **Protected Requests**: Include `Authorization: Bearer <accessToken>` header
4. **Token Refresh**: When access token expires, use refresh token to get new one
5. **Logout**: Clear tokens on client side (backend ignores token as invalid)

### ⚠️ Token Management

- **Access Token**: Short-lived (1 hour), sent with every request
- **Refresh Token**: Long-lived (7 days), never expires unless revoked
- **Store refresh token**: httpOnly cookie (automatically handled) or secure storage
- **Never store access token in localStorage** - vulnerable to XSS

### ⚠️ Password Security

- Minimum 8 characters (enforce on frontend too)
- Password reset email sent to configured email provider
- Password reset links expire after 1 hour
- Passwords NOT reversible (bcrypt in Supabase)

### ⚠️ RLS (Row Level Security)

The `profiles` table has RLS enabled:

- Users can only view/update their own profile
- Admins can view all profiles
- Identity verification happens automatically via `auth.uid()`

## Testing with Postman/Thunder Client

### Collection Setup

Create a new collection called "Florlen Auth" with environment variable:

- `base_url`: `http://localhost:3001`
- `token`: (auto-populated after login)

### Test Sequence

1. **Register**: POST `/api/auth/register`
2. **Login**: POST `/api/auth/login` → Save response `accessToken` as `token`
3. **Me**: GET `/api/auth/me` with `Authorization: Bearer {{token}}`
4. **Update Profile**: PATCH `/api/auth/profile`
5. **Change Password**: POST `/api/auth/change-password`
6. **Logout**: POST `/api/auth/logout`

## Troubleshooting

### Error: "Invalid token"

- Token expired → Use refresh endpoint
- Token malformed → Check Authorization header format
- Token from wrong project → Verify SUPABASE_URL matches

### Error: "User profile not found"

- User exists in auth.users but not profiles table
- Check if database migrations ran successfully
- Check RLS policy on profiles table

### Error: "User account is inactive"

- User account deactivated by admin
- Check `is_active` column in profiles table
- Re-activate via admin dashboard

### Google OAuth not working

- Add redirect URL to Google Cloud Console
- Add redirect URL to Supabase Dashboard
- Check FRONTEND_URL environment variable

## Next Steps

1. Implement **avatar upload** using Supabase Storage
2. Add **email verification** on registration
3. Implement **2FA** (two-factor authentication)
4. Add **rate limiting** on auth endpoints
5. Implement **role-based access control** (admin, moderator, user)
6. Add **audit logging** for auth events
