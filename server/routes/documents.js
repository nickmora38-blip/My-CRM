'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Store uploaded files temporarily, then rename to final destination
const upload = multer({ dest: config.documentsDir });

// All document routes require authentication
router.use(verifyToken);

/**
 * POST /api/documents/upload
 * Upload a file for a customer. Expects multipart/form-data with:
 *   - file: the file to upload
 *   - customerId: ID of the customer this document belongs to
 *   - documentType: type label (e.g. 'id', 'income', 'application')
 */
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { customerId, documentType } = req.body;
  if (!customerId || !documentType) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'customerId and documentType are required' });
  }

  const ext = path.extname(req.file.originalname) || '';
  const fileName = `${customerId}_${documentType}_${Date.now()}${ext}`;
  const destPath = path.join(config.documentsDir, fileName);

  try {
    fs.renameSync(req.file.path, destPath);
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: 'Failed to save file' });
  }

  return res.json({
    success: true,
    file: fileName,
    url: `/api/documents/${encodeURIComponent(fileName)}`,
  });
});

/**
 * GET /api/documents/:fileName
 * Download a previously uploaded document.
 */
router.get('/:fileName', (req, res) => {
  const fileName = path.basename(req.params.fileName);
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
router.delete('/:fileName', (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const filePath = path.join(config.documentsDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Document not found' });
  }

  try {
    fs.unlinkSync(filePath);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
