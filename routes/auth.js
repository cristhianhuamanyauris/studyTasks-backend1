const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const uploadAvatar = require("../middleware/uploadAvatar");

// --------------------------------------
// HELPERS: GENERAR TOKENS
// --------------------------------------
function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
}

// --------------------------------------
// 📌 REGISTRO (con avatar y perfil completo)
// --------------------------------------
router.post("/register", async (req, res) => {
  try {
    console.log("BODY RECIBIDO:", req.body);
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      birthDate,
      bio,
      profession,
      country,
      city
    } = req.body;

    // Validación básica
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: "firstName, lastName, email y password son requeridos",
      });
    }

    // Evitar duplicados
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "El correo ya está registrado" });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // Avatar (si existe)
    const avatarPath = null;


    // Crear usuario
    await User.create({
      firstName,
      lastName,
      email,
      password: hashed,
      phone,
      birthDate,
      bio,
      profession,
      country,
      city,
      avatar: avatarPath,
    });

    res.status(201).json({ message: "Usuario registrado correctamente" });
  } catch (err) {
    console.error("Error en /register:", err);
    res.status(500).json({ message: "Error en el servidor" });
  }


});

// --------------------------------------
// 📌 LOGIN
// --------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Correo y contraseña requeridos" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Credenciales inválidas" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Credenciales inválidas" });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        token: accessToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          email: user.email,
        },
      });
  } catch (err) {
    console.error("Error en /login:", err);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

// --------------------------------------
// 📌 REFRESH TOKEN
// --------------------------------------
router.post("/refresh", (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "No hay refresh token" });
    }

    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, payload) => {
      if (err) {
        console.error("Error verificando refresh token:", err);
        return res.status(401).json({ message: "Refresh token inválido" });
      }

      const accessToken = generateAccessToken(payload.userId);
      return res.json({ token: accessToken });
    });
  } catch (err) {
    console.error("Error en /refresh:", err);
    res.status(500).json({ message: "Error en el servidor" });
  }
});

// --------------------------------------
// 📌 LOGOUT
// --------------------------------------
router.post("/logout", (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  });
  res.json({ message: "Sesión cerrada" });
});

module.exports = router;
