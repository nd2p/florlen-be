const { supabaseAdmin } = require('../config/supabase');

/**
 * Get aggregated reports metrics and statistics for dashboard visualizations
 *
 * @returns {object} dashboard metrics and charts data
 */
const getReportsSummary = async () => {
  try {
    // 1. Fetch total counts
    const { data: succeededPayments, error: payError } = await supabaseAdmin
      .from('payments')
      .select('amount, payment_method, status, created_at, paid_at')
      .eq('status', 'succeeded');

    if (payError) throw new Error(`Failed to query payments: ${payError.message}`);

    const { count: totalOrders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'draft');

    if (ordersError) throw new Error(`Failed to query orders: ${ordersError.message}`);

    const { count: completedOrders, error: completedError } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed');

    if (completedError) throw new Error(`Failed to query completed orders: ${completedError.message}`);

    const { count: totalCustomers, error: customersError } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'customer');

    if (customersError) throw new Error(`Failed to query customers: ${customersError.message}`);

    // Aggregate summary metrics
    const totalRevenue = succeededPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // 2. Aggregate sales history over time (Last 30 Days)
    const dailySalesMap = new Map();
    // Pre-populate last 30 days with 0 to ensure continuous charts
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailySalesMap.set(dateStr, 0);
    }

    succeededPayments.forEach((p) => {
      const dateStr = new Date(p.paid_at || p.created_at).toISOString().split('T')[0];
      if (dailySalesMap.has(dateStr)) {
        dailySalesMap.set(dateStr, dailySalesMap.get(dateStr) + Number(p.amount));
      }
    });

    const dailyRevenueHistory = Array.from(dailySalesMap.entries()).map(([date, amount]) => ({
      date,
      amount,
    }));

    // 3. Aggregate order statuses breakdown
    const { data: ordersStatusList, error: statusError } = await supabaseAdmin
      .from('orders')
      .select('status')
      .neq('status', 'draft');

    if (statusError) throw new Error(`Failed to query order statuses: ${statusError.message}`);

    const statusCounts = {};
    ordersStatusList.forEach((o) => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    const orderStatusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    // 4. Aggregate payment methods breakdown
    const methodCounts = {};
    succeededPayments.forEach((p) => {
      const method = p.payment_method || 'unknown';
      if (!methodCounts[method]) {
        methodCounts[method] = { count: 0, amount: 0 };
      }
      methodCounts[method].count += 1;
      methodCounts[method].amount += Number(p.amount);
    });

    const paymentMethodsBreakdown = Object.entries(methodCounts).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount,
    }));

    // 5. Aggregate top selling products
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('product_name, quantity, subtotal');

    if (itemsError) throw new Error(`Failed to query order items: ${itemsError.message}`);

    const productStats = {};
    orderItems.forEach((item) => {
      const name = item.product_name || 'Unknown Product';
      if (!productStats[name]) {
        productStats[name] = { quantity: 0, amount: 0 };
      }
      productStats[name].quantity += Number(item.quantity || 1);
      productStats[name].amount += Number(item.subtotal || 0);
    });

    const topSellingProducts = Object.entries(productStats)
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        amount: data.amount,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      metrics: {
        totalRevenue,
        totalOrders: totalOrders || 0,
        completedOrders: completedOrders || 0,
        totalCustomers: totalCustomers || 0,
      },
      charts: {
        dailyRevenueHistory,
        orderStatusBreakdown,
        paymentMethodsBreakdown,
        topSellingProducts,
      },
    };
  } catch (error) {
    console.error('Reports summary service error:', error);
    throw error;
  }
};

/**
 * List all transaction records in the system (Admin only)
 *
 * @param {object} params
 * @param {string} [params.search] - search by txn id, email, recipient
 * @param {string} [params.status] - payment status filter
 * @param {number} [params.limit=20]
 * @param {number} [params.offset=0]
 * @returns {object} { transactions, totalCount }
 */
const listTransactions = async ({ search, status, limit = 20, offset = 0 } = {}) => {
  try {
    // 1. Map email search Term if provided
    const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authError) {
      throw new Error(`Failed to fetch auth users: ${authError.message}`);
    }

    const authMap = new Map();
    authUsers.forEach((u) => {
      authMap.set(u.id, u.email);
    });

    // 2. Query payments
    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        profiles!payments_user_id_fkey (
          full_name,
          display_name,
          avatar_url,
          phone_number
        ),
        orders!fk_payments_order (
          order_number
        )
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      const cleanSearch = search.trim().toLowerCase();

      // Collect user IDs matching auth email in memory
      const matchedAuthIds = [];
      authUsers.forEach((u) => {
        if (u.email && u.email.toLowerCase().includes(cleanSearch)) {
          matchedAuthIds.push(u.id);
        }
      });

      const filters = [
        `payment_intent_id.ilike.%${cleanSearch}%`,
        `payment_method.ilike.%${cleanSearch}%`,
        `payment_type.ilike.%${cleanSearch}%`,
      ];

      if (matchedAuthIds.length > 0) {
        filters.push(`user_id.in.(${matchedAuthIds.slice(0, 100).join(',')})`);
      }

      query = query.or(filters.join(','));
    }

    // Apply sorting (newest first)
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    const startRange = Number(offset);
    const endRange = startRange + Number(limit) - 1;
    query = query.range(startRange, endRange);

    const { data: payments, count, error } = await query;

    if (error) {
      throw new Error(`Failed to query transactions: ${error.message}`);
    }

    // Merge transactions with email details
    const mergedTransactions = payments.map((p) => {
      const email = authMap.get(p.user_id) || null;
      return {
        ...p,
        email,
      };
    });

    return {
      transactions: mergedTransactions,
      totalCount: count || 0,
    };
  } catch (error) {
    console.error('List transactions service error:', error);
    throw error;
  }
};

module.exports = {
  getReportsSummary,
  listTransactions,
};
