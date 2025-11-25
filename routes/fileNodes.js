
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Y = require("yjs");

const FileNode = require("../models/fileNode");
const Document = require("../models/document");
const authMiddleware = require("../middleware/authMiddleware");

// ========================
// MULTER
// ========================
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ================================================================
// ⭐ Helper: Heredar colaboradores desde la carpeta padre
// ================================================================
async function inheritCollaborators(parentId) {
  if (!parentId) return [];

  const parent = await FileNode.findById(parentId);
  if (!parent) return [];

  // Clonamos para no mutar accidentalmente
  return [...(parent.collaborators || [])];
}

// =====================================================
// ⭐ LISTAR NODOS DE UNA CARPETA (owner o colaborador)
// =====================================================
router.get("/", authMiddleware, async (req, res) => {
  try {
    let parent = req.query.parent ?? null;

    // Por si el frontend manda "null" (string) como raíz
    if (parent === "null" || parent === "") {
      parent = null;
    }

    const nodes = await FileNode.find({
      parent,
      $or: [
        { owner: req.user.id },
        { collaborators: req.user.id },
      ],
    });

    res.json(nodes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error listando nodos" });
  }
});

// =====================================================
// ⭐ NUEVO: LISTAR TODOS LOS DOCUMENTOS ACCESIBLES
//    (tipo “Mis documentos” global, sin importar carpeta)
// =====================================================
router.get("/my-docs", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const nodes = await FileNode.find({
      type: "doc",
      $or: [
        { owner: userId },
        { collaborators: userId },
      ],
    }).populate("documentId");

    const docs = nodes
      .filter(n => n.documentId) // por seguridad
      .map(n => ({
        fileNodeId: n._id,
        parent: n.parent,
        pathType: n.type,
        name: n.name,
        document: {
          _id: n.documentId._id,
          title: n.documentId.title,
          owner: n.documentId.owner,
          collaborators: n.documentId.collaborators,
          createdAt: n.documentId.createdAt,
          updatedAt: n.documentId.updatedAt,
        },
      }));

    res.json(docs);
  } catch (err) {
    console.error("Error obteniendo mis documentos desde fileNodes:", err);
    res.status(500).json({ message: "Error listando documentos accesibles" });
  }
});

// =====================================================
// ⭐ CREAR CARPETA (con herencia automática)
// =====================================================
router.post("/folder", authMiddleware, async (req, res) => {
  try {
    const { name, parent } = req.body;

    const inherited = await inheritCollaborators(parent);

    const node = await FileNode.create({
      name,
      parent: parent || null,
      type: "folder",
      owner: req.user.id,
      collaborators: inherited,
    });

    res.json(node);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creando carpeta" });
  }
});

// =====================================================
// ⭐ CREAR DOCUMENTO DESDE FILE EXPLORER (con herencia)
// =====================================================
router.post("/doc", authMiddleware, async (req, res) => {
  try {
    const { title, parent } = req.body;
    const owner = req.user.id;

    const inherited = await inheritCollaborators(parent);

    // Crear snapshot vacío Yjs
    const ydoc = new Y.Doc();
    const snapshot = Y.encodeStateAsUpdate(ydoc);

    // Crear documento
    const newDoc = await Document.create({
      title,
      owner,
      collaborators: [...inherited],
      content: Buffer.from(snapshot),
    });

    // Crear nodo relacionado
    const node = await FileNode.create({
      name: title,
      type: "doc",
      documentId: newDoc._id,
      parent: parent || null,
      owner,
      collaborators: [...inherited],
    });

    res.json(node);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creando documento" });
  }
});

// =====================================================
// ⭐ SUBIR ARCHIVO (con herencia automática)
// =====================================================
router.post(
  "/:parentId/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      const parentId =
        req.params.parentId !== "null" ? req.params.parentId : null;

      if (!req.file)
        return res.status(400).json({ message: "No se envió archivo" });

      const inherited = await inheritCollaborators(parentId);

      const node = await FileNode.create({
        name: req.file.originalname,
        type: "file",
        parent: parentId,
        owner: req.user.id,
        collaborators: inherited,
        file: {
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          url: `/uploads/${req.file.filename}`,
          size: req.file.size,
        },
      });

      res.json(node);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error subiendo archivo" });
    }
  }
);

// =====================================================
// ⭐ ELIMINAR NODO (RECURSIVO)
// =====================================================
async function deleteNodeRecursive(nodeId) {
  const children = await FileNode.find({ parent: nodeId });

  for (const child of children) {
    await deleteNodeRecursive(child._id);
  }

  const node = await FileNode.findById(nodeId);
  if (!node) return;

  if (node.type === "file" && node.file?.url) {
    const filePath = path.join(__dirname, "..", node.file.url);
    fs.unlink(filePath, () => {});
  }

  if (node.type === "doc" && node.documentId) {
    await Document.findByIdAndDelete(node.documentId);
  }

  await node.deleteOne();
}

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const node = await FileNode.findById(req.params.id);

    if (!node) return res.status(404).json({ message: "Nodo no encontrado" });

    if (node.owner.toString() !== req.user.id)
      return res.status(403).json({ message: "No puedes borrar este nodo" });

    await deleteNodeRecursive(node._id);

    res.json({ message: "Nodo eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error eliminando nodo" });
  }
});

// =====================================================
// ⭐⭐ LISTAR ÁRBOL COMPLETO ACCESIBLE (como Google Drive)
// =====================================================

async function buildTree(userId, parent = null) {
  // 1️⃣ Buscar nodos accesibles en este nivel
  const nodes = await FileNode.find({
    parent,
    $or: [
      { owner: userId },
      { collaborators: userId }
    ]
  }).populate("documentId");

  // 2️⃣ Para cada carpeta, buscar sus hijos de forma recursiva
  const result = [];

  for (const node of nodes) {
    let children = [];

    if (node.type === "folder") {
      children = await buildTree(userId, node._id);
    }

    result.push({
      _id: node._id,
      name: node.name,
      type: node.type,
      parent: node.parent,
      owner: node.owner,
      collaborators: node.collaborators,
      document: node.documentId
        ? {
            _id: node.documentId._id,
            title: node.documentId.title,
            owner: node.documentId.owner,
            collaborators: node.documentId.collaborators,
          }
        : null,
      children
    });
  }

  return result;
}


router.get("/tree", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const tree = await buildTree(userId, null);

    res.json(tree);
  } catch (err) {
    console.error("Error construyendo árbol accesible:", err);
    res.status(500).json({ message: "Error construyendo árbol" });
  }
});


module.exports = router;

