const express = require("express");
const router = express.Router();
const Task = require("../models/task");
const authMiddleware = require("../middleware/authMiddleware");

// -----------------------------------------------
// 📌 1. PUBLICAR UNA TAREA COMO GLOBAL
// -----------------------------------------------
router.post("/:id/publish", authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.id });

    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });

    task.isGlobal = true; // lo marcamos como global
    await task.save();

    res.json({ message: "Tarea publicada globalmente" });
  } catch (err) {
    console.error("Error publicando tarea global:", err);
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------------------------
// 📌 2. LISTAR TODAS LAS TAREAS GLOBALES
// -----------------------------------------------
router.get("/list", authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ isGlobal: true })
      .populate("userId", "name email");

    res.json(tasks);
  } catch (err) {
    console.error("Error cargando tareas globales:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
