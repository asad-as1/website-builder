const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../shared/cloudinary/cloudinary.client');
const { authenticate } = require('../modules/auth/auth.middleware');


const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // ✅ 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  },
});

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const isImage = req.file.mimetype.startsWith('image/');
    const isPdf = req.file.mimetype === 'application/pdf';
    
    // ✅ PDF ke liye 'image' resource type use karo — direct view hoga
    // Baaki documents ke liye 'raw'
    let resourceType = 'raw';
    if (isImage || isPdf) {
      resourceType = 'image';
    }

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'genetix/chat',
          resource_type: resourceType,
          // ✅ PDF ke liye format preserve karo
          format: isPdf ? 'pdf' : undefined,
          public_id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    res.json({
      success: true,
      fileUrl: result.secure_url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      type: isImage || isPdf ? 'image' : 'document', // ✅ PDF ko image type do
    });
  } catch (error) {
    console.error('[Upload] Error:', error.message);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

module.exports = router;