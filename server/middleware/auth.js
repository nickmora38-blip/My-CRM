const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'exclusive-crm-secret-key';
const JWT_EXPIRES_IN = '7d';

function generateToken(userId, role) {
    return jwt.sign({ id: userId, role: role || 'agent' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        req.userRole = decoded.role || 'agent';
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/** Middleware: requires the caller to be an admin. Must run after verifyToken. */
function requireAdmin(req, res, next) {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

module.exports = { generateToken, verifyToken, requireAdmin };
