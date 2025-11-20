const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Acceso denegado' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    // Normalizamos para que todas las rutas usen req.user.id
    req.user = { id: verified.userId }; 
    next();
  } catch (err) {
    console.error("AuthMiddleware error:", err);
    res.status(400).json({ message: 'Token inválido' });
  }
};

module.exports = authMiddleware;
