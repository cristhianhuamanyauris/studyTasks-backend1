
// socket.js
const { Server } = require("socket.io");
const Y = require("yjs");
const jwt = require("jsonwebtoken");
const Document = require("./models/document");

const docs = new Map();
const JWT_SECRET = process.env.JWT_SECRET;

// ------------------------------
// 🔐 Helper: validar token
// ------------------------------
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

// ------------------------------
// 🚀 Inicializar Socket.IO
// ------------------------------
function initSocket(server) {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://mern-block-cloud-g3.s3-website.us-east-2.amazonaws.com",
    "https://mern-block-cloud-g3.s3-website.us-east-2.amazonaws.com"
  ];

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        console.warn("❌ CORS bloqueado para origen:", origin);
        return callback(new Error("CORS not allowed"));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 Cliente conectado:", socket.id);

    socket.on("join-document", async ({ documentId, token }) => {
      if (!documentId) return;

      const userId = verifyToken(token);
      if (!userId) {
        socket.emit("join-error", "Token inválido");
        return;
      }

      // Validar si existe
      const existingDoc = await Document.findById(documentId);
      if (!existingDoc) {
        socket.emit("join-error", "El documento fue eliminado");
        return;
      }

      const allowed = await userHasAccessToDocument(documentId, userId);
      if (!allowed) {
        socket.emit("join-error", "No tienes acceso a este documento");
        return;
      }

      socket.join(documentId);

      let ydoc = docs.get(documentId);

      if (!ydoc) {
        ydoc = new Y.Doc();
        docs.set(documentId, ydoc);

        try {
          const dbDoc = existingDoc;
          if (dbDoc && dbDoc.content) {
            const u8 = Buffer.isBuffer(dbDoc.content)
              ? new Uint8Array(dbDoc.content)
              : Uint8Array.from(dbDoc.content);
            if (u8.length) Y.applyUpdate(ydoc, u8);
          }
        } catch (err) {
          console.error("Error cargando contenido desde BD:", err);
        }
      }

      // Estado inicial
      try {
        const update = Y.encodeStateAsUpdate(ydoc);
        socket.emit("document-state", Array.from(update));
      } catch (err) {
        console.error("Error enviando estado inicial:", err);
      }

      // Escuchar updates
      socket.on("sync-update", (incoming) => {
        try {
          const u8 = Uint8Array.from(incoming);
          Y.applyUpdate(ydoc, u8);
          socket.to(documentId).emit("sync-update", Array.from(u8));
        } catch (err) {
          console.error("Error reenviando update:", err);
        }
      });

      socket.on("awareness-update", (incoming) => {
        try {
          const u8 = Uint8Array.from(incoming);
          socket.to(documentId).emit("awareness-update", Array.from(u8));
        } catch (err) {
          console.error("Error reenviando awareness:", err);
        }
      });

      // Guardar manual
      socket.on("save-document", async () => {
        try {
          const snapshot = Y.encodeStateAsUpdate(ydoc);
          await Document.findByIdAndUpdate(documentId, {
            content: Buffer.from(snapshot),
          });
        } catch (err) {
          console.error("Error guardando BD:", err);
        }
      });

      // Autosave al desconectar
      socket.on("disconnect", () => {
        console.log("🔴 Cliente desconectado:", socket.id);

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
              } catch (err) {
                console.error("Error autosave final:", err);
              }

              docs.delete(documentId);
            }
          }
        }, 30000);
      });
    });
  });

  console.log("⚡ Socket.IO + Yjs inicializado");
}

module.exports = { initSocket };
