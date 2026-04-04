const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./server/routes/auth');
const leadsRoutes = require('./server/routes/leads');
const notificationsRoutes = require('./server/routes/notifications');
const adminRoutes = require('./server/routes/admin');
const { flagStaleLeads } = require('./server/controllers/leadsController');

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per window
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Parse JSON request bodies
app.use(express.json());

// Auth routes
app.use('/api/auth', authRoutes);

// Leads routes
app.use('/api/leads', leadsRoutes);

// Notifications routes
app.use('/api/notifications', notificationsRoutes);

// Admin routes (role-protected inside)
app.use('/api/admin', adminRoutes);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Return 404 for unhandled API routes so the client falls back to demo data
app.get('/api/{*splat}', (req, res) => {
    res.status(404).json({ error: 'API not configured' });
});

// Handle React routing by returning index.html for all non-API requests
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// ─── Stale-lead scheduler ────────────────────────────────────────────────────
// Runs every 30 minutes to mark leads that have been idle in an early
// pipeline stage. This powers the in-app notification centre.
const THIRTY_MINUTES = 30 * 60 * 1000;
flagStaleLeads().catch((err) => console.error('Initial stale-lead scan failed:', err));
setInterval(() => {
    flagStaleLeads().catch((err) => console.error('Stale-lead scheduler error:', err));
}, THIRTY_MINUTES);
