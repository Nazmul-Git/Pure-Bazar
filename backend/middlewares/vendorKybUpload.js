const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads', 'vendor-kyb');
const allowed = {
  'application/pdf': (buffer) => buffer.toString('ascii', 0, 4) === '%PDF',
  'image/png': (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255,
};
const extensions = { 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg' };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter(req, file, callback) {
    if (!allowed[file.mimetype]) return callback(new Error('Documents must be PDF, PNG, or JPEG files'));
    return callback(null, true);
  },
}).fields([{ name: 'tradeLicense', maxCount: 1 }, { name: 'ownerNid', maxCount: 1 }]);

// Parses the multipart form and exposes verified in-memory files as req.kybFiles; nothing is written until saveKybFiles.
function vendorKybUpload(req, res, next) {
  upload(req, res, (error) => {
    if (error) {
      error.status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return next(error);
    }
    req.kybFiles = {};
    for (const [name, [file]] of Object.entries(req.files || {})) {
      if (!allowed[file.mimetype](file.buffer)) {
        const invalid = new Error('Document content does not match its file type');
        invalid.status = 400;
        return next(invalid);
      }
      req.kybFiles[name] = file;
    }
    return next();
  });
}

async function saveKybFiles(files) {
  await fs.promises.mkdir(uploadDir, { recursive: true });
  const saved = {};
  for (const [name, file] of Object.entries(files)) {
    const fileName = `${crypto.randomUUID()}${extensions[file.mimetype]}`;
    await fs.promises.writeFile(path.join(uploadDir, fileName), file.buffer);
    saved[name] = {
      fileName,
      originalName: path.basename(file.originalname).slice(0, 150),
      mimeType: file.mimetype,
      size: file.size,
    };
  }
  return saved;
}

module.exports = { vendorKybUpload, saveKybFiles };
