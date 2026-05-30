const designService = require('../services/design.service');

/**
 * GET /api/designs
 * List all saved/draft designs for the authenticated user.
 */
const listDesignsHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized - Vui lòng đăng nhập' });
    }

    const designs = await designService.listDesigns(userId);
    return res.status(200).json({
      message: 'Lấy danh sách bản vẽ thành công',
      resources: designs,
    });
  } catch (error) {
    console.error('List designs error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * GET /api/designs/:id
 * Retrieve details of a specific design by ID.
 */
const getDesignByIdHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    const designId = req.params.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized - Vui lòng đăng nhập' });
    }
    if (!designId) {
      return res.status(400).json({ message: 'Thiếu thông tin ID bản vẽ' });
    }

    const design = await designService.getDesignById(designId, userId);
    if (!design) {
      return res.status(404).json({ message: 'Không tìm thấy bản vẽ của bạn' });
    }

    return res.status(200).json({
      message: 'Lấy chi tiết bản vẽ thành công',
      resource: design,
    });
  } catch (error) {
    console.error('Get design error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/designs/generate
 * Performs purely EPHEMERAL mockup generation with AI, returning parsed results without DB writes.
 */
const generateDesignHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized - Vui lòng đăng nhập để sử dụng tính năng AI' });
    }

    const { productType, options, customPrompt } = req.body;

    if (!productType) {
      return res.status(400).json({ message: 'Vui lòng chọn loại sản phẩm (productType)' });
    }

    if (!['mini_figure', 'bag', 'hat'].includes(productType)) {
      return res.status(400).json({ message: 'Loại sản phẩm không hợp lệ. Chỉ hỗ trợ: mini_figure, bag, hat' });
    }

    const result = await designService.generateMockupOnly(userId, {
      productType,
      options: options || {},
      customPrompt: customPrompt || '',
    });

    return res.status(200).json({
      message: 'Thiết kế thử nghiệm mockup thành công',
      resource: result,
    });
  } catch (error) {
    console.error('Generate design mockup error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/designs/save
 * Option 1: Persist design with status DRAFT in the user's saved library.
 */
const saveDesignDraftHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized - Vui lòng đăng nhập' });
    }

    const design = await designService.saveDesignDraft(userId, req.body);
    return res.status(201).json({
      message: 'Bản vẽ đã được lưu thành công vào thư viện của bạn',
      resource: design,
    });
  } catch (error) {
    console.error('Save design draft error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/designs/finalize
 * Option 2: Lock design (status FINALIZED) and add it to the user's cart.
 */
const finalizeDesignHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized - Vui lòng đăng nhập' });
    }

    const { design, cartItem } = await designService.finalizeDesign(userId, req.body);
    return res.status(201).json({
      message: 'Đã hoàn thành thiết kế và thêm vào giỏ hàng thành công',
      resource: design,
      cartItem,
    });
  } catch (error) {
    console.error('Finalize design error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * POST /api/designs/:id/finalize
 * Lock and add an EXISTING draft design in the saved library to the cart.
 */
const finalizeExistingDesignHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    const designId = req.params.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized - Vui lòng đăng nhập' });
    }
    if (!designId) {
      return res.status(400).json({ message: 'Thiếu thông tin ID bản vẽ' });
    }

    const { design, cartItem } = await designService.finalizeExistingDesign(designId, userId);
    return res.status(200).json({
      message: 'Đã hoàn thành thiết kế lưu trữ và thêm vào giỏ hàng thành công',
      resource: design,
      cartItem,
    });
  } catch (error) {
    console.error('Finalize existing design error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * DELETE /api/designs/:id
 * Removes a design from the database.
 */
const deleteDesignHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    const designId = req.params.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized - Vui lòng đăng nhập' });
    }
    if (!designId) {
      return res.status(400).json({ message: 'Thiếu thông tin ID bản vẽ' });
    }

    await designService.deleteDesign(designId, userId);
    return res.status(200).json({
      message: 'Đã xóa bản vẽ thành công khỏi thư viện của bạn',
    });
  } catch (error) {
    console.error('Delete design error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * GET /api/designs/daily-limit
 * Retrieves the daily designs creation count and the maximum daily limit.
 */
const getDailyLimitHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized - Vui lòng đăng nhập' });
    }

    const data = await designService.getDailyLimitData(userId);
    return res.status(200).json({
      message: 'Lấy giới hạn tạo thiết kế hôm nay thành công',
      resource: data,
    });
  } catch (error) {
    console.error('Get daily limit error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * GET /api/designs/config
 * Retrieves dynamic public pricing settings.
 */
const getAIConfigHandler = async (req, res) => {
  try {
    const settingsService = require('../services/settings.service');
    const config = await settingsService.getPublicAIConfig();
    return res.status(200).json({
      message: 'Lấy cấu hình AI thành công',
      resource: config,
    });
  } catch (error) {
    console.error('Get AI config error:', error);
    return res.status(400).json({ message: error.message });
  }
};

module.exports = {
  listDesignsHandler,
  getDesignByIdHandler,
  generateDesignHandler,
  saveDesignDraftHandler,
  finalizeDesignHandler,
  finalizeExistingDesignHandler,
  deleteDesignHandler,
  getDailyLimitHandler,
  getAIConfigHandler,
};
