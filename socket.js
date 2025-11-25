// socket.js
const { Server } = require("socket.io");
const Y = require("yjs");
const jwt = require("jsonwebtoken");
const Document = require("./models/document");

const docs = new Map();
const JWT_SECRET = process.env.JWT_SECRET;

// Helper: valida token y devuelve userId
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.id || decoded._id || decoded.userId;
  } catch (err) {
    return null;
  }
}

async function userHasAccessToDocument(documentId, userId) {
  if (!userId) return false;

  const doc = await Document.findOne({
    _id: documentId,
    $or: [{ owner: userId }, { collaborators: userId }],
  });

  return !!doc;
}

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 Cliente conectado:", socket.id);

    socket.on("join-document", async ({ documentId, token }) => {
      if (!documentId) {
        console.warn("join-document sin documentId");
        return;
      }

      const userId = verifyToken(token);
      if (!userId) {
        console.warn("join-document sin token válido");
        socket.emit("join-error", "No autorizado");
        return;
      }

      // 🚨 NUEVO: Verificar si el documento existe (puede haber sido eliminado)
      const existingDoc = await Document.findById(documentId);
      if (!existingDoc) {
        console.warn(`Intento de acceso a documento eliminado: ${documentId}`);
        socket.emit("join-error", "Este documento ha sido eliminado");
        return;
      }

      const allowed = await userHasAccessToDocument(documentId, userId);
      if (!allowed) {
        console.warn(`Usuario ${userId} sin acceso a doc ${documentId}`);
        socket.emit("join-error", "No tienes acceso a este documento");
        return;
      }

      socket.join(documentId);
      console.log(`Socket ${socket.id} (user ${userId}) se unió a sala ${documentId}`);

      let ydoc = docs.get(documentId);
      if (!ydoc) {
        ydoc = new Y.Doc();
        docs.set(documentId, ydoc);

        try {
          const dbDoc = existingDoc;
          if (dbDoc && dbDoc.content) {
            let u8;

            if (Buffer.isBuffer(dbDoc.content)) {
              u8 = new Uint8Array(dbDoc.content);
            } else if (Array.isArray(dbDoc.content)) {
              u8 = Uint8Array.from(dbDoc.content);
            } else {
              try {
                u8 = Uint8Array.from(dbDoc.content.data || []);
              } catch (e) {
                u8 = new Uint8Array([]);
              }
            }

            if (u8 && u8.length) {
              try {
                Y.applyUpdate(ydoc, u8, "socket");
                console.log(`Contenido cargado desde BD para doc ${documentId}`);
              } catch (err) {
                console.error("Error aplicando contenido inicial desde BD:", err);
              }
            } else {
              console.log(`Documento ${documentId} en BD sin contenido (buffer vacío)`);
            }
          }
        } catch (err) {
          console.error("Error consultando documento en BD:", err);
        }
      }

      // Enviar estado actual
      try {
        const update = Y.encodeStateAsUpdate(ydoc);
        socket.emit("document-state", Array.from(update));
      } catch (err) {
        console.error("Error enviando estado inicial:", err);
      }

      // Updates de contenido
      socket.on("sync-update", (incoming) => {
        try {
          const u8 =
            incoming instanceof Uint8Array
              ? incoming
              : Array.isArray(incoming)
              ? Uint8Array.from(incoming)
              : new Uint8Array(incoming);

          Y.applyUpdate(ydoc, u8, "socket");
          socket.to(documentId).emit("sync-update", Array.from(u8));
        } catch (err) {
          console.error("Error aplicando/reenviando update:", err);
        }
      });

      // Awareness
      socket.on("awareness-update", (incoming) => {
        try {
          const u8 =
            incoming instanceof Uint8Array
              ? incoming
              : Array.isArray(incoming)
              ? Uint8Array.from(incoming)
              : new Uint8Array(incoming);

          socket.to(documentId).emit("awareness-update", Array.from(u8));
        } catch (err) {
          console.error("Error reenviando awareness-update:", err);
        }
      });

      // Guardar desde el cliente
      socket.on("save-document", async () => {
        try {
          const snapshot = Y.encodeStateAsUpdate(ydoc);
          await Document.findByIdAndUpdate(documentId, {
            content: Buffer.from(snapshot),
          });

          console.log(`💾 Documento ${documentId} guardado en Mongo`);
        } catch (err) {
          console.error("Error guardando documento en BD:", err);
        }
      });

      socket.on("disconnect", () => {
        console.log("🔴 Cliente desconectado:", socket.id, "de doc", documentId);

        setTimeout(async () => {
          const room = io.sockets.adapter.rooms.get(documentId);

          if (!room || room.size === 0) {
            const ydocToSave = docs.get(documentId);

            if (ydocToSave) {
              try {
                const snapshot = Y.encodeStateAsUpdate(ydocToSave);
                await Document.findByIdAndUpdate(documentId, {
                  content: Buffer.from(snapshot),
                });
                console.log(
                  `💾 Snapshot final de doc ${documentId} guardado antes de limpiar memoria`
                );
              } catch (err) {
                console.error("Error en autosave final de doc:", documentId, err);
              }

              docs.delete(documentId);
              console.log(`🧹 Y.Doc de ${documentId} eliminado de memoria`);
            }
          }
        }, 30000);
      });
    });
  });

  console.log("⚡ Socket.IO + Yjs inicializado");
}

module.exports = { initSocket };
