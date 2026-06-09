const { createClient } = require('@supabase/supabase-js');

/**
 * Admin client — bypass RLS, dùng ở backend only
 * NEVER expose SUPABASE_SERVICE_ROLE_KEY ra client
 */
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Anon client — tuân theo RLS, dùng khi muốn act as user
 * Có thể expose SUPABASE_ANON_KEY ra client (nó đã được bảo vệ bởi RLS)
 */
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = { supabaseAdmin, supabaseAnon };
