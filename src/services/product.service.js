const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { uploadFile, deleteFile } = require('./storage.service');

const PRODUCT_IMAGE_BUCKET = process.env.SUPABASE_PRODUCT_IMAGE_BUCKET || 'product-images';
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

const listProducts = async ({ cursor, limit = 20, type, tag, collection }) => {
  let query = supabaseAdmin
    .from('products')
    .select('*, product_images(*)')
    .limit(Number(limit) + 1);

  if (type) query = query.eq('product_type', type);
  if (collection) query = query.eq('collection_id', collection);
  if (tag) query = query.contains('tags', [tag]);
  if (cursor) query = query.gt('id', cursor);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const hasMore = data.length > limit;
  if (hasMore) data.pop();
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { products: data, hasMore, nextCursor };
};

const getProductById = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*, product_images(*)')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const cleanupUploadedImages = async (images) => {
  await Promise.all(
    images
      .filter((image) => image.storage_path)
      .map(async (image) => {
        try {
          await deleteFile(image.bucket || PRODUCT_IMAGE_BUCKET, image.storage_path);
        } catch (error) {
          // Best-effort cleanup; keep original failure visible to caller.
          console.error('Failed to cleanup uploaded product image:', error);
        }
      })
  );
};

const buildProductImagePath = (originalName, index) => {
  const extension = (originalName || '').toLowerCase().endsWith('.png') ? '.png' : '.jpg';
  return `products/${Date.now()}-${index}-${crypto.randomUUID()}${extension}`;
};

const uploadProductImages = async (files = []) => {
  if (!files.length) {
    throw new Error('At least one image file is required');
  }

  const uploadedImages = [];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];

      if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
        throw new Error(`Unsupported image type: ${file.mimetype}`);
      }

      const storagePath = buildProductImagePath(file.originalname, index);
      const uploaded = await uploadFile(
        PRODUCT_IMAGE_BUCKET,
        storagePath,
        file.buffer,
        file.mimetype
      );

      uploadedImages.push({
        bucket: PRODUCT_IMAGE_BUCKET,
        url: uploaded.publicUrl,
        storage_path: uploaded.path,
        original_name: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
      });
    }

    return uploadedImages;
  } catch (error) {
    await cleanupUploadedImages(uploadedImages);
    throw error;
  }
};

const normalizeImageInput = async (image, productId, imageIndex) => {
  const storagePath = image.storage_path || image.storagePath;
  const publicUrl = image.url || image.publicUrl;

  if (!publicUrl && image.fileBuffer) {
    if (!image.bucket || !image.path || !image.contentType) {
      throw new Error('When uploading image buffers, bucket, path, and contentType are required');
    }

    const uploaded = await uploadFile(
      image.bucket,
      image.path,
      image.fileBuffer,
      image.contentType
    );
    return {
      product_id: productId,
      url: uploaded.publicUrl,
      storage_path: uploaded.path,
      alt_text: image.alt_text || null,
      width: image.width || null,
      height: image.height || null,
      sort_order: image.sort_order ?? imageIndex,
      is_primary: Boolean(image.is_primary),
    };
  }

  if (!publicUrl) {
    throw new Error(`Product image ${imageIndex + 1} must include url/publicUrl or fileBuffer`);
  }

  if (!storagePath && !image.fileBuffer) {
    throw new Error(`Product image ${imageIndex + 1} must include storage_path`);
  }

  return {
    product_id: productId,
    url: publicUrl,
    storage_path: storagePath || null,
    alt_text: image.alt_text || null,
    width: image.width || null,
    height: image.height || null,
    sort_order: image.sort_order ?? imageIndex,
    is_primary: Boolean(image.is_primary),
  };
};

const createProduct = async ({ product, images = [], variants = [] }) => {
  // Insert product
  const { data: createdProduct, error: productError } = await supabaseAdmin
    .from('products')
    .insert(product)
    .select()
    .single();

  if (productError) throw new Error(productError.message);

  const productId = createdProduct.id;
  const uploadedImages = [];

  // Prepare images with product_id and storage metadata
  const imagesPayload = [];
  for (let index = 0; index < images.length; index += 1) {
    const normalizedImage = await normalizeImageInput(images[index], productId, index);
    imagesPayload.push(normalizedImage);
    if (normalizedImage.storage_path) {
      uploadedImages.push({
        bucket: images[index].bucket || PRODUCT_IMAGE_BUCKET,
        storage_path: normalizedImage.storage_path,
      });
    }
  }

  const { data: createdImages, error: imagesError } = await supabaseAdmin
    .from('product_images')
    .insert(imagesPayload)
    .select();

  if (imagesError) {
    // Rollback product
    await supabaseAdmin.from('products').delete().eq('id', productId);
    await cleanupUploadedImages(uploadedImages);
    throw new Error(imagesError.message);
  }

  // Prepare variants with product_id
  const variantsPayload = variants.map((v) => ({
    product_id: productId,
    sku_suffix: v.sku_suffix,
    size: v.size || null,
    color_name: v.color_name || null,
    color_hex: v.color_hex || null,
    additional_price: v.additional_price ?? 0,
    stock_qty: v.stock_qty ?? 0,
    is_active: v.is_active ?? true,
    image_url: v.image_url || null,
  }));
  const { data: createdVariants, error: variantsError } = await supabaseAdmin
    .from('product_variants')
    .insert(variantsPayload)
    .select();

  if (variantsError) {
    // Rollback images and product
    await supabaseAdmin.from('product_images').delete().eq('product_id', productId);
    await supabaseAdmin.from('products').delete().eq('id', productId);
    await cleanupUploadedImages(uploadedImages);
    throw new Error(variantsError.message);
  }

  // Attach created relations to product response
  return { ...createdProduct, images: createdImages, variants: createdVariants };
};

const updateProduct = async (id, updateData) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const deleteProduct = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

module.exports = {
  listProducts,
  getProductById,
  uploadProductImages,
  createProduct,
  updateProduct,
  deleteProduct,
};
