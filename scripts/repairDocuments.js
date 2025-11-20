// scripts/repairDocuments.js
const mongoose = require("mongoose");
const Y = require("yjs");
require("dotenv").config();

const Document = require("../models/document");

async function repairDocuments() {
  try {
    console.log("🔧 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);

    const docs = await Document.find({});
    console.log(`📄 Documentos encontrados: ${docs.length}`);

    let fixedCount = 0;

    for (const doc of docs) {
      const content = doc.content;

      const isEmpty =
        !content ||
        content.length === 0 ||
        (Array.isArray(content) && content.length === 0);

      if (isEmpty) {
        console.log(`⚠️ Documento vacío detectado → reparando: ${doc._id}`);

        // Crear snapshot Yjs válido
        const ydoc = new Y.Doc();
        const snapshot = Y.encodeStateAsUpdate(ydoc);

        doc.content = Buffer.from(snapshot);
        await doc.save();

        console.log(`   ✔ Reparado`);
        fixedCount++;
      }
    }

    console.log("--------------------------------------------------");
    console.log(`🎉 Reparación completada`);
    console.log(`🛠 Documentos reparados: ${fixedCount}`);
    console.log("--------------------------------------------------");

    await mongoose.disconnect();
    process.exit();
  } catch (err) {
    console.error("❌ Error reparando documentos:", err);
    process.exit(1);
  }
}

repairDocuments();
