const crypto = require('crypto');
const { ADMIN_ROLES } = require('../config/constants');
const { uploadFile, deleteFile } = require('../services/storage.service');

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

const TYPE_CONFIG = {
  product: {
    bucket: process.env.SUPABASE_PRODUCT_IMAGE_BUCKET || 'product-images',
    folder: 'products',
    adminOnly: true,
  },
  collection: {
    bucket: process.env.SUPABASE_COLLECTION_IMAGE_BUCKET || 'collection-images',
    folder: 'collections',
    adminOnly: true,
  },
  blog: {
    bucket: process.env.SUPABASE_BLOG_ASSET_BUCKET || 'blog-assets',
    folder: 'blog',
    adminOnly: true,
  },
  mockup: {
    bucket: process.env.SUPABASE_MOCKUP_BUCKET || 'mockups',
    folder: 'mockups',
    adminOnly: true,
  },
  reference: {
    bucket: process.env.SUPABASE_REFERENCE_UPLOAD_BUCKET || 'reference-uploads',
    folder: 'references',
    adminOnly: false,
    userScoped: true,
  },
};

const cleanupUploadedImages = async (images) => {
  await Promise.all(
    images.map(async (image) => {
      try {
        await deleteFile(image.bucket, image.storage_path);
      } catch (error) {
        console.error('Failed to cleanup uploaded image:', error);
      }
    })
  );
};

const buildImagePath = (config, file, index, userId) => {
  const extension = file.mimetype === 'image/png' ? '.png' : '.jpg';
  const filename = `${Date.now()}-${index}-${crypto.randomUUID()}${extension}`;

  if (config.userScoped) {
    return `${userId}/${config.folder}/${filename}`;
  }

  return `${config.folder}/${filename}`;
};

/**
 * POST /api/uploads
 */
const uploadImages = async (req, res) => {
  try {
    const type = String(req.query.type || '').trim();
    if (!type) {
      return res.status(400).json({ message: 'Missing required query param: type' });
    }

    const config = TYPE_CONFIG[type];
    if (!config) {
      return res.status(400).json({ message: `Invalid upload type: ${type}` });
    }

    if (config.adminOnly && !ADMIN_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({ message: 'At least one image file is required' });
    }

    const uploadedImages = [];

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];

        if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
          throw new Error(`Unsupported image type: ${file.mimetype}`);
        }

        const storagePath = buildImagePath(config, file, index, req.user.id);
        const uploaded = await uploadFile(config.bucket, storagePath, file.buffer, file.mimetype);

        uploadedImages.push({
          type,
          bucket: config.bucket,
          url: uploaded.publicUrl,
          storage_path: uploaded.path,
          original_name: file.originalname,
          mime_type: file.mimetype,
          size: file.size,
        });
      }

      return res.status(201).json({ images: uploadedImages });
    } catch (error) {
      await cleanupUploadedImages(uploadedImages);
      throw error;
    }
  } catch (error) {
    console.error('Upload images error:', error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * DELETE /api/uploads
 */
const deleteUploadedImage = async (req, res) => {
  try {
    const { bucket, path } = req.body;
    if (!bucket || !path) {
      return res.status(400).json({ message: 'Missing bucket or path in request body' });
    }

    const referenceBucket = process.env.SUPABASE_REFERENCE_UPLOAD_BUCKET || 'reference-uploads';
    const isReference = bucket === referenceBucket;

    if (isReference) {
      // Security check: User can only delete files in their own user-scoped directory
      const prefix = `${req.user.id}/`;
      if (!path.startsWith(prefix)) {
        return res.status(403).json({ message: 'You are not authorized to delete this file' });
      }
    } else {
      // Non-reference files require admin role
      if (!ADMIN_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Only admins can delete non-reference assets' });
      }
    }

    await deleteFile(bucket, path);
    return res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete uploaded image error:', error);
    return res.status(400).json({ message: error.message });
  }
};

module.exports = {
  uploadImages,
  deleteUploadedImage,
};
