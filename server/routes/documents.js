'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Allowed file extensions (whitelist)
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.txt', '.csv',
]);

// Max upload size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Sanitize a string to only alphanumeric, hyphens, and underscores
function sanitizeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

const upload = multer({
  dest: config.documentsDir,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${ext}' is not allowed`));
    }
  },
});

// All document routes require authentication
router.use(verifyToken);

/**
 * POST /api/documents/upload
 * Upload a file for a customer. Expects multipart/form-data with:
 *   - file: the file to upload
 *   - customerId: ID of the customer this document belongs to
 *   - documentType: type label (e.g. 'id', 'income', 'application')
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { customerId, documentType } = req.body;
  if (!customerId || !documentType) {
    await fs.promises.unlink(req.file.path).catch((err) => {
      console.error('Failed to cleanup temp file:', err);
    });
    return res.status(400).json({ error: 'customerId and documentType are required' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const safeCustomerId = sanitizeSegment(customerId);
  const safeDocType = sanitizeSegment(documentType);
  const fileName = `${safeCustomerId}_${safeDocType}_${Date.now()}${ext}`;
  const destPath = path.join(config.documentsDir, fileName);

  try {
    await fs.promises.rename(req.file.path, destPath);
  } catch (err) {
    await fs.promises.unlink(req.file.path).catch((e) => {
      console.error('Failed to cleanup temp file:', e);
    });
    return res.status(500).json({ error: 'Failed to save file' });
  }

  return res.json({
    success: true,
    file: fileName,
    url: `/api/documents/${encodeURIComponent(fileName)}`,
  });
});

// Multer error handler (e.g. file type or size rejection)
router.use((err, req, res, next) => {
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

/**
 * GET /api/documents/:fileName
 * Download a previously uploaded document.
 */
router.get('/:fileName', (req, res) => {
  // path.basename strips any directory components from the user-supplied name
  const fileName = path.basename(req.params.fileName);

  // Enforce whitelist: only serve filenames matching our safe pattern
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(fileName)) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  const filePath = path.join(config.documentsDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document not found' });
  }

  return res.download(filePath, fileName);
});

/**
 * DELETE /api/documents/:fileName
 * Remove an uploaded document.
 */
router.delete('/:fileName', async (req, res) => {
  const fileName = path.basename(req.params.fileName);

  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(fileName)) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  const filePath = path.join(config.documentsDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document not found' });
  }

  try {
    await fs.promises.unlink(filePath);
    return res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete document:', err);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
