const { supabaseAdmin } = require('../config/supabase');
const aiService = require('./ai.service');
const cartService = require('./cart.service');

// Daily creation limit for AI Studio designs
const MAX_DESIGNS_PER_DAY = 3;

/**
 * Helper to check if user has reached their daily design limit.
 */
const checkDailyLimit = async (userId) => {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from('designs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString());

  if (error) {
    console.error('Error checking daily limit:', error.message);
    return; // Don't block if database check fails
  }

  if (count >= MAX_DESIGNS_PER_DAY) {
    throw new Error(`Bạn đã đạt giới hạn tối đa ${MAX_DESIGNS_PER_DAY} bản thiết kế trong ngày hôm nay. Vui lòng quay lại vào ngày mai!`);
  }
};

const settingsService = require('./settings.service');


/**
 * Calculates customization fee and sums up selected options dynamically.
 */
const calculatePricing = async (productType, options = {}) => {
  const productBasePrices = await settingsService.getSetting('base_product_prices', {
    mini_figure: 250000,
    bag: 150000,
    hat: 120000,
  });

  const accessoriesConfig = await settingsService.getSetting('accessories_config', {
    pants: { labelKey: 'accessoryPants', label: 'Quần', price: 15000 },
    shirt: { labelKey: 'accessoryShirt', label: 'Áo', price: 20000 },
    hat: { labelKey: 'accessoryHat', label: 'Mũ phụ kiện', price: 25000 },
    hair: { labelKey: 'accessoryHair', label: 'Tóc', price: 20000 },
    bag: { labelKey: 'accessoryBag', label: 'Túi phụ kiện', price: 15000 },
    scarf: { labelKey: 'accessoryScarf', label: 'Khăn', price: 10000 },
    handAccessory: { labelKey: 'accessoryHandAccessory', label: 'Phụ kiện cầm tay', price: 30000 },
  });

  const illustrationPrice = await settingsService.getSetting('illustration_price', 40000);

  const basePrice = productBasePrices[productType] || 120000;
  let customizationFee = 0;
  const breakdown = [];

  if (productType === 'mini_figure') {
    Object.entries(options).forEach(([optKey, isSelected]) => {
      if (isSelected && accessoriesConfig[optKey]) {
        const item = accessoriesConfig[optKey];
        customizationFee += item.price;
        breakdown.push({ option: optKey, label: item.label, price: item.price });
      }
    });
  } else {
    if (options.illustration) {
      customizationFee += illustrationPrice;
      breakdown.push({
        option: 'illustration',
        label: 'Hình vẽ minh họa đơn giản',
        price: illustrationPrice,
      });
    }
    if (options.color) {
      breakdown.push({ option: 'color', label: `Màu sắc: ${options.color}`, price: 0 });
    }
  }

  return {
    basePrice,
    customizationFee,
    totalPrice: basePrice + customizationFee,
    breakdown,
  };
};

/**
 * Queries the database for a pre-seeded active product of type 'ai_base' matching the category slug
 */
const getBaseProduct = async (productType) => {
  // 1. Try to find the exact pre-seeded base product
  let searchSlug = productType;
  if (productType === 'bag') searchSlug = 'plush';
  else if (productType === 'hat') searchSlug = 'sweater';
  else if (productType === 'mini_figure') searchSlug = 'keychain';

  const { data: matched } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('product_type', 'ai_base')
    .is('created_by', null)
    .ilike('slug', `%${searchSlug}%`)
    .limit(1)
    .maybeSingle();

  if (matched) return matched;

  // 2. Try the general seed slugs
  const { data: seeded } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('product_type', 'ai_base')
    .is('created_by', null)
    .in('slug', ['keychain-crochet', 'mini-plush', 'mini-sweater'])
    .limit(1)
    .maybeSingle();

  if (seeded) return seeded;

  // 3. Last fallback to ANY product of type 'ai_base'
  const { data: fallback } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('product_type', 'ai_base')
    .is('created_by', null)
    .limit(1)
    .maybeSingle();

  if (fallback) return fallback;

  // Graceful fallback to null instead of throwing (as requested: no need for base products)
  return null;
};

/**
 * List all saved draft designs for a user.
 */
const listDesigns = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('designs')
    .select(
      `
      *,
      products (*)
    `
    )
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Retrieve a specific design details by ID.
 */
const getDesignById = async (designId, userId) => {
  const { data, error } = await supabaseAdmin
    .from('designs')
    .select(
      `
      *,
      products (*)
    `
    )
    .eq('id', designId)
    .eq('user_id', userId)
    .neq('status', 'deleted')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
};

/**
 * Perform purely EPHEMERAL AI Mockup generation without writing to database.
 */
const generateMockupOnly = async (userId, { productType, options = {}, customPrompt = '' }) => {
  if (userId) {
    await checkDailyLimit(userId);
  }
  const pricing = calculatePricing(productType, options);

  // Create a unique temporary timestamp for file key
  const tempId = `temp_${Date.now()}`;

  // Call AI Service content parser & image generator
  const parsed = await aiService.parsePrompt(productType, options, customPrompt);
  const mockupUrl = await aiService.generateMockup(parsed.optimizedPrompt, productType, tempId);

  return {
    mockup_image_url: mockupUrl,
    ai_prompt_used: parsed.optimizedPrompt,
    color_palette: parsed.colorReferences,
    material_suggestions: parsed.styleKeywords,
    customization_fee: pricing.customizationFee,
    prompt_text: customPrompt,
  };
};

/**
 * Option 1: Saves design state as a persistent active DRAFT.
 */
const saveDesignDraft = async (userId, designData) => {
  const {
    productType,
    options = {},
    customPrompt = '',
    mockupImageUrl,
    aiPromptUsed,
    colorPalette = [],
    materialSuggestions = [],
    customizationFee,
    attempts = 1,
  } = designData;

  // 1. Verify daily limit
  await checkDailyLimit(userId);

  // 2. Fetch appropriate pre-seeded base product
  const baseProduct = await getBaseProduct(productType);
  const productId = baseProduct ? baseProduct.id : null;

  // 3. Insert design row
  const { data: saved, error: insertError } = await supabaseAdmin
    .from('designs')
    .insert({
      user_id: userId,
      product_id: productId,
      prompt_text: customPrompt.substring(0, 500),
      selected_colors: options,
      complexity_score: Object.values(options).filter(Boolean).length,
      mockup_image_url: mockupImageUrl,
      mockup_storage_path: mockupImageUrl ? `mockups/${mockupImageUrl.split('/').pop()}` : null,
      ai_prompt_used: aiPromptUsed,
      color_palette: colorPalette,
      material_suggestions: materialSuggestions,
      customization_fee: customizationFee,
      generation_attempts: attempts,
      status: 'draft',
      saved_at: new Date().toISOString(),
    })
    .select(
      `
      *,
      products (*)
    `
    )
    .single();

  if (insertError) throw new Error(`Lưu bản vẽ thất bại: ${insertError.message}`);

  // 4. Save mockup to design_reference_images
  if (mockupImageUrl) {
    const { error: refError } = await supabaseAdmin.from('design_reference_images').insert({
      design_id: saved.id,
      url: mockupImageUrl,
      storage_path: mockupImageUrl
        ? `mockups/${mockupImageUrl.split('/').pop()}`
        : 'mockups/default.jpg',
    });
    if (refError) console.error('Lỗi khi lưu ảnh vào design_reference_images:', refError.message);
  }

  return saved;
};

/**
 * Helper to dynamically create a customized product in the database for a finalized design
 */
const createCustomizedProduct = async (
  userId,
  { productType, customizationFee, mockupImageUrl, customPrompt, designId, options }
) => {
  const productBasePrices = await settingsService.getSetting('base_product_prices', {
    mini_figure: 250000,
    bag: 150000,
    hat: 120000,
  });
  const basePrice = productBasePrices[productType] || 120000;

  // Robust check to identify category
  const hasAccessories =
    options &&
    Object.keys(options).some((k) =>
      ['pants', 'shirt', 'hat', 'hair', 'bag', 'scarf', 'handAccessory'].includes(k)
    );
  const isTui = options && ('illustration' in options || 'color' in options) && !hasAccessories;

  let name = 'Mũ len AI Custom';
  let categorySuffix = 'HAT';
  if (productType === 'mini_figure' || hasAccessories) {
    name = 'Móc khóa AI Custom';
    categorySuffix = 'KEYCHAIN';
  } else if (productType === 'bag' || isTui) {
    name = 'Túi len AI Custom';
    categorySuffix = 'BAG';
  }

  // Create unique SKU & Slug
  const uniqueId = designId.split('-')[0].toUpperCase();
  const sku = `AI-${categorySuffix}-${uniqueId}`;
  const slug = `ai-${categorySuffix.toLowerCase()}-${designId}`;

  // Insert product record
  const { data: newProduct, error: prodError } = await supabaseAdmin
    .from('products')
    .insert({
      sku,
      name,
      slug,
      description: customPrompt || 'Thiết kế AI độc bản từ khách hàng Florlen',
      short_description: 'Thiết kế custom bằng công nghệ AI',
      product_type: 'ai_base',
      base_price: basePrice,
      customization_fee: customizationFee || 0,
      production_days_min: 5,
      production_days_max: 10,
      is_active: true,
      created_by: userId,
      deposit_rate: 0.3,
    })
    .select()
    .single();

  if (prodError) throw new Error(`Tạo sản phẩm custom thất bại: ${prodError.message}`);

  // Insert primary product image
  if (mockupImageUrl) {
    const { error: imgError } = await supabaseAdmin.from('product_images').insert({
      product_id: newProduct.id,
      url: mockupImageUrl,
      storage_path: mockupImageUrl ? `mockups/${mockupImageUrl.split('/').pop()}` : null,
      is_primary: true,
      sort_order: 0,
    });
    if (imgError) console.error('Lỗi khi lưu ảnh sản phẩm custom:', imgError.message);
  }

  return newProduct;
};

/**
 * Option 2: Finalizes design and adds it to the user's cart.
 */
const finalizeDesign = async (userId, designData) => {
  const {
    productType,
    options = {},
    customPrompt = '',
    mockupImageUrl,
    aiPromptUsed,
    colorPalette = [],
    materialSuggestions = [],
    customizationFee,
    attempts = 1,
  } = designData;

  // 1. Verify daily limit
  await checkDailyLimit(userId);

  // 1. Insert design with status finalized and product_id initially null
  const { data: design, error: insertError } = await supabaseAdmin
    .from('designs')
    .insert({
      user_id: userId,
      product_id: null,
      prompt_text: customPrompt.substring(0, 500),
      selected_colors: options,
      complexity_score: Object.values(options).filter(Boolean).length,
      mockup_image_url: mockupImageUrl,
      mockup_storage_path: mockupImageUrl ? `mockups/${mockupImageUrl.split('/').pop()}` : null,
      ai_prompt_used: aiPromptUsed,
      color_palette: colorPalette,
      material_suggestions: materialSuggestions,
      customization_fee: customizationFee,
      generation_attempts: attempts,
      status: 'finalized',
      saved_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError || !design) throw new Error(`Lưu bản vẽ thất bại: ${insertError?.message}`);

  // 2. Save mockup to design_reference_images
  if (mockupImageUrl) {
    const { error: refError } = await supabaseAdmin.from('design_reference_images').insert({
      design_id: design.id,
      url: mockupImageUrl,
      storage_path: mockupImageUrl
        ? `mockups/${mockupImageUrl.split('/').pop()}`
        : 'mockups/default.jpg',
    });
    if (refError) console.error('Lỗi khi lưu ảnh vào design_reference_images:', refError.message);
  }

  // 3. Create a customized product record in the database for this finalized design
  const newProduct = await createCustomizedProduct(userId, {
    productType,
    customizationFee,
    mockupImageUrl,
    customPrompt,
    designId: design.id,
    options,
  });

  // 4. Update the design with the created product reference id
  await supabaseAdmin.from('designs').update({ product_id: newProduct.id }).eq('id', design.id);

  // 5. Add to shopping cart via cart service
  const cartItem = await cartService.addItem(
    { userId },
    {
      item_type: 'ai_personalization',
      product_id: newProduct.id,
      quantity: 1,
      design_id: design.id,
    }
  );

  return {
    design: { ...design, product_id: newProduct.id },
    cartItem,
  };
};

/**
 * Finalizes an existing draft design in the saved library and adds it to the cart.
 */
const finalizeExistingDesign = async (designId, userId) => {
  // 1. Fetch current design to get prompt_text, productType, customization_fee, options
  const { data: currentDesign, error: fetchError } = await supabaseAdmin
    .from('designs')
    .select('*')
    .eq('id', designId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !currentDesign) throw new Error('Không tìm thấy bản vẽ');

  let productId = currentDesign.product_id;

  // 2. If it doesn't have a product yet, create it!
  if (!productId) {
    const hasAccessories =
      currentDesign.selected_colors &&
      Object.keys(currentDesign.selected_colors).some((k) =>
        ['pants', 'shirt', 'hat', 'hair', 'bag', 'scarf', 'handAccessory'].includes(k)
      );
    const isTui =
      currentDesign.selected_colors &&
      ('illustration' in currentDesign.selected_colors ||
        'color' in currentDesign.selected_colors) &&
      !hasAccessories;
    const productType = hasAccessories ? 'mini_figure' : isTui ? 'bag' : 'hat';

    const newProduct = await createCustomizedProduct(userId, {
      productType,
      customizationFee: currentDesign.customization_fee,
      mockupImageUrl: currentDesign.mockup_image_url,
      customPrompt: currentDesign.prompt_text,
      designId: currentDesign.id,
      options: currentDesign.selected_colors,
    });
    productId = newProduct.id;
  }

  // 3. Lock design and update its product_id
  const { data: design, error: lockError } = await supabaseAdmin
    .from('designs')
    .update({
      status: 'finalized',
      product_id: productId,
    })
    .eq('id', designId)
    .eq('user_id', userId)
    .select()
    .single();

  if (lockError || !design)
    throw new Error(`Khóa bản vẽ thất bại: ${lockError?.message || 'Không tìm thấy bản vẽ'}`);

  // 4. Add to cart
  const cartItem = await cartService.addItem(
    { userId },
    {
      item_type: 'ai_personalization',
      product_id: productId,
      quantity: 1,
      design_id: design.id,
    }
  );

  return {
    design,
    cartItem,
  };
};

/**
 * Deletes a design from the DB (updates status to 'deleted', removes images from storage & design_reference_images).
 */
const deleteDesign = async (designId, userId) => {
  // 1. Fetch design details to retrieve mockup image information (even if it was soft deleted, allow cleanup if retry)
  const { data: design, error: fetchError } = await supabaseAdmin
    .from('designs')
    .select('mockup_storage_path')
    .eq('id', designId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !design) {
    throw new Error('Không tìm thấy bản vẽ cần xóa');
  }

  // 2. Fetch all reference images linked to this design
  const { data: refImages, error: refError } = await supabaseAdmin
    .from('design_reference_images')
    .select('storage_path')
    .eq('design_id', designId);

  if (refError) {
    console.error('Lỗi khi lấy ảnh liên kết thiết kế:', refError.message);
  }

  // 3. Compile file paths to remove from the Storage bucket
  const filesToDelete = [];
  
  if (design.mockup_storage_path) {
    const pathParts = design.mockup_storage_path.split('/');
    const pathInsideBucket = pathParts[0] === 'mockups' ? pathParts.slice(1).join('/') : design.mockup_storage_path;
    if (pathInsideBucket && pathInsideBucket !== 'default.jpg') {
      filesToDelete.push(pathInsideBucket);
    }
  }

  if (refImages && refImages.length > 0) {
    refImages.forEach((img) => {
      if (img.storage_path) {
        const pathParts = img.storage_path.split('/');
        const pathInsideBucket = pathParts[0] === 'mockups' ? pathParts.slice(1).join('/') : img.storage_path;
        if (pathInsideBucket && pathInsideBucket !== 'default.jpg' && !filesToDelete.includes(pathInsideBucket)) {
          filesToDelete.push(pathInsideBucket);
        }
      }
    });
  }

  // 4. Perform Supabase Storage cleanup
  if (filesToDelete.length > 0) {
    const { error: storageError } = await supabaseAdmin.storage.from('mockups').remove(filesToDelete);
    if (storageError) {
      console.error('Lỗi khi xóa ảnh khỏi Storage Bucket:', storageError.message);
    }
  }

  // 5. Delete records from the design_reference_images table
  const { error: deleteRefError } = await supabaseAdmin
    .from('design_reference_images')
    .delete()
    .eq('design_id', designId);

  if (deleteRefError) {
    console.error('Lỗi khi xóa bản ghi khỏi design_reference_images:', deleteRefError.message);
  }

  // 6. Update design status to 'deleted' and nullify image columns
  const { error: updateError } = await supabaseAdmin
    .from('designs')
    .update({
      status: 'deleted',
      mockup_image_url: null,
      mockup_storage_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', designId)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(`Xóa bản vẽ thất bại: ${updateError.message}`);
  }

  return true;
};

/**
 * Gets daily count of saved/finalized designs created today and the max limit.
 */
const getDailyLimitData = async (userId) => {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from('designs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString());

  if (error) {
    console.error('Error fetching daily design count:', error.message);
    throw new Error(`Lỗi khi đếm số lượng thiết kế trong ngày: ${error.message}`);
  }

  return {
    count: count || 0,
    limit: MAX_DESIGNS_PER_DAY,
  };
};

module.exports = {
  listDesigns,
  getDesignById,
  generateMockupOnly,
  saveDesignDraft,
  finalizeDesign,
  finalizeExistingDesign,
  deleteDesign,
  getDailyLimitData,
};
