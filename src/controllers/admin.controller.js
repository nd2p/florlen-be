const settingsService = require('../services/settings.service');

/**
 * GET /api/admin/ai/config
 * Retrieves all dynamic AI configurations including the raw GEMINI_API_KEY (Admin Only)
 */
const getAdminAIConfig = async (req, res) => {
  try {
    const geminiApiKey = await settingsService.getSetting('gemini_api_key', '');
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

    return res.status(200).json({
      message: 'Lấy cấu hình quản lý AI thành công',
      resource: {
        geminiApiKey,
        productBasePrices,
        accessoriesConfig,
        illustrationPrice,
      },
    });
  } catch (error) {
    console.error('Get admin AI config error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * PUT /api/admin/ai/config
 * Bulk updates the AI system configurations (Admin Only)
 */
const updateAdminAIConfig = async (req, res) => {
  try {
    const { geminiApiKey, productBasePrices, accessoriesConfig, illustrationPrice } = req.body;

    if (geminiApiKey !== undefined) {
      await settingsService.setSetting('gemini_api_key', geminiApiKey);
    }
    if (productBasePrices !== undefined) {
      await settingsService.setSetting('base_product_prices', productBasePrices);
    }
    if (accessoriesConfig !== undefined) {
      await settingsService.setSetting('accessories_config', accessoriesConfig);
    }
    if (illustrationPrice !== undefined) {
      await settingsService.setSetting('illustration_price', Number(illustrationPrice));
    }

    return res.status(200).json({
      message: 'Cập nhật cấu hình AI thành công',
    });
  } catch (error) {
    console.error('Update admin AI config error:', error);
    return res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAdminAIConfig,
  updateAdminAIConfig,
};
