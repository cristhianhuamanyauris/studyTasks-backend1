// routes/profile.js
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const authMiddleware = require("../middleware/authMiddleware");
const uploadAvatar = require("../middleware/uploadAvatar");

// ---------------------------------------------------------
// 📌 Obtener el perfil del usuario autenticado
// ---------------------------------------------------------
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

    res.json(user);
  } catch (err) {
    console.error("Error obteniendo perfil:", err);
    res.status(500).json({ message: "Error del servidor" });
  }
});

// ---------------------------------------------------------
// 📌 Actualizar perfil (sin avatar)
// ---------------------------------------------------------
router.put("/update", authMiddleware, async (req, res) => {
  try {
    const allowedFields = [
      "firstName",
      "lastName",
      "birthDate",
      "phone",
      "bio",
      "profession",
      "country",
      "city",
    ];

    const updateData = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    ).select("-password");

    res.json(updatedUser);
  } catch (err) {
    console.error("Error actualizando perfil:", err);
    res.status(500).json({ message: "Error del servidor" });
  }
});

// ---------------------------------------------------------
// 📌 Subir avatar
// ---------------------------------------------------------
router.put(
  "/avatar",
  authMiddleware,
  uploadAvatar.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se subió ninguna imagen" });
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { avatar: avatarUrl },
        { new: true }
      ).select("-password");

      res.json(updatedUser);
    } catch (err) {
      console.error("Error subiendo avatar:", err);
      res.status(500).json({ message: "Error del servidor" });
    }
  }
);

module.exports = router;
