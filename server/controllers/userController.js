const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../data/users.json');

function readUsers() {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
}

function writeUsers(users) {
    fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
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

function createUser(name, email, hashedPassword) {
    const users = readUsers();
    const newUser = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        created_at: new Date().toISOString(),
    };
    users.push(newUser);
    writeUsers(users);
    return newUser;
}

module.exports = { validateUserInput, hashPassword, comparePassword, findUserByEmail, createUser };
