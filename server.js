 /*
 const express = require('express');
  const mongoose = require('mongoose');
  const cors = require('cors');
  require('dotenv').config();

  const { initSocket } = require('./socket');

  const app = express();
  const PORT = process.env.PORT || 5000;

  // ---------- CORS ----------
  app.use(cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }));

  app.use(express.json());

  // ---------- RUTAS ----------
  const authRoutes = require('./routes/auth');
  const tasksRoutes = require('./routes/tasks');
  const documentRoutes = require('./routes/documents');

  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/documents', documentRoutes);

  // ---------- HTTP SERVER + SOCKET.IO ----------
  const http = require('http');
  const server = http.createServer(app);

  // ⚡ Inicializar Sockets (pero NO iniciar el servidor aún)
  initSocket(server);

  // ---------- INICIAR SOLO CUANDO MONGO ESTÉ LISTO ----------
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("✅ Conectado a MongoDB Atlas");

      // Ahora sí levantar servidor
      server.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("❌ Error conectando a MongoDB:", err);
      process.exit(1); // para evitar servidor corrupto
    });
*/

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initSocket } = require('./socket');

const app = express();
const PORT = process.env.PORT || 5000;

// -----------------------------
// 🌐 CORS
// -----------------------------
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
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
const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');
const globalTasksRoutes = require('./routes/globalTasks');   // ⭐ NUEVO
const documentRoutes = require('./routes/documents');

app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/tasks/global', globalTasksRoutes);  // ⭐ REGISTRADA
app.use('/api/documents', documentRoutes);

// -----------------------------
// 🔌 Servidor HTTP + Socket.io
// -----------------------------
const http = require('http');
const server = http.createServer(app);

initSocket(server); // Inicializar websockets

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
