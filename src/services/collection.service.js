const { supabaseAdmin } = require('../config/supabase');
const { deleteFile } = require('./storage.service');

const COLLECTION_IMAGE_BUCKET = process.env.SUPABASE_COLLECTION_IMAGE_BUCKET || 'collection-images';

const getStoragePathFromPublicUrl = (url, bucket = COLLECTION_IMAGE_BUCKET) => {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);
    const pathname = decodeURIComponent(parsed.pathname || '');
    const publicPrefix = `/storage/v1/object/public/${bucket}/`;
    const genericBucketPrefix = `/${bucket}/`;

    const publicIndex = pathname.indexOf(publicPrefix);
    if (publicIndex !== -1) {
      return pathname.slice(publicIndex + publicPrefix.length) || null;
    }

    const bucketIndex = pathname.indexOf(genericBucketPrefix);
    if (bucketIndex !== -1) {
      return pathname.slice(bucketIndex + genericBucketPrefix.length) || null;
    }
  } catch (error) {
    return null;
  }

  return null;
};

const cleanupCollectionImages = async (urls = []) => {
  await Promise.all(
    urls.filter(Boolean).map(async (url) => {
      const storagePath = getStoragePathFromPublicUrl(url, COLLECTION_IMAGE_BUCKET);
      if (!storagePath) return;

      try {
        await deleteFile(COLLECTION_IMAGE_BUCKET, storagePath);
      } catch (error) {
        // Best-effort cleanup after row update.
        console.error('Failed to cleanup collection image from storage:', error);
      }
    })
  );
};

const listCollections = async ({
  cursor,
  limit = 20,
  type,
  is_featured,
  sort_by = 'sort_order',
} = {}) => {
  let query = supabaseAdmin
    .from('collections')
    .select(
      `
      *,
      collection_products (
        product_id,
        sort_order,
        products (id, sku, name, slug, base_price, product_images (url, alt_text, is_primary))
      )
      `
    )
    .limit(Number(limit) + 1);

  if (type) query = query.eq('collection_type', type);
  if (is_featured !== undefined) {
    if (String(is_featured) === 'true') query = query.eq('is_featured', true);
    if (String(is_featured) === 'false') query = query.eq('is_featured', false);
  }
  if (cursor) query = query.gt('id', cursor);

  query = query.order(sort_by, { ascending: sort_by === 'sort_order' });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const hasMore = data.length > limit;
  if (hasMore) data.pop();
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { collections: data, hasMore, nextCursor };
};

const getCollectionById = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('collections')
    .select(
      `
      *,
      collection_products (
        product_id,
        sort_order,
        products (id, sku, name, slug, base_price, product_images (url, alt_text, is_primary))
      )
      `
    )
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message || 'Collection not found');
  return data;
};

const createCollection = async (payload) => {
  const { data, error } = await supabaseAdmin.from('collections').insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data;
};

const updateCollection = async (id, updateData) => {
  const { data: existingCollection, error: existingCollectionError } = await supabaseAdmin
    .from('collections')
    .select('id, cover_image_url, banner_image_url')
    .eq('id', id)
    .single();

  if (existingCollectionError) throw new Error(existingCollectionError.message);

  const { data, error } = await supabaseAdmin
    .from('collections')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  const removedOrReplacedUrls = [];

  if (
    Object.prototype.hasOwnProperty.call(updateData, 'cover_image_url') &&
    existingCollection.cover_image_url &&
    existingCollection.cover_image_url !== data.cover_image_url
  ) {
    removedOrReplacedUrls.push(existingCollection.cover_image_url);
  }

  if (
    Object.prototype.hasOwnProperty.call(updateData, 'banner_image_url') &&
    existingCollection.banner_image_url &&
    existingCollection.banner_image_url !== data.banner_image_url
  ) {
    removedOrReplacedUrls.push(existingCollection.banner_image_url);
  }

  if (removedOrReplacedUrls.length) {
    await cleanupCollectionImages(removedOrReplacedUrls);
  }

  return data;
};

const removeCollection = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('collections')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

const syncProductsInCollection = async (collectionId, productIds = []) => {
  const { error: delError } = await supabaseAdmin
    .from('collection_products')
    .delete()
    .eq('collection_id', collectionId);
  if (delError) throw new Error(delError.message);

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return [];
  }

  const rows = productIds.map((product_id, index) => ({
    collection_id: collectionId,
    product_id,
    sort_order: index,
  }));

  const { data, error } = await supabaseAdmin.from('collection_products').insert(rows).select();
  if (error) throw new Error(error.message);
  return data;
};

module.exports = {
  listCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  removeCollection,
  syncProductsInCollection,
};
