const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    filename: String,
    mimetype: String,
    url: String,   // ej: "/uploads/123-file.pdf"
    size: Number,
  },
  { _id: false }
);

// ⭐ Subtareas NUEVAS (con archivos)
// ⭐ Subtareas con adjuntos
const subtaskSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    done: { type: Boolean, default: false },

    // NUEVO →
    attachments: {
      type: [
        {
          filename: String,
          mimetype: String,
          url: String,
          size: Number,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String },
    dueDate: { type: Date },
    priority: {
      type: String,
      enum: ['Alta', 'Media', 'Baja'],
      default: 'Media',
    },
    completed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Adjuntos de la tarea
    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    // ⭐ SUBTAREAS con adjuntos
    subtasks: {
      type: [subtaskSchema],
      default: [],
    },

    // Publicación en globales
    isGlobal: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
