const {
  listVouchers,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  validateVoucherCode,
  getAvailableVouchers,
} = require('../services/discount.service');

const getVouchersHandler = async (req, res) => {
  try {
    const { limit, cursor, search } = req.query;
    const result = await listVouchers({ limit, cursor, search });
    return res.json(result);
  } catch (error) {
    console.error('List vouchers error:', error);
    return res.status(400).json({ message: error.message });
  }
};

const createVoucherHandler = async (req, res) => {
  try {
    const {
      code,
      discount_type,
      discount_value,
      start_date,
      end_date,
      usage_limit,
      limit_per_user,
      is_active,
      user_ids,
    } = req.body;

    if (!code) return res.status(400).json({ message: 'Voucher code is required' });
    if (!discount_type) return res.status(400).json({ message: 'Discount type is required' });

    const voucher = await createVoucher({
      code,
      discount_type,
      discount_value,
      start_date,
      end_date,
      usage_limit,
      limit_per_user,
      is_active,
      user_ids,
    });

    return res.status(201).json({
      message: 'Voucher created successfully',
      voucher,
    });
  } catch (error) {
    console.error('Create voucher error:', error);
    return res.status(400).json({ message: error.message });
  }
};

const updateVoucherHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      discount_type,
      discount_value,
      start_date,
      end_date,
      usage_limit,
      limit_per_user,
      is_active,
      user_ids,
    } = req.body;

    const voucher = await updateVoucher(id, {
      discount_type,
      discount_value,
      start_date,
      end_date,
      usage_limit,
      limit_per_user,
      is_active,
      user_ids,
    });

    return res.json({
      message: 'Voucher updated successfully',
      voucher,
    });
  } catch (error) {
    console.error('Update voucher error:', error);
    return res.status(400).json({ message: error.message });
  }
};

const deleteVoucherHandler = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteVoucher(id);
    return res.json({ message: 'Voucher deleted successfully' });
  } catch (error) {
    console.error('Delete voucher error:', error);
    return res.status(400).json({ message: error.message });
  }
};

const validateVoucherHandler = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ message: 'Code is required' });

    const userId = req.user?.id || null;
    const validationResult = await validateVoucherCode(code, Number(subtotal || 0), userId);
    return res.json({
      message: 'Voucher valid',
      ...validationResult,
    });
  } catch (error) {
    console.error('Validate voucher error:', error);
    return res.status(400).json({ message: error.message });
  }
};

const getAvailableVouchersHandler = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const subtotal = Number(req.query.subtotal || 0);
    const vouchers = await getAvailableVouchers(userId, subtotal);
    return res.json({ vouchers });
  } catch (error) {
    console.error('Get available vouchers error:', error);
    return res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getVouchersHandler,
  createVoucherHandler,
  updateVoucherHandler,
  deleteVoucherHandler,
  validateVoucherHandler,
  getAvailableVouchersHandler,
};
