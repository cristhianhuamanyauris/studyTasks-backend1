const mongoose = require("mongoose");

const fileNodeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    type: {
      type: String,
      enum: ["folder", "file", "doc"],
      required: true,
    },

    // ID del documento colaborativo
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },

    // Archivo físico (solo para type "file")
    file: {
      filename: String,
      mimetype: String,
      url: String,
      size: Number,
    },

    // Carpeta padre
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FileNode",
      default: null,
    },

    // Dueño del nodo
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ⭐⭐⭐ COLABORADORES DEL NODO (esta parte te faltaba)
    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("FileNode", fileNodeSchema);
