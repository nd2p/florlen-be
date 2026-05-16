const {
  listCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  removeCollection,
  addProductsToCollection,
  removeProductFromCollection,
  updateProductSortOrder,
} = require('../services/collection.service');

/**
 * GET /api/collections
 */
const getCollections = async (req, res) => {
  try {
    const { cursor, limit, type, is_featured, sort_by } = req.query;
    const result = await listCollections({ cursor, limit, type, is_featured, sort_by });
    res.json(result);
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * GET /api/collections/:id
 */
const getCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await getCollectionById(id);
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
    res.json({ collection });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/collections
 */
const create = async (req, res) => {
  try {
    const required = ['name', 'slug', 'collection_type'];
    const missing = required.filter((f) => !(f in req.body));
    if (missing.length)
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });

    const payload = {
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description || null,
      collection_type: req.body.collection_type,
      is_active: req.body.is_active ?? true,
      is_featured: req.body.is_featured ?? false,
      starts_at: req.body.starts_at || null,
      ends_at: req.body.ends_at || null,
      countdown_visible: req.body.countdown_visible ?? false,
      meta_title: req.body.meta_title || null,
      meta_description: req.body.meta_description || null,
      cover_image_url: req.body.cover_image_url || null,
      banner_image_url: req.body.banner_image_url || null,
      sort_order: req.body.sort_order ?? 0,
      created_by: req.user?.profile?.id || null,
    };

    const collection = await createCollection(payload);
    res.status(201).json({ collection });
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * PATCH /api/collections/:id
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      'name',
      'slug',
      'description',
      'collection_type',
      'is_active',
      'is_featured',
      'starts_at',
      'ends_at',
      'countdown_visible',
      'meta_title',
      'meta_description',
      'cover_image_url',
      'banner_image_url',
      'sort_order',
    ];
    const updateData = {};
    allowed.forEach((f) => {
      if (f in req.body) updateData[f] = req.body[f];
    });

    const collection = await updateCollection(id, updateData);
    res.json({ collection });
  } catch (error) {
    console.error('Update collection error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * DELETE /api/collections/:id
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await removeCollection(id);
    res.json({ message: 'Collection deleted', collection });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/collections/:id/products
 */
const addProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { product_ids } = req.body;
    const items = await addProductsToCollection(id, product_ids);
    res.status(201).json({ items });
  } catch (error) {
    console.error('Add products error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * DELETE /api/collections/:id/products/:productId
 */
const removeProduct = async (req, res) => {
  try {
    const { id, productId } = req.params;
    await removeProductFromCollection(id, productId);
    res.json({ message: 'Product removed from collection' });
  } catch (error) {
    console.error('Remove product error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * PATCH /api/collections/:id/products/:productId/sort
 */
const updateProductSort = async (req, res) => {
  try {
    const { id, productId } = req.params;
    const { sort_order } = req.body;
    if (typeof sort_order !== 'number')
      return res.status(400).json({ message: 'sort_order must be a number' });
    const item = await updateProductSortOrder(id, productId, sort_order);
    res.json({ item });
  } catch (error) {
    console.error('Update product sort error:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getCollections,
  getCollection,
  create,
  update,
  remove,
  addProducts,
  removeProduct,
  updateProductSort,
};
