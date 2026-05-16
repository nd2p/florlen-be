const { supabaseAdmin } = require('../config/supabase');

const listCollections = async ({
  cursor,
  limit = 20,
  type,
  is_featured,
  sort_by = 'sort_order',
} = {}) => {
  let query = supabaseAdmin
    .from('collections')
    .select('*, collection_products(*)')
    .eq('is_active', true)
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
    .eq('is_active', true)
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
  const { data, error } = await supabaseAdmin
    .from('collections')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

const removeCollection = async (id) => {
  const { data, error } = await supabaseAdmin
    .from('collections')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

const addProductsToCollection = async (collectionId, productIds = []) => {
  if (!Array.isArray(productIds) || productIds.length === 0)
    throw new Error('product_ids must be a non-empty array');

  const rows = productIds.map((product_id, index) => ({
    collection_id: collectionId,
    product_id,
    sort_order: index,
  }));

  const { data, error } = await supabaseAdmin.from('collection_products').insert(rows).select();
  if (error) throw new Error(error.message);
  return data;
};

const removeProductFromCollection = async (collectionId, productId) => {
  const { error } = await supabaseAdmin
    .from('collection_products')
    .delete()
    .eq('collection_id', collectionId)
    .eq('product_id', productId);
  if (error) throw new Error(error.message);
  return true;
};

const updateProductSortOrder = async (collectionId, productId, sort_order) => {
  const { data, error } = await supabaseAdmin
    .from('collection_products')
    .update({ sort_order })
    .eq('collection_id', collectionId)
    .eq('product_id', productId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

module.exports = {
  listCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  removeCollection,
  addProductsToCollection,
  removeProductFromCollection,
  updateProductSortOrder,
};
