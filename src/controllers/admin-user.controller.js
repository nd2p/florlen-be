const adminUserService = require('../services/admin-user.service');
const { ROLE } = require('../config/constants');

/**
 * GET /api/admin/users
 * Retrieve list of all users in the system (Admin only)
 */
const listUsersHandler = async (req, res) => {
  try {
    const { search, role, status, limit = 20, offset = 0 } = req.query;

    // Validate inputs
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    if (role && !Object.values(ROLE).includes(role)) {
      return res.status(400).json({ message: 'Invalid role filter value' });
    }

    if (status && !['active', 'inactive', 'banned'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status filter value' });
    }

    const { users, totalCount } = await adminUserService.listUsers({
      search,
      role,
      status,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    return res.status(200).json({
      message: 'Lấy danh sách người dùng thành công',
      users,
      pagination: {
        totalCount,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < totalCount,
      },
    });
  } catch (error) {
    console.error('List users handler error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * GET /api/admin/users/:id
 * Retrieve detailed profile of a specific user (Admin only)
 */
const getUserByIdHandler = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await adminUserService.getUserById(id);

    return res.status(200).json({
      message: 'Lấy thông tin chi tiết người dùng thành công',
      user,
    });
  } catch (error) {
    console.error('Get user by id handler error:', error);
    if (error.message.includes('Profile not found')) {
      return res.status(404).json({ message: 'User profile not found' });
    }
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * PATCH /api/admin/users/:id
 * Update user profile details, role, active status, or ban status (Admin only)
 */
const updateUserHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      display_name,
      phone_number,
      role,
      is_active,
      is_banned,
      banned_reason,
    } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const updateData = {};

    // Validate and build update payload
    if (full_name !== undefined) updateData.full_name = full_name;
    if (display_name !== undefined) updateData.display_name = display_name;
    if (phone_number !== undefined) updateData.phone_number = phone_number;

    if (role !== undefined) {
      if (!Object.values(ROLE).includes(role)) {
        return res.status(400).json({ message: 'Invalid role value' });
      }
      // Safety rule matching PostgreSQL trigger: user cannot change their own role
      if (req.user.id === id && role !== req.user.role) {
        return res.status(400).json({ message: 'Bạn không thể tự thay đổi vai trò của chính mình' });
      }
      updateData.role = role;
    }

    if (is_active !== undefined) {
      updateData.is_active = Boolean(is_active);
    }

    if (is_banned !== undefined) {
      updateData.is_banned = Boolean(is_banned);
      if (updateData.is_banned && banned_reason) {
        updateData.banned_reason = banned_reason;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Không có thông tin nào để cập nhật' });
    }

    const updatedUser = await adminUserService.updateUser(id, updateData);

    return res.status(200).json({
      message: 'Cập nhật tài khoản người dùng thành công',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update user handler error:', error);
    if (error.message.includes('Profile not found')) {
      return res.status(404).json({ message: 'User profile not found' });
    }
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

module.exports = {
  listUsersHandler,
  getUserByIdHandler,
  updateUserHandler,
};
