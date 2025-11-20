// routes/documents.js
const express = require('express');
const router = express.Router();
const Document = require('../models/document');
const authMiddleware = require('../middleware/authMiddleware');
const Y = require('yjs'); // 👈 Necesario para snapshots Yjs

// ===============================================================
// 📌 Crear un nuevo documento (con snapshot inicial Yjs)
// ===============================================================
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "El título es obligatorio" });
    }

    // Crear documento Yjs vacío PERO REAL
    const ydoc = new Y.Doc();
    const snapshot = Y.encodeStateAsUpdate(ydoc);

    const newDoc = await Document.create({
      title,
      owner: req.user.id,
      collaborators: [],
      content: Buffer.from(snapshot), // 👈 YA NO ES VACÍO
    });

    res.status(201).json(newDoc);
  } catch (err) {
    console.error("Error creando documento:", err);
    res.status(500).json({ message: err.message });
  }
});

// ===============================================================
// 📌 Obtener todos los documentos del usuario
// ===============================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const docs = await Document.find({
      $or: [
        { owner: userId },
        { collaborators: userId },
      ],
    })
      .populate("owner", "name email")
      .populate("collaborators", "name email");

    const formattedDocs = docs.map(doc => ({
      _id: doc._id,
      title: doc.title,
      owner: doc.owner,
      collaborators: doc.collaborators,
      hasContent: !!(doc.content && doc.content.length),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    res.json(formattedDocs);
  } catch (err) {
    console.error("Error cargando documentos:", err);
    res.status(500).json({ message: err.message });
  }
});

// ===============================================================
// 📌 Obtener un documento por ID (solo metadata)
//     El contenido Yjs lo gestiona exclusivamente el WebSocket
// ===============================================================
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id)
      .populate("owner", "name email")
      .populate("collaborators", "name email");

    if (!doc) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    res.json({
      _id: doc._id,
      title: doc.title,
      owner: doc.owner,
      collaborators: doc.collaborators,
      hasContent: !!(doc.content && doc.content.length),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error("Error obteniendo documento:", err);
    res.status(500).json({ message: err.message });
  }
});

// ===============================================================
// 📌 Actualizar document metadata (título y colaboradores)
//     *El contenido Yjs NO se guarda aquí*
// ===============================================================
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, collaborators } = req.body;

    if (!title) {
      return res.status(400).json({ message: "El título es obligatorio" });
    }

    const updateFields = { title };

    if (Array.isArray(collaborators)) {
      updateFields.collaborators = collaborators;
    }

    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    )
      .populate("owner", "name email")
      .populate("collaborators", "name email");

    if (!doc) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    res.json({
      _id: doc._id,
      title: doc.title,
      owner: doc.owner,
      collaborators: doc.collaborators,
      hasContent: !!(doc.content && doc.content.length),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error("Error actualizando documento:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
