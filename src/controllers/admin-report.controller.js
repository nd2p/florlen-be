const adminReportService = require('../services/admin-report.service');

/**
 * GET /api/admin/reports/summary
 * Retrieve statistics and chart aggregates for admin sales reporting dashboard
 */
const getReportsSummaryHandler = async (req, res) => {
  try {
    const summary = await adminReportService.getReportsSummary();

    return res.status(200).json({
      message: 'Lấy báo cáo tổng quan thành công',
      ...summary,
    });
  } catch (error) {
    console.error('Reports summary handler error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * GET /api/admin/reports/transactions
 * Retrieve payment transactions log (Admin only)
 */
const listTransactionsHandler = async (req, res) => {
  try {
    const { search, status, limit = 20, offset = 0 } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    if (status && !['pending', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded'].includes(status)) {
      return res.status(400).json({ message: 'Invalid transaction status' });
    }

    const { transactions, totalCount } = await adminReportService.listTransactions({
      search,
      status,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    return res.status(200).json({
      message: 'Lấy danh sách giao dịch thành công',
      transactions,
      pagination: {
        totalCount,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < totalCount,
      },
    });
  } catch (error) {
    console.error('List transactions handler error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

module.exports = {
  getReportsSummaryHandler,
  listTransactionsHandler,
};
