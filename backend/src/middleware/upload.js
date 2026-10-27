// Upload rule (D13): the route layer holds the file, the service rule names the stored path.
// Multipart needs a parser here, so multer keeps the file on disk and reads the size cap, and the
// code for an oversize file is answered here rather than in the service. The folder is a disk
// folder, local only, so nothing is lost on redeploy.
const multer = require('multer');
const { envelope } = require('../envelope');
const { MAX_FILE_BYTES, storedName } = require('../services/images');

const upload = multer({
  // multer 2 gives the storage callbacks (req, file, cb). The old shape carried res, which is
  // why the first version threw "cb is not a function".
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || 'uploads'),
    filename: (req, file, cb) => cb(null, storedName(file.originalname)),
  }),
  limits: { fileSize: MAX_FILE_BYTES },
});

function uploadImage(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json(envelope('00158'));
      return next(error);
    }
    if (!req.file) return res.json(envelope('00025'));
    // The handle function builds the service input from body, query and params, so the file
    // details ride on req.fileMeta and are merged there. Setting input here would be overwritten.
    req.fileMeta = { image: req.file.originalname, size: req.file.size };
    return next();
  });
}

module.exports = { uploadImage, upload };
