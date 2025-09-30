const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const sharp = require('sharp');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../uploads');
const productImagesDir = path.join(uploadDir, 'products');

fs.ensureDirSync(uploadDir);
fs.ensureDirSync(productImagesDir);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, productImagesDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${extension}`);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 4 // Maximum 4 files per product
  },
  fileFilter: fileFilter
});

// Middleware to process and optimize uploaded images
const processImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  try {
    const processedImages = [];

    for (const file of req.files) {
      const originalPath = file.path;
      const optimizedPath = path.join(
        productImagesDir,
        `optimized-${file.filename}`
      );

      // Optimize image using Sharp
      await sharp(originalPath)
        .resize(800, 600, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toFile(optimizedPath);

      // Create thumbnail
      const thumbnailPath = path.join(
        productImagesDir,
        `thumb-${file.filename}`
      );

      await sharp(originalPath)
        .resize(200, 150, {
          fit: 'cover'
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      // Remove original file
      await fs.remove(originalPath);

      processedImages.push({
        filename: `optimized-${file.filename}`,
        thumbnail: `thumb-${file.filename}`,
        originalName: file.originalname,
        size: file.size
      });
    }

    req.processedImages = processedImages;
    next();
  } catch (error) {
    console.error('Image processing error:', error);
    next(error);
  }
};

// Middleware to clean up old images when updating product
const cleanupOldImages = async (productImages) => {
  if (!productImages || productImages.length === 0) {
    return;
  }

  try {
    for (const imagePath of productImages) {
      const fullPath = path.join(productImagesDir, imagePath);
      const thumbnailPath = path.join(productImagesDir, imagePath.replace('optimized-', 'thumb-'));
      
      await fs.remove(fullPath);
      await fs.remove(thumbnailPath);
    }
  } catch (error) {
    console.error('Error cleaning up old images:', error);
  }
};

module.exports = {
  upload: upload.array('images', 4), // Accept up to 4 images
  processImages,
  cleanupOldImages,
  uploadDir,
  productImagesDir
};