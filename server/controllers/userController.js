const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../data/users.json');

// Serial write queue — prevents concurrent writes from overwriting each other.
let writeQueue = Promise.resolve();

function readUsers() {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
}

function writeUsers(users) {
    writeQueue = writeQueue.then(() => {
        fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
    });
    return writeQueue;
}

function validateUserInput(name, email, password) {
    if (!name || name.trim().length < 2) {
        return 'Full name must be at least 2 characters';
    }
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!email || !emailRegex.test(email)) {
        return 'Please provide a valid email address';
    }
    if (!password || password.length < 6) {
        return 'Password must be at least 6 characters';
    }
    return null;
}

async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}

function findUserByEmail(email) {
    const users = readUsers();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function findUserById(id) {
    const users = readUsers();
    return users.find((u) => u.id === id) || null;
}

async function createUser(name, email, hashedPassword, roleOverride) {
    const users = readUsers();
    // The very first registered user automatically becomes admin; everyone after is phc.
    const role = roleOverride || (users.length === 0 ? 'admin' : 'phc');
    const newUser = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        active: true,
        created_at: new Date().toISOString(),
    };
    users.push(newUser);
    await writeUsers(users);
    return newUser;
}

async function updateUser(id, updates) {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    const allowed = ['name', 'role', 'active', 'pagePermissions'];
    for (const key of allowed) {
        if (key in updates) {
            users[idx][key] = updates[key];
        }
    }
    await writeUsers(users);
    const { password: _pw, ...safe } = users[idx];
    return safe;
}

async function deleteUser(id) {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    users.splice(idx, 1);
    await writeUsers(users);
    return true;
}

/** Returns all users (passwords excluded). Admin-only use. */
function getAllUsers() {
    const users = readUsers();
    return users.map(({ password: _pw, ...u }) => u);
}

// ─── Password-reset tokens ────────────────────────────────────────────────────
// Tokens are stored directly on the user record so no separate file is needed.

async function createResetToken(email) {
    const users = readUsers();
    const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) return null;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    users[idx].resetToken = token;
    users[idx].resetTokenExpiresAt = expiresAt;
    await writeUsers(users);
    return { token, user: users[idx] };
}

async function consumeResetToken(token, newPassword) {
    const users = readUsers();
    const idx = users.findIndex((u) => u.resetToken === token);
    if (idx === -1) return { ok: false, error: 'Invalid or expired reset link' };
    if (Date.now() > users[idx].resetTokenExpiresAt) {
        return { ok: false, error: 'Reset link has expired. Please request a new one.' };
    }
    users[idx].password = await hashPassword(newPassword);
    delete users[idx].resetToken;
    delete users[idx].resetTokenExpiresAt;
    await writeUsers(users);
    return { ok: true };
}

module.exports = {
    validateUserInput,
    hashPassword,
    comparePassword,
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    deleteUser,
    getAllUsers,
    createResetToken,
    consumeResetToken,
};
