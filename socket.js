// socket.js
const { Server } = require("socket.io");
const Y = require("yjs");
const Document = require("./models/document");

// 👇 NO necesitamos awareness en el servidor, solo reenviamos bytes
const docs = new Map(); // cache en memoria de Y.Doc por documentId

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("🟢 Cliente conectado:", socket.id);

    socket.on("join-document", async ({ documentId }) => {
      if (!documentId) {
        console.warn("join-document sin documentId");
        return;
      }

      socket.join(documentId);
      console.log(`Socket ${socket.id} se unió a sala ${documentId}`);

      // Obtener o crear Y.Doc en memoria
      let ydoc = docs.get(documentId);
      if (!ydoc) {
        ydoc = new Y.Doc();
        docs.set(documentId, ydoc);

        // Intentar cargar desde BD si existe
        try {
          const dbDoc = await Document.findById(documentId);
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
                // Aplicamos snapshot completo de Yjs
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

      // Enviar estado actual (snapshot completo)
      try {
        const update = Y.encodeStateAsUpdate(ydoc);
        socket.emit("document-state", Array.from(update));
      } catch (err) {
        console.error("Error enviando estado inicial:", err);
      }

      // Escuchar updates de contenido (Yjs)
      socket.on("sync-update", (incoming) => {
        try {
          const u8 =
            incoming instanceof Uint8Array
              ? incoming
              : Array.isArray(incoming)
              ? Uint8Array.from(incoming)
              : new Uint8Array(incoming); // fallback

          // Aplicar al Y.Doc del servidor (marcado como origen "socket")
          Y.applyUpdate(ydoc, u8, "socket");

          // Reenviar a otros clientes en la sala
          socket.to(documentId).emit("sync-update", Array.from(u8));
        } catch (err) {
          console.error("Error aplicando/reenviando update:", err);
        }
      });

      // 🔵 Awareness: reenviamos updates de presencia (cursores, etc.)
      socket.on("awareness-update", (incoming) => {
        try {
          const u8 =
            incoming instanceof Uint8Array
              ? incoming
              : Array.isArray(incoming)
              ? Uint8Array.from(incoming)
              : new Uint8Array(incoming);

          // Simplemente reenviamos a los demás en la sala
          socket.to(documentId).emit("awareness-update", Array.from(u8));
        } catch (err) {
          console.error("Error reenviando awareness-update:", err);
        }
      });

      // Guardar documento en BD cuando se solicite
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

      // Manejar desconexión del socket
      socket.on("disconnect", () => {
        console.log("🔴 Cliente desconectado:", socket.id, "de doc", documentId);

        // Pequeño delay para permitir reconexiones rápidas
        setTimeout(async () => {
          const room = io.sockets.adapter.rooms.get(documentId);

          // Si ya no queda nadie en la sala, podemos liberar memoria
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
        }, 30000); // 30s de gracia
      });
    });
  });

  console.log("⚡ Socket.IO + Yjs inicializado");
}

module.exports = { initSocket };
