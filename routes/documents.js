
const express = require("express");
const router = express.Router();
const Document = require("../models/document");
const User = require("../models/user");
const FileNode = require("../models/fileNode");
const authMiddleware = require("../middleware/authMiddleware");
const Y = require("yjs");

// ==============================
// ⭐ Helper: Verificar acceso
// ==============================
async function findAccessibleDoc(docId, userId) {
  return Document.findOne({
    _id: docId,
    $or: [{ owner: userId }, { collaborators: userId }],
  })
    .populate("owner", "name email")
    .populate("collaborators", "name email");
}

// ==============================
// ⭐⭐⭐ HERENCIA INVERSA DE PERMISOS
// Agregar colaborador a TODAS las carpetas padre
// ==============================
async function addCollaboratorToParents(fileNode, userId) {
  let current = fileNode;

  while (current && current.parent) {
    const parent = await FileNode.findById(current.parent);
    if (!parent) break;

    // Usamos addToSet semánticamente (evita duplicados)
    if (!parent.collaborators.some(c => c.toString() === userId.toString())) {
      parent.collaborators.push(userId);
      await parent.save();
    }

    current = parent;
  }
}

// ===============================================================
// 📌 Crear documento (modo antiguo, sin carpeta)
// ===============================================================
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title)
      return res.status(400).json({ message: "El título es obligatorio" });

    const ydoc = new Y.Doc();
    const snapshot = Y.encodeStateAsUpdate(ydoc);

    const newDoc = await Document.create({
      title,
      owner: req.user.id,
      collaborators: [],
      content: Buffer.from(snapshot),
    });

    const populated = await newDoc.populate("owner", "name email");

    res.status(201).json({
      _id: populated._id,
      title: populated.title,
      owner: populated.owner,
      collaborators: populated.collaborators,
      hasContent: !!(populated.content?.length),
      createdAt: populated.createdAt,
      updatedAt: populated.updatedAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ===============================================================
// 📌 Obtener documentos (UNIFICADO CON FILENODES)
// ===============================================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Docs donde el usuario es owner o colaborador DIRECTO
    const directDocs = await Document.find({
      $or: [{ owner: userId }, { collaborators: userId }],
    })
      .populate("owner", "name email")
      .populate("collaborators", "name email");

    const directIds = directDocs.map(d => d._id.toString());

    // 2️⃣ Docs accesibles por FileNode (tipo doc) donde es owner o colaborador
    const nodes = await FileNode.find({
      type: "doc",
      $or: [
        { owner: userId },
        { collaborators: userId },
      ],
    }).populate("documentId");

    const nodeDocs = nodes
      .filter(n => n.documentId)
      .map(n => n.documentId);

    // Mezclamos y quitamos duplicados
    const allDocsMap = new Map();

    for (const d of directDocs) {
      allDocsMap.set(d._id.toString(), d);
    }

    for (const d of nodeDocs) {
      if (!allDocsMap.has(d._id.toString())) {
        allDocsMap.set(d._id.toString(), d);
      }
    }

    const allDocs = Array.from(allDocsMap.values());

    res.json(
      allDocs.map(doc => ({
        _id: doc._id,
        title: doc.title,
        owner: doc.owner,
        collaborators: doc.collaborators,
        hasContent: !!(doc.content?.length),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }))
    );
  } catch (err) {
    console.error("Error obteniendo documentos:", err);
    res.status(500).json({ message: err.message });
  }
});

// ===============================================================
// 📌 Obtener metadata
// ===============================================================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const doc = await findAccessibleDoc(req.params.id, req.user.id);
    if (!doc)
      return res
        .status(404)
        .json({ message: "Documento no encontrado o sin permisos" });

    res.json({
      _id: doc._id,
      title: doc.title,
      owner: doc.owner,
      collaborators: doc.collaborators,
      hasContent: !!(doc.content?.length),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ===============================================================
// 📌 Invitar colaborador (HERENCIA INVERSA COMPLETA)
// ===============================================================
router.post("/:id/collaborators", authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    const docId = req.params.id;

    if (!email)
      return res.status(400).json({ message: "El email es obligatorio" });

    const doc = await Document.findOne({
      _id: docId,
      owner: req.user.id,
    })
      .populate("owner", "name email")
      .populate("collaborators", "name email");

    if (!doc)
      return res
        .status(403)
        .json({ message: "No tienes permisos para invitar" });

    const userToAdd = await User.findOne({ email });
    if (!userToAdd)
      return res
        .status(404)
        .json({ message: "No existe un usuario con ese email" });

    const alreadyHasAccess =
      userToAdd._id.equals(doc.owner._id) ||
      doc.collaborators.some(c => c._id.equals(userToAdd._id));

    if (alreadyHasAccess)
      return res
        .status(400)
        .json({ message: "Ese usuario ya tiene acceso" });

    // ➕ Agregar al documento
    doc.collaborators.push(userToAdd._id);
    await doc.save();

    // Buscar TODOS los nodos vinculados al documento (por si hay más de uno)
    const fileNodes = await FileNode.find({ documentId: doc._id });

    for (const fileNode of fileNodes) {
      if (
        !fileNode.collaborators.some(
          c => c.toString() === userToAdd._id.toString()
        )
      ) {
        fileNode.collaborators.push(userToAdd._id);
        await fileNode.save();
      }

      // ⭐⭐⭐ Propagar permisos hacia ARRIBA (herencia inversa)
      await addCollaboratorToParents(fileNode, userToAdd._id);
    }

    // Devolver documento completo
    const updated = await Document.findById(docId)
      .populate("owner", "name email")
      .populate("collaborators", "name email");

    res.json(updated);
  } catch (err) {
    console.error("Error invitando colaborador:", err);
    res.status(500).json({ message: err.message });
  }
});

// ===============================================================
// 📌 Quitar colaborador
// ===============================================================
router.delete("/:id/collaborators/:userId", authMiddleware, async (req, res) => {
  try {
    const { id, userId } = req.params;

    const doc = await Document.findOne({ _id: id, owner: req.user.id });
    if (!doc)
      return res.status(403).json({ message: "No tienes permisos" });

    doc.collaborators = doc.collaborators.filter(
      c => c.toString() !== userId
    );
    await doc.save();

    // Quitar también del/los FileNode
    await FileNode.updateMany(
      { documentId: doc._id },
      { $pull: { collaborators: userId } }
    );

    const updated = await Document.findById(id)
      .populate("owner", "name email")
      .populate("collaborators", "name email");

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ===============================================================
// 📌 Eliminar documento
// ===============================================================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);

    if (!doc)
      return res.status(404).json({ message: "Documento no encontrado" });

    if (doc.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "No tienes permisos" });

    // Eliminar nodo(s) asociado(s)
    await FileNode.deleteMany({ documentId: doc._id });

    await Document.findByIdAndDelete(req.params.id);

    res.json({ message: "Documento eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error del servidor" });
  }
});

module.exports = router;
