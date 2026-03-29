const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'exclusive-crm-secret-key';
const JWT_EXPIRES_IN = '7d';

function generateToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

module.exports = { generateToken };
