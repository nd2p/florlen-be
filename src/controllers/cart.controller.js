const {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  mergeCart,
} = require('../services/cart.service');

/**
 * Resolve the cart owner context from the request.
 * Authenticated users → userId;  guests → x-session-id header.
 */
const resolveOwner = (req) => ({
  userId: req.user?.id ?? null,
  sessionId: req.headers['x-session-id'] ?? null,
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cart
// ─────────────────────────────────────────────────────────────────────────────
const getCartHandler = async (req, res) => {
  try {
    const owner = resolveOwner(req);
    if (!owner.userId && !owner.sessionId) {
      return res.status(400).json({ message: 'x-session-id header is required for guest carts' });
    }

    const cart = await getCart(owner);
    return res.json({ cart });
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cart/items
// ─────────────────────────────────────────────────────────────────────────────
const addItemHandler = async (req, res) => {
  try {
    const owner = resolveOwner(req);
    if (!owner.userId && !owner.sessionId) {
      return res.status(400).json({ message: 'x-session-id header is required for guest carts' });
    }

    const { item_type, product_id, variant_id, quantity, design_id } = req.body;

    if (!item_type) return res.status(400).json({ message: 'item_type is required' });
    if (!product_id) return res.status(400).json({ message: 'product_id is required' });

    const item = await addItem(owner, { item_type, product_id, variant_id, quantity, design_id });
    return res.status(201).json({ message: 'Item added to cart', item });
  } catch (error) {
    console.error('Add cart item error:', error);
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cart/items/:itemId
// ─────────────────────────────────────────────────────────────────────────────
const updateItemHandler = async (req, res) => {
  try {
    const owner = resolveOwner(req);
    if (!owner.userId && !owner.sessionId) {
      return res.status(400).json({ message: 'x-session-id header is required for guest carts' });
    }

    const { itemId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ message: 'quantity is required' });
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return res.status(400).json({ message: 'quantity must be a positive integer' });
    }

    const item = await updateItemQuantity(owner, itemId, Number(quantity));
    return res.json({ message: 'Cart item updated', item });
  } catch (error) {
    console.error('Update cart item error:', error);
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/cart/items/:itemId
// ─────────────────────────────────────────────────────────────────────────────
const removeItemHandler = async (req, res) => {
  try {
    const owner = resolveOwner(req);
    if (!owner.userId && !owner.sessionId) {
      return res.status(400).json({ message: 'x-session-id header is required for guest carts' });
    }

    const { itemId } = req.params;
    await removeItem(owner, itemId);
    return res.json({ message: 'Cart item removed' });
  } catch (error) {
    console.error('Remove cart item error:', error);
    return res.status(400).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cart/merge   (authenticated users only)
// ─────────────────────────────────────────────────────────────────────────────
const mergeCartHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'sessionId is required' });

    const result = await mergeCart(userId, sessionId);
    return res.json({ message: 'Cart merged successfully', ...result });
  } catch (error) {
    console.error('Merge cart error:', error);
    return res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getCartHandler,
  addItemHandler,
  updateItemHandler,
  removeItemHandler,
  mergeCartHandler,
};
