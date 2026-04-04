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
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

async function createUser(name, email, hashedPassword) {
    const users = readUsers();
    // The very first registered user automatically becomes admin; everyone after is agent.
    const role = users.length === 0 ? 'admin' : 'agent';
    const newUser = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        created_at: new Date().toISOString(),
    };
    users.push(newUser);
    await writeUsers(users);
    return newUser;
}

/** Returns all users (passwords excluded). Admin-only use. */
function getAllUsers() {
    const users = readUsers();
    return users.map(({ password: _pw, ...u }) => u);
}

module.exports = { validateUserInput, hashPassword, comparePassword, findUserByEmail, createUser, getAllUsers };
