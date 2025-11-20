const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Datos básicos
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },

  // Login
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // Perfil extendido
  birthDate: { type: Date },
  phone: { type: String },
  bio: { type: String, default: "" },
  profession: { type: String },
  country: { type: String },
  city: { type: String },

  // Avatar (foto subida)
  avatar: { type: String, default: null } // ruta completa: /uploads/avatars/filename.jpg
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
