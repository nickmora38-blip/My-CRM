const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const {
    validateLeadInput,
    getAllLeads,
    getLeadById,
    createLead,
    updateLead,
    deleteLead,
} = require('../controllers/leadsController');

// All leads routes require authentication
router.use(verifyToken);

// GET /api/leads
router.get('/', (req, res) => {
    const leads = getAllLeads(req.userId);
    return res.json(leads);
});

// GET /api/leads/:id
router.get('/:id', (req, res) => {
    const lead = getLeadById(req.params.id, req.userId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    return res.json(lead);
});

// POST /api/leads
router.post('/', async (req, res) => {
    const validationError = validateLeadInput(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        const lead = await createLead(req.userId, req.body);
        return res.status(201).json(lead);
    } catch (err) {
        return res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// PUT /api/leads/:id
router.put('/:id', async (req, res) => {
    try {
        const lead = await updateLead(req.params.id, req.userId, req.body);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        return res.json(lead);
    } catch (err) {
        return res.status(err.statusCode || 500).json({ error: err.message });
    }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req, res) => {
    try {
        const success = await deleteLead(req.params.id, req.userId);
        if (!success) return res.status(404).json({ error: 'Lead not found' });
        return res.json({ message: 'Lead deleted' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
