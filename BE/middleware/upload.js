const multer = require("multer");
const path = require("path");
const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.has(ext))
      return cb(new Error("Chỉ chấp nhận JPG, PNG, WEBP hoặc PDF."));
    cb(null, true);
  },
});
