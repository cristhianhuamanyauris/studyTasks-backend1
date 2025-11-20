/*
const express = require('express');
const router = express.Router();
const Task = require('../models/task');
const auth = require('../middleware/authMiddleware');

// Obtener tareas del usuario autenticado
// routes/tasks.js
// Obtener tareas del usuario autenticado (con búsqueda opcional)
router.get('/', auth, async (req, res) => {
  try {
    const { search } = req.query; // texto a buscar
    const query = { userId: req.user.userId }; // base: tareas solo del usuario

    // Si hay texto de búsqueda, añadir filtro adicional
    if (search) {
      query.title = { $regex: search, $options: 'i' }; // búsqueda parcial e insensible a mayúsculas
    }

    const tasks = await Task.find(query);
    res.json(tasks);
  } catch {
    res.status(500).json({ message: 'Error al obtener tareas' });
  }
});


// Crear nueva tarea
// Crear nueva tarea
router.post('/', auth, async (req, res) => {
  const { title, subject, dueDate, priority } = req.body; // 👈 agrega priority aquí
  try {
    const newTask = new Task({
      title,
      subject,
      dueDate,
      priority, // 👈 y pásala aquí también
      userId: req.user.userId
    });
    const savedTask = await newTask.save();
    res.status(201).json(savedTask);
  } catch (error) {
    console.error("❌ Error al crear tarea:", error);
    res.status(400).json({ message: 'Error al crear tarea' });
  }
});


// Marcar como completada
router.put('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { completed: req.body.completed },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });
    res.json(task);
  } catch {
    res.status(400).json({ message: 'Error al actualizar tarea' });
  }
});

// Eliminar tarea
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!deleted) return res.status(404).json({ message: 'Tarea no encontrada' });
    res.json({ message: 'Tarea eliminada correctamente' });
  } catch {
    res.status(400).json({ message: 'Error al eliminar tarea' });
  }
});

module.exports = router;
*/
const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");

const Task = require("../models/task");
const authMiddleware = require("../middleware/authMiddleware");

// ---------- Configuración de Multer ----------
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniquePrefix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// ==========================
// 📌 Obtener tareas del usuario
// ==========================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(tasks);
  } catch (err) {
    console.error("Error al cargar tareas:", err);
    res.status(500).json({ message: "Error al cargar tareas" });
  }
});

// ==========================
// 📌 Crear nueva tarea
// ==========================
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, subject, dueDate, priority } = req.body;

    if (!title) {
      return res.status(400).json({ message: "El título es obligatorio" });
    }

    const newTask = await Task.create({
      title,
      subject,
      dueDate,
      priority,
      userId: req.user.id,
    });

    res.status(201).json(newTask);
  } catch (err) {
    console.error("Error al crear tarea:", err);
    res.status(500).json({ message: "Error al crear tarea" });
  }
});

// ==========================
// 📌 Actualizar tarea
// ==========================
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { title, subject, dueDate, priority, completed } = req.body;

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { title, subject, dueDate, priority, completed },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    res.json(task);
  } catch (err) {
    console.error("Error al actualizar tarea:", err);
    res.status(500).json({ message: "Error al actualizar tarea" });
  }
});

// ==========================
// 📌 Eliminar tarea
// ==========================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    res.json({ message: "Tarea eliminada" });
  } catch (err) {
    console.error("Error al eliminar tarea:", err);
    res.status(500).json({ message: "Error al eliminar tarea" });
  }
});

// ==========================
// 📌 Subir archivo a una tarea
//     POST /api/tasks/:id/upload
// ==========================
router.post(
  "/:id/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const task = await Task.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!task) {
        return res.status(404).json({ message: "Tarea no encontrada" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No se envió ningún archivo" });
      }

      task.attachments.push({
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        url: `/uploads/${req.file.filename}`,
        size: req.file.size,
      });

      await task.save();

      res.json(task);
    } catch (err) {
      console.error("Error subiendo archivo:", err);
      res.status(500).json({ message: "Error subiendo archivo" });
    }
  }
);

// ==========================
// 📌 Marcar tarea como GLOBAL
// ==========================
router.put("/:id/make-global", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    task.isGlobal = true;
    await task.save();

    res.json(task);
  } catch (err) {
    console.error("Error marcando tarea como global:", err);
    res.status(500).json({ message: "Error marcando tarea como global" });
  }
});

// ==========================
// 📌 Listar tareas globales
// ==========================
router.get("/global/list", authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ isGlobal: true })
      .sort({ createdAt: -1 })
      .populate("userId", "name email");

    res.json(tasks);
  } catch (err) {
    console.error("Error obteniendo tareas globales:", err);
    res.status(500).json({ message: "Error obteniendo tareas globales" });
  }
});

module.exports = router;
