const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const fs = require("fs");

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

    res.status(201).json({ task: newTask });
  } catch (err) {
    console.error("Error al crear tarea:", err);
    res.status(500).json({ message: "Error al crear tarea" });
  }
});



// ==========================
// 📌 Actualizar tarea completa
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

    if (task.subtasks.length > 0) {
      const allDone = task.subtasks.every((s) => s.done);
      task.completed = allDone;
      await task.save();
    }

    res.json({ task });
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
    res.status(500).json({ message: "Error eliminando tarea" });
  }
});



// ==========================
// 📌 Subir archivo a tarea
// ==========================
router.post("/:id/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });
    if (!req.file) return res.status(400).json({ message: "No se envió ningún archivo" });

    task.attachments.push({
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      url: `/uploads/${req.file.filename}`,
      size: req.file.size,
    });

    await task.save();

    res.json({ task });
  } catch (err) {
    console.error("Error subiendo archivo:", err);
    res.status(500).json({ message: "Error subiendo archivo" });
  }
});



// ==========================
// 📌 Eliminar archivo adjunto de tarea
// ==========================
router.delete("/:taskId/files/:filename", authMiddleware, async (req, res) => {
  try {
    const { taskId, filename } = req.params;

    const task = await Task.findOne({
      _id: taskId,
      userId: req.user.id,
    });

    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });

    const file = task.attachments.find((f) => f.filename === filename);
    if (!file) return res.status(404).json({ message: "Archivo no encontrado" });

    const filePath = path.join(__dirname, "..", file.url);
    fs.unlink(filePath, () => {});

    task.attachments = task.attachments.filter((f) => f.filename !== filename);
    await task.save();

    res.json({ message: "Archivo eliminado", task });
  } catch (err) {
    console.error("Error eliminando archivo:", err);
    res.status(500).json({ message: "Error eliminando archivo" });
  }
});



// ================================================================
// ⭐ SUBTAREAS ⭐
// ================================================================

// Crear subtarea
router.post("/:id/subtasks", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "El texto es obligatorio" });

    const task = await Task.findOne({ _id: req.params.id, userId: req.user.id });
    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });

    task.subtasks.push({ text });
    task.completed = false;

    await task.save();
    res.json({ task });
  } catch (err) {
    console.error("Error agregando subtarea:", err);
    res.status(500).json({ message: "Error agregando subtarea" });
  }
});



// Actualizar estado de subtarea
router.put("/:taskId/subtasks/:subId", authMiddleware, async (req, res) => {
  try {
    const { done } = req.body;

    const task = await Task.findOne({
      _id: req.params.taskId,
      userId: req.user.id,
    });
    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });

    const sub = task.subtasks.id(req.params.subId);
    if (!sub) return res.status(404).json({ message: "Subtarea no encontrada" });

    sub.done = done;

    if (task.subtasks.length > 0) {
      task.completed = task.subtasks.every((s) => s.done);
    }

    await task.save();
    res.json({ task });
  } catch (err) {
    console.error("Error actualizando subtarea:", err);
    res.status(500).json({ message: err.message });
  }
});



// Eliminar subtarea
router.delete("/:taskId/subtasks/:subId", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      userId: req.user.id,
    });
    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });

    task.subtasks = task.subtasks.filter((s) => s._id.toString() !== req.params.subId);

    if (task.subtasks.length > 0) {
      task.completed = task.subtasks.every((s) => s.done);
    }

    await task.save();
    res.json({ task });
  } catch (err) {
    console.error("Error eliminando subtarea:", err);
    res.status(500).json({ message: err.message });
  }
});



// -----------------------------------------------------------
// 📌 Subir archivo a SUBTAREA
// -----------------------------------------------------------
router.post(
  "/:taskId/subtasks/:subId/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const { taskId, subId } = req.params;

      const task = await Task.findOne({
        _id: taskId,
        userId: req.user.id,
      });
      if (!task) return res.status(404).json({ message: "Tarea no encontrada" });

      const sub = task.subtasks.id(subId);
      if (!sub) return res.status(404).json({ message: "Subtarea no encontrada" });

      if (!req.file) return res.status(400).json({ message: "No se envió archivo" });

      sub.attachments.push({
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        url: `/uploads/${req.file.filename}`,
        size: req.file.size,
      });

      await task.save();

      res.json({ task });
    } catch (err) {
      console.error("Error subiendo archivo a subtarea:", err);
      res.status(500).json({ message: "Error subiendo archivo a subtarea" });
    }
  }
);



// -----------------------------------------------------------
// 📌 Eliminar archivo de SUBTAREA
// -----------------------------------------------------------
router.delete(
  "/:taskId/subtasks/:subId/files/:filename",
  authMiddleware,
  async (req, res) => {
    try {
      const { taskId, subId, filename } = req.params;

      const task = await Task.findOne({
        _id: taskId,
        userId: req.user.id,
      });
      if (!task) return res.status(404).json({ message: "Tarea no encontrada" });

      const sub = task.subtasks.id(subId);
      if (!sub) return res.status(404).json({ message: "Subtarea no encontrada" });

      const file = sub.attachments.find((f) => f.filename === filename);
      if (!file) return res.status(404).json({ message: "Archivo no encontrado" });

      const filePath = path.join(__dirname, "..", file.url);
      fs.unlink(filePath, () => {});

      sub.attachments = sub.attachments.filter((f) => f.filename !== filename);

      await task.save();

      res.json({ message: "Archivo eliminado", task });
    } catch (err) {
      console.error("Error eliminando archivo de subtarea:", err);
      res.status(500).json({ message: "Error eliminando archivo de subtarea" });
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
    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });

    task.isGlobal = true;
    await task.save();

    res.json({ task });
  } catch (err) {
    console.error("Error marcando tarea global:", err);
    res.status(500).json({ message: "Error marcando tarea global" });
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



// ==========================
// 📌 Duplicar tarea global
// ==========================
router.post("/:id/duplicate", authMiddleware, async (req, res) => {
  try {
    const original = await Task.findById(req.params.id);
    if (!original) return res.status(404).json({ message: "Tarea no encontrada" });

    const duplicated = await Task.create({
      title: original.title,
      subject: original.subject,
      dueDate: original.dueDate,
      priority: original.priority,
      attachments: original.attachments,
      subtasks: original.subtasks,
      userId: req.user.id,
      isGlobal: false,
    });

    res.status(201).json({
      message: "Tarea copiada correctamente",
      task: duplicated,
    });
  } catch (err) {
    console.error("Error duplicando tarea:", err);
    res.status(500).json({ message: "Error duplicando tarea" });
  }
});



module.exports = router;
