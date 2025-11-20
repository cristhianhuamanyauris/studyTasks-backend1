const multer = require("multer");
const path = require("path");
const fs = require("fs");

// -------------------------------------------
// 📁 Crear carpeta si no existe
// -------------------------------------------
const uploadDir = path.join(__dirname, "..", "uploads", "avatars");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 Carpeta /uploads/avatars creada automáticamente");
}

// -------------------------------------------
// 🎯 FILTRO: Solo imágenes permitidas
// -------------------------------------------
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes (jpeg, png, webp)"), false);
  }
};

// -------------------------------------------
// ⚙️ Configuración del almacenamiento
// -------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + ext);
  },
});

// -------------------------------------------
// 📦 MIDDLEWARE configurado
// -------------------------------------------
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // ⛔ 3 MB max
  },
});

module.exports = upload;
