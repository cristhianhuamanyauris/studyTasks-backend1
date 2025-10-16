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
