const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../data/leads.json');

function readLeads() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, '[]');
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
}

function writeLeads(leads) {
    fs.writeFileSync(DB_PATH, JSON.stringify(leads, null, 2));
}

function validateLeadInput(data) {
    if (!data.name || String(data.name).trim().length < 1) {
        return 'Lead name is required';
    }
    return null;
}

function getAllLeads(userId) {
    const leads = readLeads();
    return leads.filter((l) => l.userId === userId);
}

function getLeadById(id, userId) {
    const leads = readLeads();
    return leads.find((l) => l.id === id && l.userId === userId) || null;
}

function createLead(userId, data) {
    const leads = readLeads();
    const newLead = {
        id: crypto.randomUUID(),
        userId,
        name: String(data.name).trim(),
        email: data.email ? String(data.email).trim() : '',
        phone: data.phone ? String(data.phone).trim() : '',
        status: data.status || 'new',
        source: data.source || 'Website',
        notes: data.notes ? String(data.notes).trim() : '',
        homeType: data.homeType || '',
        moveDate: data.moveDate || '',
        origin: data.origin ? String(data.origin).trim() : '',
        destination: data.destination ? String(data.destination).trim() : '',
        estimatedValue: data.estimatedValue != null ? Number(data.estimatedValue) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    leads.unshift(newLead);
    writeLeads(leads);
    return newLead;
}

function updateLead(id, userId, data) {
    const leads = readLeads();
    const idx = leads.findIndex((l) => l.id === id && l.userId === userId);
    if (idx === -1) return null;

    const updated = {
        ...leads[idx],
        name: data.name !== undefined ? String(data.name).trim() : leads[idx].name,
        email: data.email !== undefined ? String(data.email).trim() : leads[idx].email,
        phone: data.phone !== undefined ? String(data.phone).trim() : leads[idx].phone,
        status: data.status !== undefined ? data.status : leads[idx].status,
        source: data.source !== undefined ? data.source : leads[idx].source,
        notes: data.notes !== undefined ? String(data.notes).trim() : leads[idx].notes,
        homeType: data.homeType !== undefined ? data.homeType : leads[idx].homeType,
        moveDate: data.moveDate !== undefined ? data.moveDate : leads[idx].moveDate,
        origin: data.origin !== undefined ? String(data.origin).trim() : leads[idx].origin,
        destination: data.destination !== undefined ? String(data.destination).trim() : leads[idx].destination,
        estimatedValue: data.estimatedValue !== undefined ? (data.estimatedValue != null ? Number(data.estimatedValue) : null) : leads[idx].estimatedValue,
        updatedAt: new Date().toISOString(),
    };
    leads[idx] = updated;
    writeLeads(leads);
    return updated;
}

function deleteLead(id, userId) {
    const leads = readLeads();
    const idx = leads.findIndex((l) => l.id === id && l.userId === userId);
    if (idx === -1) return false;
    leads.splice(idx, 1);
    writeLeads(leads);
    return true;
}

module.exports = { validateLeadInput, getAllLeads, getLeadById, createLead, updateLead, deleteLead };
