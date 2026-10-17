const multer = require('multer');

const imageTypes = {
  'image/png': (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255,
  'image/webp': (buffer) => buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!imageTypes[file.mimetype]) return callback(new Error('Logo must be a PNG, JPEG, or WebP image'));
    return callback(null, true);
  },
}).single('logo');

function brandLogoUpload(req, res, next) {
  upload(req, res, (error) => {
    if (error) {
      error.status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return next(error);
    }
    if (req.file && !imageTypes[req.file.mimetype](req.file.buffer)) {
      const invalidImage = new Error('Uploaded logo content does not match its image type');
      invalidImage.status = 400;
      return next(invalidImage);
    }
    return next();
  });
}

module.exports = brandLogoUpload;
