const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directory if it doesn't exist
const createUploadDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// File filter function
const fileFilter = (req, file, cb) => {
    // Allowed file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp','image/avif'];
    
    if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error('Only .jpg, .jpeg, .png,.avif and .webp formats are allowed'), false);
    }

    cb(null, true);
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Store files directly in uploads/products directory for simpler path handling
        const uploadDir = path.join(__dirname, '../uploads/products');
        createUploadDir(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'product-' + uniqueSuffix + ext);
    }
});

// Create multer instance with configuration
const uploadConfig = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 5 // Maximum 5 files
    }
});

// Error handler middleware
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files. Maximum is 5 files'
            });
        }
    }
    
    if (err.message.includes('Only')) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    next(err);
};

module.exports = {
    upload: uploadConfig,
    handleMulterError
};
