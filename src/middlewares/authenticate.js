const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('../config/supabase');

/**
 * Middleware to verify Supabase JWT token and attach authenticated user to request
 * Token should be sent in Authorization header: "Bearer <token>"
 *
 * @throws {Error} 401 if token is missing or invalid
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token using Supabase SDK (NOT manual JWT validation)
    // Create client with user's token to verify it
    const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data, error } = await supabaseUser.auth.getUser();
    if (error || !data.user) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    // Load user profile with role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ message: 'Unauthorized: User profile not found' });
    }

    // Check if user is active
    if (!profile.is_active) {
      return res.status(401).json({ message: 'Unauthorized: User account is inactive' });
    }

    // Attach user info to request
    req.user = {
      id: data.user.id,
      email: data.user.email,
      ...profile, // includes role, is_active, etc.
      phone: profile.phone_number,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Optional authentication middleware.
 * If a valid Bearer token is present, attaches req.user (same as authenticate).
 * If no token is provided, sets req.user = null and continues (guest allowed).
 * If the token is present but invalid, still returns 401.
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // No token → guest request, continue without user
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];

    const supabaseUser = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const { data, error } = await supabaseUser.auth.getUser();
    if (error || !data.user) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ message: 'Unauthorized: User profile not found' });
    }

    if (!profile.is_active) {
      return res.status(401).json({ message: 'Unauthorized: User account is inactive' });
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      ...profile,
      phone: profile.phone_number,
    };

    return next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { authenticate, optionalAuthenticate };
