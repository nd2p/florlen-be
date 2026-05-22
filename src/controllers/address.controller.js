const {
  listAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require('../services/address.service');

/**
 * GET /api/addresses
 * List all addresses for the authenticated user
 */
const getAddresses = async (req, res) => {
  try {
    const addresses = await listAddresses(req.user.id);
    res.json({
      message: 'Addresses retrieved successfully',
      addresses,
    });
  } catch (error) {
    console.error('getAddresses error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/addresses/:id
 * Get a single address (must belong to authenticated user)
 */
const getSingleAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const address = await getAddress(id, req.user.id);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }
    res.json({
      message: 'Address retrieved successfully',
      address,
    });
  } catch (error) {
    console.error('getSingleAddress error:', error);
    if (error.message === 'Address not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/addresses
 * Create a new address for the authenticated user
 */
const createAddressHandler = async (req, res) => {
  try {
    const { recipientName, phone, addressLine1, city, countryCode, label, isDefault } = req.body;

    if (!recipientName || !phone || !addressLine1 || !city) {
      return res.status(400).json({
        message: 'Missing required fields: recipientName, phone, addressLine1, city',
      });
    }

    const address = await createAddress(req.user.id, {
      recipientName,
      phone,
      addressLine1,
      city,
      countryCode,
      label,
      isDefault,
    });

    res.status(201).json({
      message: 'Address created successfully',
      address,
    });
  } catch (error) {
    console.error('createAddress error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * PATCH /api/addresses/:id
 * Partially update an address (must belong to authenticated user)
 */
const updateAddressHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientName, phone, addressLine1, city, countryCode, label, isDefault } = req.body;

    const address = await updateAddress(id, req.user.id, {
      recipientName,
      phone,
      addressLine1,
      city,
      countryCode,
      label,
      isDefault,
    });

    res.json({
      message: 'Address updated successfully',
      address,
    });
  } catch (error) {
    console.error('updateAddress error:', error);
    if (error.message === 'Address not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'No fields to update') {
      return res.status(400).json({ message: error.message });
    }
    res.status(400).json({ message: error.message });
  }
};

/**
 * DELETE /api/addresses/:id
 * Delete an address (must belong to authenticated user)
 */
const deleteAddressHandler = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteAddress(id, req.user.id);
    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error('deleteAddress error:', error);
    if (error.message === 'Address not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/addresses/:id/set-default
 * Set an address as the default shipping address
 */
const setDefaultAddressHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const address = await setDefaultAddress(id, req.user.id);
    res.json({
      message: 'Default address updated successfully',
      address,
    });
  } catch (error) {
    console.error('setDefaultAddress error:', error);
    if (error.message === 'Address not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAddresses,
  getSingleAddress,
  createAddressHandler,
  updateAddressHandler,
  deleteAddressHandler,
  setDefaultAddressHandler,
};
