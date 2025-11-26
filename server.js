/*
// server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const profileRoutes = require('./routes/profile');
const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');
const globalTasksRoutes = require('./routes/globalTasks');
const documentRoutes = require('./routes/documents');

// ⭐ NUEVO: Sistema de carpetas/archivos tipo Google Drive
const fileNodesRoutes = require('./routes/fileNodes');

const { initSocket } = require('./socket');

const app = express();
const PORT = process.env.PORT || 5000;

// -----------------------------
// 🌐 CORS
// -----------------------------
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://mern-block-cloud-g3.s3-website.us-east-2.amazonaws.com",
    "https://mern-block-cloud-g3.s3-website.us-east-2.amazonaws.com"
  ],
  credentials: true,
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: "Content-Type, Authorization"
}));
app.use(express.json());
app.use(cookieParser());

// -----------------------------
// 🗂 Servir archivos subidos
// -----------------------------
app.use("/uploads", express.static("uploads"));

// -----------------------------
// 🛣 RUTAS
// -----------------------------
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/tasks/global', globalTasksRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/profile', profileRoutes);

// ⭐ NUEVO: FileNode (carpetas, archivos y documentos colaborativos)
app.use('/api/files', fileNodesRoutes);

// -----------------------------
// 🔌 Servidor HTTP + Socket.io
// -----------------------------
const http = require('http');
const server = http.createServer(app);

initSocket(server); // Inicializar websockets (documentos colaborativos)

// -----------------------------
// 🛢 Conexión a MongoDB y start
// -----------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB Atlas');

    server.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error de conexión a MongoDB:', err);
    process.exit(1);
  });
*/


// server.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const profileRoutes = require('./routes/profile');
const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');
const globalTasksRoutes = require('./routes/globalTasks');
const documentRoutes = require('./routes/documents');

const fileNodesRoutes = require('./routes/fileNodes');

const { initSocket } = require('./socket');

const app = express();
const PORT = process.env.PORT || 5000;

// -----------------------------
// 🌐 CORS — CORREGIDO PARA AWS
// -----------------------------
app.use(cors({
  origin: "*",      // ⭐ Permitir cualquier frontend (JWT controla acceso)
  credentials: true,
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: "Content-Type, Authorization"
}));

app.use(express.json());
app.use(cookieParser());

// -----------------------------
// 🗂 Servir archivos subidos
// -----------------------------
app.use("/uploads", express.static("uploads"));

// -----------------------------
// 🛣 RUTAS
// -----------------------------
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/tasks/global', globalTasksRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/profile', profileRoutes);

app.use('/api/files', fileNodesRoutes);

// -----------------------------
// 🔌 Servidor HTTP + Socket.io
// -----------------------------
const http = require('http');
const server = http.createServer(app);

initSocket(server); // WebSockets inicializados correctamente

// -----------------------------
// 🛢 Conexión a MongoDB y start
// -----------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB Atlas');

    server.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error de conexión a MongoDB:', err);
    process.exit(1);
  });
