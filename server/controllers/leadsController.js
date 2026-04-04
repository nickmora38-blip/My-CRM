const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../data/leads.json');

// Serial write queue — prevents lost-update races if the server ever uses
// async I/O or handles overlapping requests that both read-modify-write.
let writeQueue = Promise.resolve();

function readLeads() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, '[]');
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
}

function writeLeads(leads) {
    // Enqueue every write so they execute strictly one-at-a-time.
    writeQueue = writeQueue.then(() => {
        fs.writeFileSync(DB_PATH, JSON.stringify(leads, null, 2));
    });
    return writeQueue;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'];
const VALID_SOURCES  = ['Website', 'Referral', 'Social Media', 'Google Ads', 'Cold Call', 'Other'];
const VALID_HOME_TYPES = ['Single Wide', 'Double Wide', 'Triple Wide', 'Park Model'];

function validateLeadInput(data) {
    // Name (required)
    if (!data.name || String(data.name).trim().length < 1) {
        return 'Lead name is required';
    }
    if (String(data.name).trim().length > 120) {
        return 'Lead name must be 120 characters or fewer';
    }

    // Email format (optional but validated when provided)
    if (data.email && data.email.trim() !== '') {
        // The local-part uses [^\s@]+ (fine) and the domain part uses [^\s@.]+
        // separated by literal dots to avoid polynomial backtracking.
        const emailRegex = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
        if (!emailRegex.test(String(data.email).trim())) {
            return 'Please provide a valid email address';
        }
    }

    // Phone format — digits, spaces, dashes, parens, plus sign (optional)
    if (data.phone && data.phone.trim() !== '') {
        const phoneRegex = /^[+]?[\d\s\-().]{7,20}$/;
        if (!phoneRegex.test(String(data.phone).trim())) {
            return 'Please provide a valid phone number (7-20 digits/dashes/spaces)';
        }
    }

    // Status enum
    if (data.status !== undefined && !VALID_STATUSES.includes(data.status)) {
        return `Status must be one of: ${VALID_STATUSES.join(', ')}`;
    }

    // Source enum
    if (data.source !== undefined && data.source !== '' && !VALID_SOURCES.includes(data.source)) {
        return `Source must be one of: ${VALID_SOURCES.join(', ')}`;
    }

    // Home type enum
    if (data.homeType !== undefined && data.homeType !== '' && !VALID_HOME_TYPES.includes(data.homeType)) {
        return `Home type must be one of: ${VALID_HOME_TYPES.join(', ')}`;
    }

    // Estimated value range
    if (data.estimatedValue != null && data.estimatedValue !== '') {
        const val = Number(data.estimatedValue);
        if (isNaN(val) || val < 0) {
            return 'Estimated value must be a non-negative number';
        }
        if (val > 10_000_000) {
            return 'Estimated value cannot exceed $10,000,000';
        }
    }

    return null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

function getAllLeads(userId) {
    const leads = readLeads();
    return leads.filter((l) => l.userId === userId);
}

function getLeadById(id, userId) {
    const leads = readLeads();
    return leads.find((l) => l.id === id && l.userId === userId) || null;
}

/**
 * Returns leads that have been idle in an early pipeline stage for too long.
 * 'new' for > 7 days, 'contacted' for > 14 days.
 */
function getStaleLeads(userId) {
    const leads = readLeads();
    const now = Date.now();
    const DAY = 86_400_000;
    return leads.filter((l) => {
        if (l.userId !== userId) return false;
        const lastActivity = new Date(l.updatedAt || l.createdAt).getTime();
        const age = now - lastActivity;
        if (l.status === 'new' && age > 7 * DAY) return true;
        if (l.status === 'contacted' && age > 14 * DAY) return true;
        return false;
    });
}

/**
 * Scheduled job: mark leads that have become stale with `stale: true`.
 * Clears the flag when a lead is no longer stale.
 */
async function flagStaleLeads() {
    const leads = readLeads();
    const now = Date.now();
    const DAY = 86_400_000;
    let changed = false;
    for (const lead of leads) {
        const lastActivity = new Date(lead.updatedAt || lead.createdAt).getTime();
        const age = now - lastActivity;
        const isStale =
            (lead.status === 'new' && age > 7 * DAY) ||
            (lead.status === 'contacted' && age > 14 * DAY);
        if (isStale !== Boolean(lead.stale)) {
            lead.stale = isStale;
            changed = true;
        }
    }
    if (changed) {
        await writeLeads(leads);
    }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

async function createLead(userId, data) {
    const leads = readLeads();

    // Duplicate detection — block the same email or phone within the user's own leads
    const email = data.email ? String(data.email).trim().toLowerCase() : '';
    const phone = data.phone ? String(data.phone).trim().replace(/\s/g, '') : '';
    if (email) {
        const dup = leads.find(
            (l) => l.userId === userId && l.email && l.email.toLowerCase() === email
        );
        if (dup) {
            throw Object.assign(new Error(`A lead with email "${data.email}" already exists`), { statusCode: 409 });
        }
    }
    if (phone) {
        // Normalize once here; stored phones are already normalized on write
        const normalizedPhone = phone.replace(/\s/g, '');
        const dup = leads.find(
            (l) => l.userId === userId && l.phone && l.phone === normalizedPhone
        );
        if (dup) {
            throw Object.assign(new Error(`A lead with phone "${data.phone}" already exists`), { statusCode: 409 });
        }
    }

    const newLead = {
        id: crypto.randomUUID(),
        userId,
        name: String(data.name).trim(),
        email: email,
        phone: phone,
        status: data.status || 'new',
        source: data.source || 'Website',
        notes: data.notes ? String(data.notes).trim() : '',
        homeType: data.homeType || '',
        moveDate: data.moveDate || '',
        origin: data.origin ? String(data.origin).trim() : '',
        destination: data.destination ? String(data.destination).trim() : '',
        estimatedValue: data.estimatedValue != null && data.estimatedValue !== '' ? Number(data.estimatedValue) : null,
        stale: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    leads.unshift(newLead);
    await writeLeads(leads);
    return newLead;
}

async function updateLead(id, userId, data) {
    const leads = readLeads();
    const idx = leads.findIndex((l) => l.id === id && l.userId === userId);
    if (idx === -1) return null;

    const updated = {
        ...leads[idx],
        name: data.name !== undefined ? String(data.name).trim() : leads[idx].name,
        email: data.email !== undefined ? String(data.email).trim().toLowerCase() : leads[idx].email,
        phone: data.phone !== undefined ? String(data.phone).trim().replace(/\s/g, '') : leads[idx].phone,
        status: data.status !== undefined ? data.status : leads[idx].status,
        source: data.source !== undefined ? data.source : leads[idx].source,
        notes: data.notes !== undefined ? String(data.notes).trim() : leads[idx].notes,
        homeType: data.homeType !== undefined ? data.homeType : leads[idx].homeType,
        moveDate: data.moveDate !== undefined ? data.moveDate : leads[idx].moveDate,
        origin: data.origin !== undefined ? String(data.origin).trim() : leads[idx].origin,
        destination: data.destination !== undefined ? String(data.destination).trim() : leads[idx].destination,
        estimatedValue: data.estimatedValue !== undefined
            ? (data.estimatedValue != null && data.estimatedValue !== '' ? Number(data.estimatedValue) : null)
            : leads[idx].estimatedValue,
        stale: false,  // any update clears the stale flag
        updatedAt: new Date().toISOString(),
    };
    leads[idx] = updated;
    await writeLeads(leads);
    return updated;
}

async function deleteLead(id, userId) {
    const leads = readLeads();
    const idx = leads.findIndex((l) => l.id === id && l.userId === userId);
    if (idx === -1) return false;
    leads.splice(idx, 1);
    await writeLeads(leads);
    return true;
}

module.exports = {
    validateLeadInput,
    getAllLeads,
    getLeadById,
    getStaleLeads,
    flagStaleLeads,
    createLead,
    updateLead,
    deleteLead,
};
