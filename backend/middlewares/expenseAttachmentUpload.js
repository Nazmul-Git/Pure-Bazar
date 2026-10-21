const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads', 'expenses');
const allowed = {
  'application/pdf': (buffer) => buffer.toString('ascii', 0, 4) === '%PDF',
  'image/png': (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255,
};
const extensions = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!allowed[file.mimetype]) return callback(new Error('Attachment must be a PDF, PNG, or JPEG file'));
    return callback(null, true);
  },
}).single('attachment');

function expenseAttachmentUpload(req, res, next) {
  upload(req, res, (error) => {
    if (error) {
      error.status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return next(error);
    }
    if (!req.file) return next();
    if (!allowed[req.file.mimetype](req.file.buffer)) {
      const invalid = new Error('Attachment content does not match its file type');
      invalid.status = 400;
      return next(invalid);
    }
    const fileName = `${crypto.randomUUID()}${extensions[req.file.mimetype]}`;
    return fs.promises.mkdir(uploadDir, { recursive: true })
      .then(() => fs.promises.writeFile(path.join(uploadDir, fileName), req.file.buffer))
      .then(() => {
        req.expenseAttachment = {
          fileName,
          originalName: path.basename(req.file.originalname).slice(0, 150),
          mimeType: req.file.mimetype,
          size: req.file.size,
        };
        next();
      })
      .catch(next);
  });
}

module.exports = expenseAttachmentUpload;
