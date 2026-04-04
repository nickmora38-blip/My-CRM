const express = require('express');
const router = express.Router();
const {
    validateUserInput,
    hashPassword,
    comparePassword,
    findUserByEmail,
    createUser,
} = require('../controllers/userController');
const { generateToken } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    const validationError = validateUserInput(name, email, password);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const existingUser = findUserByEmail(email);
    if (existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists' });
    }

    try {
        const hashedPassword = await hashPassword(password);
        const user = await createUser(name, email, hashedPassword);
        const token = generateToken(user.id, user.role);

        return res.status(201).json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ error: 'Server error during registration' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = findUserByEmail(email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    try {
        const isValid = await comparePassword(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken(user.id, user.role);

        return res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Server error during login' });
    }
});

module.exports = router;
