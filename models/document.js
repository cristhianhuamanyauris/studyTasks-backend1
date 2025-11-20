const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    collaborators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }
    ],

    // Guardamos Yjs binario como Buffer
    content: {
      type: Buffer,
      default: null,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);
