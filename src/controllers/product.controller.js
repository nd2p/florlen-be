const {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../services/product.service');
const { PRODUCT_TYPE } = require('../config/constants');

/**
 * GET /api/products
 */
const getProducts = async (req, res) => {
  try {
    const { cursor, limit, type, tag, collection } = req.query;
    const result = await listProducts({ cursor, limit, type, tag, collection });
    res.json(result);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * GET /api/products/:id
 */
const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await getProductById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/products (admin)
 */
const create = async (req, res) => {
  try {
    const requiredFields = [
      'sku',
      'name',
      'slug',
      'description',
      'base_price',
      'production_days_min',
      'production_days_max',
    ];

    const { product: nestedProduct, images, variants, ...flatPayload } = req.body;
    const productPayload = {
      ...flatPayload,
      ...(nestedProduct && typeof nestedProduct === 'object' && !Array.isArray(nestedProduct)
        ? nestedProduct
        : {}),
    };

    if (!productPayload.product_type) {
      productPayload.product_type = PRODUCT_TYPE.NORMAL;
    }

    const missing = requiredFields.filter((f) => !(f in productPayload));
    if (missing.length) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return res
        .status(400)
        .json({ message: 'Product images are required and must be a non-empty array' });
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      return res
        .status(400)
        .json({ message: 'Product variants are required and must be a non-empty array' });
    }

    // Minimal validation for image items and variant items
    const badImage = images.find(
      (img) => !img || typeof img.url !== 'string' || typeof img.storage_path !== 'string'
    );
    if (badImage)
      return res.status(400).json({
        message: 'Each product image must include valid `url` and `storage_path` strings',
      });

    const badVariant = variants.find((v) => !v || typeof v.sku_suffix !== 'string');
    if (badVariant)
      return res
        .status(400)
        .json({ message: 'Each product variant must include a valid `sku_suffix` string' });

    const product = await createProduct({ product: productPayload, images, variants });
    res.status(201).json({ product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * PATCH /api/products/:id (admin)
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { product: nestedProduct, images, variants, ...flatPayload } = req.body;
    const productPayload = {
      ...flatPayload,
      ...(nestedProduct && typeof nestedProduct === 'object' && !Array.isArray(nestedProduct)
        ? nestedProduct
        : {}),
    };

    const product = await updateProduct(id, {
      product: productPayload,
      images,
      variants,
    });
    res.json({ product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(400).json({ message: error.message });
  }
};

/**
 * DELETE /api/products/:id (admin)
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await deleteProduct(id);
    res.json({ message: 'Product deleted', product });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getProduct,
  create,
  update,
  remove,
};
