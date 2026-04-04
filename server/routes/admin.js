const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { getAllUsers } = require('../controllers/userController');

// All admin routes require a valid token AND admin role
router.use(verifyToken, requireAdmin);

/**
 * GET /api/admin/users
 * Returns the full user list (passwords excluded). Admins only.
 */
router.get('/users', (req, res) => {
    return res.json(getAllUsers());
});

module.exports = router;
