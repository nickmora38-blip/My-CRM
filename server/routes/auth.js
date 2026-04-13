const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const {
    validateUserInput,
    hashPassword,
    comparePassword,
    findUserByEmail,
    createUser,
    createResetToken,
    consumeResetToken,
} = require('../controllers/userController');
const { generateToken } = require('../middleware/auth');

// ─── Email transport (optional – configure via env vars) ──────────────────────
const SMTP_CONFIGURED = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const emailTransport = SMTP_CONFIGURED
    ? nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : null;

async function sendEmail({ to, subject, text, html }) {
    if (!emailTransport) {
        console.log(`[EMAIL - not configured] To: ${to} | Subject: ${subject}\n${text}`);
        return;
    }
    await emailTransport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html,
    });
}

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

// POST /api/auth/forgot-password
// Generates a one-time reset token and emails the link to the user.
// Always responds with 200 to avoid user enumeration.
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const result = await createResetToken(email);
        if (result) {
            const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${result.token}`;
            await sendEmail({
                to: result.user.email,
                subject: 'Password Reset Request',
                text: `Hi ${result.user.name},\n\nClick the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
                html: `<p>Hi ${result.user.name},</p><p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
            });
        }
        // Always return 200 to prevent user enumeration
        return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    } catch (err) {
        console.error('Forgot-password error:', err);
        return res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

// POST /api/auth/reset-password
// Consumes the reset token and updates the password.
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const result = await consumeResetToken(token, password);
        if (!result.ok) {
            return res.status(400).json({ error: result.error });
        }
        return res.json({ message: 'Password updated successfully. You can now sign in.' });
    } catch (err) {
        console.error('Reset-password error:', err);
        return res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

module.exports = router;
