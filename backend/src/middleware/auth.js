const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ pesan: 'Belum login. Silakan masuk dulu.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = payload; // { id, email, role, nama_pengguna }
    next();
  } catch {
    return res.status(401).json({ pesan: 'Sesi habis. Silakan masuk lagi.' });
  }
}

// requireRole('owner'), requireRole('owner','kasir'), dst.
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ pesan: 'Belum login.' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ pesan: 'Maaf, peran Anda tidak boleh membuka ini.' });
    }
    next();
  };
}

module.exports = { authRequired, requireRole };
