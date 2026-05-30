const { supabaseAdmin } = require('../config/supabase');

let cache = null;
let cacheExpiry = null;
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Loads all system settings from database with caching mechanism
 */
async function loadSettings() {
  const now = Date.now();
  if (cache && cacheExpiry && now < cacheExpiry) {
    return cache;
  }

  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('*');

  if (error) {
    console.error('[Settings Service] Error loading settings:', error.message);
    if (cache) return cache; // Return stale cache if error occurs
    throw error;
  }

  const settings = {};
  data.forEach((row) => {
    settings[row.key] = row.value;
  });

  cache = settings;
  cacheExpiry = now + CACHE_TTL;
  return settings;
}

/**
 * Clear cached settings
 */
function clearCache() {
  cache = null;
  cacheExpiry = null;
}

/**
 * Get dynamic configuration for a specific key
 */
async function getSetting(key, defaultValue) {
  try {
    const settings = await loadSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  } catch (err) {
    console.error(`[Settings Service] Error getting setting "${key}":`, err.message);
    return defaultValue;
  }
}

/**
 * Upsert configuration key and value, clearing the cache
 */
async function setSetting(key, value) {
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
    .select();

  if (error) {
    console.error(`[Settings Service] Error setting "${key}":`, error.message);
    throw error;
  }

  clearCache();
  return data[0];
}

/**
 * Fetches dynamic public pricing configs (strictly omitting sensitive API keys)
 */
async function getPublicAIConfig() {
  const productBasePrices = await getSetting('base_product_prices', {
    mini_figure: 250000,
    bag: 150000,
    hat: 120000,
  });

  const accessoriesConfig = await getSetting('accessories_config', {
    pants: { labelKey: 'accessoryPants', label: 'Quần', price: 15000 },
    shirt: { labelKey: 'accessoryShirt', label: 'Áo', price: 20000 },
    hat: { labelKey: 'accessoryHat', label: 'Mũ phụ kiện', price: 25000 },
    hair: { labelKey: 'accessoryHair', label: 'Tóc', price: 20000 },
    bag: { labelKey: 'accessoryBag', label: 'Túi phụ kiện', price: 15000 },
    scarf: { labelKey: 'accessoryScarf', label: 'Khăn', price: 10000 },
    handAccessory: { labelKey: 'accessoryHandAccessory', label: 'Phụ kiện cầm tay', price: 30000 },
  });

  const illustrationPrice = await getSetting('illustration_price', 40000);

  return {
    productBasePrices,
    accessoriesConfig,
    illustrationPrice,
  };
}

module.exports = {
  getSetting,
  setSetting,
  clearCache,
  getPublicAIConfig,
};
