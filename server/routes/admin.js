const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const {
    getAllUsers,
    findUserByEmail,
    createUser,
    updateUser,
    deleteUser,
    hashPassword,
    validateUserInput,
} = require('../controllers/userController');

// All admin routes require a valid token AND admin role
router.use(verifyToken, requireAdmin);

/**
 * GET /api/admin/users
 * Returns the full user list (passwords excluded). Admins only.
 */
router.get('/users', (req, res) => {
    return res.json(getAllUsers());
});

/**
 * POST /api/admin/users
 * Create a new user (admin bypasses self-registration).
 */
router.post('/users', async (req, res) => {
    const { name, email, password, role } = req.body;

    const validationError = validateUserInput(name, email, password);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const validRoles = ['admin', 'phc'];
    if (role && !validRoles.includes(role)) {
        return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
    }

    const existing = findUserByEmail(email);
    if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists' });
    }

    try {
        const hashedPassword = await hashPassword(password);
        const user = await createUser(name, email, hashedPassword, role || 'phc');
        const { password: _pw, ...safe } = user;
        return res.status(201).json(safe);
    } catch (err) {
        console.error('Admin create user error:', err);
        return res.status(500).json({ error: 'Server error creating user' });
    }
});

/**
 * PUT /api/admin/users/:id
 * Update a user's name, role, or active status.
 */
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, role, active } = req.body;

    const validRoles = ['admin', 'phc'];
    if (role !== undefined && !validRoles.includes(role)) {
        return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
    }

    // Prevent an admin from demoting themselves
    if (id === req.userId && role && role !== 'admin') {
        return res.status(400).json({ error: 'Admins cannot change their own role' });
    }
    if (id === req.userId && active === false) {
        return res.status(400).json({ error: 'Admins cannot deactivate their own account' });
    }

    try {
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (role !== undefined) updates.role = role;
        if (active !== undefined) updates.active = active;

        const updated = await updateUser(id, updates);
        if (!updated) return res.status(404).json({ error: 'User not found' });
        return res.json(updated);
    } catch (err) {
        console.error('Admin update user error:', err);
        return res.status(500).json({ error: 'Server error updating user' });
    }
});

/**
 * PUT /api/admin/users/:id/permissions
 * Set page-level permissions for a user.
 */
router.put('/users/:id/permissions', async (req, res) => {
    const { id } = req.params;
    const { pagePermissions } = req.body;

    if (typeof pagePermissions !== 'object' || pagePermissions === null) {
        return res.status(400).json({ error: 'pagePermissions must be an object' });
    }

    try {
        const updated = await updateUser(id, { pagePermissions });
        if (!updated) return res.status(404).json({ error: 'User not found' });
        return res.json(updated);
    } catch (err) {
        console.error('Admin set permissions error:', err);
        return res.status(500).json({ error: 'Server error setting permissions' });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user account.
 */
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;

    if (id === req.userId) {
        return res.status(400).json({ error: 'Admins cannot delete their own account' });
    }

    try {
        const removed = await deleteUser(id);
        if (!removed) return res.status(404).json({ error: 'User not found' });
        return res.json({ message: 'User deleted' });
    } catch (err) {
        console.error('Admin delete user error:', err);
        return res.status(500).json({ error: 'Server error deleting user' });
    }
});

module.exports = router;
