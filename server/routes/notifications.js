const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { getStaleLeads } = require('../controllers/leadsController');

// All notification routes require authentication
router.use(verifyToken);

/**
 * GET /api/notifications
 * Returns in-app notifications for the current user.
 * Notifications are computed on-the-fly from current lead state — no
 * separate storage required.
 */
router.get('/', (req, res) => {
    const stale = getStaleLeads(req.userId);
    const now = Date.now();
    const DAY = 86_400_000;

    const notifications = stale.map((lead) => {
        const lastActivity = new Date(lead.updatedAt || lead.createdAt).getTime();
        const daysIdle = Math.floor((now - lastActivity) / DAY);
        const stageLabel = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
        return {
            id: `stale-${lead.id}`,
            type: 'stale_lead',
            severity: daysIdle >= 14 ? 'high' : 'medium',
            message: `"${lead.name}" has been in ${stageLabel} for ${daysIdle} day${daysIdle !== 1 ? 's' : ''} with no activity`,
            leadId: lead.id,
            leadName: lead.name,
            daysIdle,
            createdAt: lead.updatedAt || lead.createdAt,
        };
    });

    // Sort by severity (high first) then by daysIdle descending
    notifications.sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
        return b.daysIdle - a.daysIdle;
    });

    return res.json(notifications);
});

module.exports = router;
