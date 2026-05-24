const {
  createOrder,
  getOrders,
  getOrderMetrics,
  getOrderById,
  cancelOrder,
  payRemaining,
  getAllOrdersAdmin,
  updateOrderStatusAdmin,
  confirmPayment,
} = require('../services/order.service');
const { getPayOS, getPaymentLogs } = require('../services/payment.service');


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders — Create order + PayOS payment link
// ─────────────────────────────────────────────────────────────────────────────
const createOrderHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { cartId, paymentOption, addressId, note } = req.body;

    if (!cartId) return res.status(400).json({ message: 'cartId is required' });
    if (!paymentOption || !['full', 'deposit'].includes(paymentOption)) {
      return res.status(400).json({ message: 'paymentOption must be "full" or "deposit"' });
    }
    if (!addressId) return res.status(400).json({ message: 'addressId is required' });

    const result = await createOrder({ userId, cartId, paymentOption, addressId, note });

    return res.status(201).json({
      message: 'Order created successfully',
      ...result,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders — List current user's orders
// ─────────────────────────────────────────────────────────────────────────────
const getOrdersHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { cursor, limit, status } = req.query;
    const result = await getOrders(userId, {
      cursor,
      limit: limit ? Number(limit) : 20,
      status,
    });

    return res.json(result);
  } catch (error) {
    console.error('Get orders error:', error);
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/:id — Order detail
// ─────────────────────────────────────────────────────────────────────────────
const getOrderByIdHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    const order = await getOrderById(userId, id, isAdmin);

    return res.json({ order });
  } catch (error) {
    console.error('Get order detail error:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ message: error.message });
    }
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/:id/cancel — Cancel order (customer)
// ─────────────────────────────────────────────────────────────────────────────
const cancelOrderHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const order = await cancelOrder(userId, id);

    return res.json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    console.error('Cancel order error:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ message: error.message });
    }
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/:id/pay-remaining — Pay remaining 70%
// ─────────────────────────────────────────────────────────────────────────────
const payRemainingHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const result = await payRemaining(userId, id);

    return res.json({
      message: 'Payment link created for remaining balance',
      ...result,
    });
  } catch (error) {
    console.error('Pay remaining error:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ message: error.message });
    }
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/orders — List all orders in system (admin)
// ─────────────────────────────────────────────────────────────────────────────
const getAllOrdersAdminHandler = async (req, res) => {
  try {
    const { cursor, limit, status, paymentStage, userId, startDate, endDate, search } = req.query;
    const result = await getAllOrdersAdmin({
      cursor,
      limit: limit ? Number(limit) : 20,
      status,
      paymentStage,
      userId,
      startDate,
      endDate,
      search,
    });

    return res.json(result);
  } catch (error) {
    console.error('Get all orders admin error:', error);
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/orders/:id/status — Update order status (admin)
// ─────────────────────────────────────────────────────────────────────────────
const updateOrderStatusAdminHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const changedBy = req.user?.id;

    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }

    const order = await updateOrderStatusAdmin(id, status, changedBy);

    return res.json({
      message: 'Order status updated successfully',
      order,
    });
  } catch (error) {
    console.error('Update order status admin error:', error);
    if (error.message === 'Order not found') {
      return res.status(404).json({ message: error.message });
    }
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/sync-payment — Sync payment status with PayOS and confirm
// ─────────────────────────────────────────────────────────────────────────────
const syncPaymentHandler = async (req, res) => {
  try {
    const { orderCode } = req.body;
    if (!orderCode) {
      return res.status(400).json({ message: 'orderCode is required' });
    }

    const payosClient = getPayOS();
    const paymentInfo = await payosClient.paymentRequests.get(orderCode);

    if (paymentInfo.status === 'PAID') {
      const result = await confirmPayment(orderCode, paymentInfo.amount, paymentInfo);
      return res.json({
        success: true,
        message: 'Payment synchronized and confirmed successfully',
        ...result,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: `Payment status on PayOS is ${paymentInfo.status}, not PAID`,
      });
    }
  } catch (error) {
    console.error('Sync payment error:', error);
    return res.status(400).json({ message: error.message });
  }
};

const getOrderMetricsHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const metrics = await getOrderMetrics(userId);
    return res.json(metrics);
  } catch (error) {
    console.error('Get order metrics error:', error);
    return res.status(400).json({ message: error.message });
  }
};

const getPaymentLogsHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const payments = await getPaymentLogs(userId);
    return res.json({ payments });
  } catch (error) {
    console.error('Get payment logs error:', error);
    return res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createOrderHandler,
  getOrdersHandler,
  getOrderMetricsHandler,
  getPaymentLogsHandler,
  getOrderByIdHandler,
  cancelOrderHandler,
  payRemainingHandler,
  getAllOrdersAdminHandler,
  updateOrderStatusAdminHandler,
  syncPaymentHandler,
};
