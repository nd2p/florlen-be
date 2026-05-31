const { supabaseAdmin } = require('../config/supabase');
const { uploadFile, deleteFile } = require('./storage.service');

const PRODUCT_IMAGE_BUCKET = process.env.SUPABASE_PRODUCT_IMAGE_BUCKET || 'product-images';

const fetchProductWithRelations = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*, product_images(*), product_variants(*)')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const listProducts = async ({ cursor, offset, limit = 20, type, tag, collection, search, is_featured, sort_by, min_price, max_price, excludeAiBase }) => {
  let productIds = null;
  if (collection) {
    const { data: relData, error: relError } = await supabaseAdmin
      .from('collection_products')
      .select('product_id')
      .eq('collection_id', collection);

    if (relError) throw new Error(relError.message);

    productIds = relData.map((r) => r.product_id);
    if (productIds.length === 0) {
      return { products: [], hasMore: false, nextCursor: null };
    }
  }

  let query = supabaseAdmin
    .from('products')
    .select('*, product_images(*), product_variants(*)');

  if (excludeAiBase) {
    if (type === 'ai_base') {
      return { products: [], hasMore: false, nextCursor: null };
    }
    query = query.neq('product_type', 'ai_base');
  }

  if (offset !== undefined && offset !== null && offset !== '') {
    const start = Number(offset);
    query = query.range(start, start + Number(limit));
  } else {
    query = query.limit(Number(limit) + 1);
    if (cursor) query = query.gt('id', cursor);
  }

  if (type) query = query.eq('product_type', type);
  if (productIds) query = query.in('id', productIds);
  if (tag) query = query.contains('tags', [tag]);
  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  if (min_price !== undefined && min_price !== null && min_price !== '') query = query.gte('base_price', Number(min_price));
  if (max_price !== undefined && max_price !== null && max_price !== '') query = query.lte('base_price', Number(max_price));

  if (is_featured !== undefined) {
    if (String(is_featured) === 'true') query = query.eq('is_featured', true);
    if (String(is_featured) === 'false') query = query.eq('is_featured', false);
  }

  if (sort_by === 'price_asc') {
    query = query.order('base_price', { ascending: true }).order('id', { ascending: true });
  } else if (sort_by === 'price_desc') {
    query = query.order('base_price', { ascending: false }).order('id', { ascending: true });
  } else if (sort_by === 'updated_at') {
    query = query.order('updated_at', { ascending: false });
  } else {
    query = query.order('id', { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const hasMore = data.length > Number(limit);
  if (hasMore) data.pop();
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { products: data, hasMore, nextCursor };
};

const getProductById = async (id) => {
  return fetchProductWithRelations(id);
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

const normalizeImageInput = async (image, productId, imageIndex, isActive = true) => {
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
      is_active: isActive,
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
    is_active: isActive,
  };
};

const normalizeVariantInput = (variant, productId, isActive = true) => ({
  product_id: productId,
  sku_suffix: variant.sku_suffix,
  size: variant.size || null,
  color_name: variant.color_name || null,
  color_hex: variant.color_hex || null,
  additional_price: variant.additional_price ?? 0,
  stock_qty: variant.stock_qty ?? 0,
  is_active: isActive,
  image_url: variant.image_url || null,
});

const syncProductImages = async (productId, images, productIsActive = true) => {
  const { data: existingImages, error: existingImagesError } = await supabaseAdmin
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (existingImagesError) throw new Error(existingImagesError.message);

  const existingImageMap = new Map(existingImages.map((image) => [image.id, image]));
  const incomingImageIds = new Set();
  const uploadedImages = [];
  const imageEntries = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];

    if (image?.id && existingImageMap.has(image.id)) {
      const existingImage = existingImageMap.get(image.id);
      incomingImageIds.add(image.id);
      imageEntries.push({
        type: 'update',
        id: image.id,
        payload: {
          product_id: productId,
          url: image.url || image.publicUrl || existingImage.url,
          storage_path:
            existingImage.storage_path || image.storage_path || image.storagePath || null,
          alt_text: image.alt_text !== undefined ? image.alt_text : existingImage.alt_text || null,
          width: image.width !== undefined ? image.width : existingImage.width || null,
          height: image.height !== undefined ? image.height : existingImage.height || null,
          sort_order: image.sort_order ?? index,
          is_primary: image.is_primary ?? existingImage.is_primary ?? false,
          is_active: productIsActive ? image.is_active ?? true : false,
        },
      });
      continue;
    }

    const normalizedImage = await normalizeImageInput(image, productId, index, productIsActive);
    imageEntries.push({ type: 'insert', payload: normalizedImage });

    if (normalizedImage.storage_path) {
      uploadedImages.push({
        bucket: image.bucket || PRODUCT_IMAGE_BUCKET,
        storage_path: normalizedImage.storage_path,
      });
    }
  }

  const primaryIndex = imageEntries.findIndex((entry) => entry.payload.is_primary);
  if (primaryIndex !== -1) {
    imageEntries.forEach((entry, index) => {
      if (index !== primaryIndex) {
        entry.payload.is_primary = false;
      }
    });
  }

  const deletedImages = existingImages.filter((image) => !incomingImageIds.has(image.id));
  const insertedImageIds = [];

  const rollback = async () => {
    if (insertedImageIds.length) {
      await supabaseAdmin.from('product_images').delete().in('id', insertedImageIds);
    }

    if (existingImages.length) {
      await supabaseAdmin.from('product_images').upsert(existingImages, { onConflict: 'id' });
    }

    await cleanupUploadedImages(uploadedImages);
  };

  try {
    if (existingImages.length) {
      const { error: resetPrimaryError } = await supabaseAdmin
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId);

      if (resetPrimaryError) throw new Error(resetPrimaryError.message);
    }

    for (const entry of imageEntries) {
      if (entry.type === 'update') {
        const { error: updateError } = await supabaseAdmin
          .from('product_images')
          .update(entry.payload)
          .eq('id', entry.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        const { data: insertedImage, error: insertError } = await supabaseAdmin
          .from('product_images')
          .insert(entry.payload)
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);
        if (insertedImage?.id) insertedImageIds.push(insertedImage.id);
      }
    }

    if (deletedImages.length) {
      const { error: deleteError } = await supabaseAdmin
        .from('product_images')
        .delete()
        .in(
          'id',
          deletedImages.map((image) => image.id)
        );

      if (deleteError) throw new Error(deleteError.message);
    }

    const { data: syncedImages, error: syncedImagesError } = await supabaseAdmin
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (syncedImagesError) throw new Error(syncedImagesError.message);

    return { images: syncedImages, deletedImages, rollback };
  } catch (error) {
    await rollback();
    throw error;
  }
};

const syncProductVariants = async (productId, variants, productIsActive = true) => {
  const { data: existingVariants, error: existingVariantsError } = await supabaseAdmin
    .from('product_variants')
    .select('*')
    .eq('product_id', productId);

  if (existingVariantsError) throw new Error(existingVariantsError.message);

  const existingVariantMap = new Map(existingVariants.map((v) => [v.sku_suffix, v]));
  const incomingSkuSuffixes = new Set(variants.map((v) => v.sku_suffix));

  const normalizedVariants = variants.map((variant) =>
    normalizeVariantInput(variant, productId, productIsActive)
  );

  const variantsToUpsert = normalizedVariants.map((incoming) => {
    const existing = existingVariantMap.get(incoming.sku_suffix);
    if (existing) {
      return {
        id: existing.id,
        ...incoming,
      };
    }
    return incoming;
  });

  const idsToDelete = existingVariants
    .filter((v) => v.is_active !== false && !incomingSkuSuffixes.has(v.sku_suffix))
    .map((v) => v.id);

  const rollback = async () => {
    // Delete any variants that were created brand new (not present in existing variant map)
    const { data: currentVariants } = await supabaseAdmin
      .from('product_variants')
      .select('id, sku_suffix')
      .eq('product_id', productId);

    if (currentVariants) {
      const newIds = currentVariants
        .filter((v) => !existingVariantMap.has(v.sku_suffix))
        .map((v) => v.id);
      if (newIds.length) {
        await supabaseAdmin.from('product_variants').delete().in('id', newIds);
      }
    }

    // Restore original existing variants (reverses deletes and updates)
    if (existingVariants.length) {
      await supabaseAdmin.from('product_variants').upsert(existingVariants);
    }
  };

  try {
    let syncedVariants = [];

    if (variantsToUpsert.length) {
      const { data: upsertedVariants, error: upsertError } = await supabaseAdmin
        .from('product_variants')
        .upsert(variantsToUpsert)
        .select();

      if (upsertError) throw new Error(upsertError.message);
      syncedVariants = upsertedVariants || [];
    }

    if (idsToDelete.length) {
      const { error: deleteError } = await supabaseAdmin
        .from('product_variants')
        .update({ is_active: false })
        .in('id', idsToDelete);

      if (deleteError) throw new Error(deleteError.message);
    }

    return { variants: syncedVariants, rollback };
  } catch (error) {
    await rollback();
    throw error;
  }
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
  const productIsActive = createdProduct.is_active ?? true;
  const uploadedImages = [];

  // Prepare images with product_id and storage metadata
  const imagesPayload = [];
  for (let index = 0; index < images.length; index += 1) {
    const normalizedImage = await normalizeImageInput(
      images[index],
      productId,
      index,
      productIsActive
    );
    imagesPayload.push(normalizedImage);
    if (normalizedImage.storage_path) {
      uploadedImages.push({
        bucket: images[index].bucket || PRODUCT_IMAGE_BUCKET,
        storage_path: normalizedImage.storage_path,
      });
    }
  }

  const { error: imagesError } = await supabaseAdmin
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
    is_active: productIsActive ? v.is_active ?? true : false,
    image_url: v.image_url || null,
  }));
  const { error: variantsError } = await supabaseAdmin
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

  // Return a fresh read so the caller receives the latest persisted relations
  return fetchProductWithRelations(productId);
};

const updateProduct = async (id, updateData = {}) => {
  const { product: nestedProduct, images, variants, ...flatProductUpdates } = updateData;
  const productUpdates = {
    ...flatProductUpdates,
    ...(nestedProduct && typeof nestedProduct === 'object' && !Array.isArray(nestedProduct)
      ? nestedProduct
      : {}),
  };

  if (
    Object.keys(productUpdates).length === 0 &&
    !Array.isArray(images) &&
    !Array.isArray(variants)
  ) {
    throw new Error('No fields to update');
  }

  const existingProduct = await fetchProductWithRelations(id);
  if (existingProduct.product_type === 'ai_base') {
    throw new Error('AI Base products cannot be modified');
  }
  const targetProductIsActive = productUpdates.is_active ?? existingProduct.is_active ?? true;

  // If reactivating a soft-deleted product, reset deleted_at
  if (productUpdates.is_active === true && existingProduct.deleted_at) {
    productUpdates.deleted_at = null;
  }
  let imageSyncResult = null;
  let variantSyncResult = null;

  try {
    if (Array.isArray(images)) {
      imageSyncResult = await syncProductImages(id, images, targetProductIsActive);
    }

    if (Array.isArray(variants)) {
      variantSyncResult = await syncProductVariants(id, variants, targetProductIsActive);
    }

    if (Object.keys(productUpdates).length > 0) {
      const { error: productError } = await supabaseAdmin
        .from('products')
        .update(productUpdates)
        .eq('id', id);

      if (productError) throw new Error(productError.message);
    }

    if (imageSyncResult?.deletedImages?.length) {
      await cleanupUploadedImages(imageSyncResult.deletedImages);
    }

    return fetchProductWithRelations(id);
  } catch (error) {
    try {
      if (variantSyncResult) {
        await variantSyncResult.rollback();
      }

      if (imageSyncResult) {
        await imageSyncResult.rollback();
      }

      if (Object.keys(productUpdates).length > 0) {
        const restoredProduct = { ...existingProduct };
        delete restoredProduct.product_images;
        delete restoredProduct.product_variants;
        delete restoredProduct.id;
        delete restoredProduct.created_at;
        delete restoredProduct.updated_at;
        await supabaseAdmin.from('products').update(restoredProduct).eq('id', id);
      }
    } catch (rollbackError) {
      console.error('Failed to rollback product update:', rollbackError);
    }

    throw error;
  }
};

const deleteProduct = async (id) => {
  const existingProduct = await fetchProductWithRelations(id);
  if (existingProduct.product_type === 'ai_base') {
    throw new Error('AI Base products cannot be deleted');
  }
  const productImages = existingProduct.product_images || [];
  const productVariants = existingProduct.product_variants || [];

  const restoreImages = async () => {
    if (productImages.length) {
      await supabaseAdmin.from('product_images').upsert(productImages, { onConflict: 'id' });
    }
  };

  const restoreVariants = async () => {
    if (productVariants.length) {
      await supabaseAdmin.from('product_variants').upsert(productVariants, { onConflict: 'id' });
    }
  };

  try {
    if (productVariants.length) {
      const { error: variantDeleteError } = await supabaseAdmin
        .from('product_variants')
        .update({ is_active: false })
        .eq('product_id', id);

      if (variantDeleteError) throw new Error(variantDeleteError.message);
    }

    if (productImages.length) {
      const { error: imageDeleteError } = await supabaseAdmin
        .from('product_images')
        .update({ is_active: false })
        .eq('product_id', id);

      if (imageDeleteError) throw new Error(imageDeleteError.message);
    }

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
  } catch (error) {
    try {
      await restoreImages();
      await restoreVariants();
    } catch (rollbackError) {
      console.error('Failed to rollback product delete:', rollbackError);
    }

    throw error;
  }
};

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
