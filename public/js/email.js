/**
 * email.js — Email template management, auto-send logic, email tracking
 */

const EMAIL_TEMPLATES_KEY = 'crm_email_templates';
const EMAIL_LOG_KEY        = 'crm_email_log';

// ── Default templates ────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_no_answer',
    name: 'Follow-Up (No Answer)',
    subject: 'We tried to reach you — {lead_name}',
    body: `Hi {lead_name},

We tried to contact you today but weren't able to reach you.

We'd love to help you find the perfect manufactured home! Please give us a call back at your earliest convenience, or reply to this email and we'll arrange a time that works best for you.

Best regards,
{company}
{phone}`,
    triggerOn: 'no_answer',
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tpl_active',
    name: 'Welcome — Active Lead',
    subject: "Welcome! We're ready to help — {company}",
    body: `Hi {lead_name},

Thank you for your interest in our manufactured homes!

We're excited to work with you and help you find your dream home. One of our team members will be in touch shortly to discuss your needs and answer any questions you may have.

Feel free to contact us anytime:
📞 {phone}
📧 {email}

Warm regards,
{company}`,
    triggerOn: 'active',
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
];

// ── CRUD ────────────────────────────────────────────────────────────────────

function getEmailTemplates() {
  try {
    const stored = JSON.parse(localStorage.getItem(EMAIL_TEMPLATES_KEY));
    if (!stored || stored.length === 0) {
      localStorage.setItem(EMAIL_TEMPLATES_KEY, JSON.stringify(DEFAULT_TEMPLATES));
      return DEFAULT_TEMPLATES;
    }
    return stored;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

function getEmailTemplateById(id) {
  return getEmailTemplates().find(t => t.id === id) || null;
}

function saveEmailTemplate(template) {
  const templates = getEmailTemplates();
  const idx = templates.findIndex(t => t.id === template.id);
  if (idx >= 0) templates[idx] = template; else templates.push(template);
  localStorage.setItem(EMAIL_TEMPLATES_KEY, JSON.stringify(templates));
  return template;
}

function deleteEmailTemplate(id) {
  const templates = getEmailTemplates().filter(t => t.id !== id);
  localStorage.setItem(EMAIL_TEMPLATES_KEY, JSON.stringify(templates));
}

function createEmailTemplate(data) {
  const tpl = {
    id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    name: data.name || 'Untitled Template',
    subject: data.subject || '',
    body: data.body || '',
    triggerOn: data.triggerOn || '',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };
  saveEmailTemplate(tpl);
  return tpl;
}

// ── Variable interpolation ───────────────────────────────────────────────────

function interpolate(text, lead) {
  return text
    .replace(/\{lead_name\}/g, lead.name || '')
    .replace(/\{company\}/g, lead.company || 'Our Company')
    .replace(/\{phone\}/g, lead.phone || '')
    .replace(/\{email\}/g, lead.email || '');
}

// ── Email Log ────────────────────────────────────────────────────────────────

function getEmailLog() {
  try { return JSON.parse(localStorage.getItem(EMAIL_LOG_KEY)) || []; }
  catch { return []; }
}

function getEmailLogForLead(leadId) {
  return getEmailLog().filter(e => e.leadId === leadId);
}

function logEmail(leadId, templateId, templateName, subject, status) {
  try {
    const log = getEmailLog();
    log.push({
      id: 'email_' + Date.now(),
      leadId,
      templateId,
      templateName,
      subject,
      status: status || 'sent',
      sentAt: new Date().toISOString(),
    });
    if (log.length > 1000) log.splice(0, log.length - 1000);
    localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify(log));
  } catch {}
}

// ── Auto-send on lead events ─────────────────────────────────────────────────

/**
 * Called after a lead is created/updated.
 * Finds matching default template and "sends" (simulates) the email.
 */
function autoSendEmail(lead, triggerEvent) {
  const templates = getEmailTemplates().filter(t => t.triggerOn === triggerEvent);
  templates.forEach(tpl => {
    const subject = interpolate(tpl.subject, lead);
    const body    = interpolate(tpl.body, lead);
    // In a real app this would call an email API.
    // Here we log it and show a notification.
    logEmail(lead.id, tpl.id, tpl.name, subject, 'sent');
    logActivity(lead.id, 'email', `Auto-email sent: "${subject}" (template: ${tpl.name})`);
    showNotification('info', '📧 Email Sent', `"${subject}" sent to ${lead.email || lead.name}`, 5000);
  });
}

/**
 * Manually send an email to a lead using a template
 */
function sendEmailToLead(leadId, templateId) {
  const lead = getLeadById(leadId);
  const tpl  = getEmailTemplateById(templateId);
  if (!lead || !tpl) {
    showNotification('error', 'Error', 'Lead or template not found');
    return;
  }
  const subject = interpolate(tpl.subject, lead);
  logEmail(lead.id, tpl.id, tpl.name, subject, 'sent');
  logActivity(lead.id, 'email', `Manual email sent: "${subject}"`);
  showNotification('success', '📧 Email Sent', `"${subject}" sent to ${lead.email || lead.name}`, 5000);
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderEmailTemplateCards(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const templates = getEmailTemplates();

  if (templates.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📧</div><h3>No templates</h3><p>Create your first email template.</p></div>`;
    return;
  }

  container.innerHTML = templates.map(tpl => {
    const triggerBadge = tpl.triggerOn
      ? `<span class="badge ${tpl.triggerOn === 'no_answer' ? 'badge-red' : tpl.triggerOn === 'active' ? 'badge-green' : 'badge-gray'}">
           Auto: ${tpl.triggerOn === 'no_answer' ? 'No Answer' : tpl.triggerOn === 'active' ? 'Active' : tpl.triggerOn}
         </span>`
      : '<span class="badge badge-gray">Manual</span>';
    const isDefault = tpl.isDefault ? '<span class="badge badge-blue">Default</span>' : '';
    return `<div class="template-card">
      <div class="flex items-center justify-between">
        <div class="template-name">${escHtml(tpl.name)}</div>
        <div class="flex gap-1">${triggerBadge} ${isDefault}</div>
      </div>
      <div class="text-xs text-muted mt-1">Subject: ${escHtml(tpl.subject)}</div>
      <div class="template-preview">${escHtml(tpl.body.slice(0,180))}${tpl.body.length > 180 ? '…' : ''}</div>
      <div class="template-actions">
        <button class="btn btn-outline btn-sm" onclick="openTemplateModal('${tpl.id}')">✏️ Edit</button>
        <button class="btn btn-outline btn-sm" onclick="previewTemplate('${tpl.id}')">👁️ Preview</button>
        ${!tpl.isDefault ? `<button class="btn btn-outline btn-sm text-danger" onclick="confirmDeleteTemplate('${tpl.id}')">🗑️ Delete</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderEmailLog(leadId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const log = leadId ? getEmailLogForLead(leadId) : getEmailLog();
  log.sort((a,b) => new Date(b.sentAt) - new Date(a.sentAt));

  if (log.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:24px"><div class="empty-icon" style="font-size:24px">📭</div><p>No emails sent yet.</p></div>`;
    return;
  }

  container.innerHTML = log.slice(0,50).map(e => `
    <div class="email-log-item">
      <span>📧</span>
      <div style="flex:1">
        <div class="font-medium">${escHtml(e.subject)}</div>
        <div class="text-xs text-muted">${escHtml(e.templateName)} · ${formatDatetime(e.sentAt)}</div>
      </div>
      <span class="badge badge-green">Sent</span>
    </div>`).join('');
}

// Expose to global
window.getEmailTemplates = getEmailTemplates;
window.getEmailTemplateById = getEmailTemplateById;
window.saveEmailTemplate = saveEmailTemplate;
window.deleteEmailTemplate = deleteEmailTemplate;
window.createEmailTemplate = createEmailTemplate;
window.interpolate = interpolate;
window.getEmailLog = getEmailLog;
window.getEmailLogForLead = getEmailLogForLead;
window.logEmail = logEmail;
window.autoSendEmail = autoSendEmail;
window.sendEmailToLead = sendEmailToLead;
window.renderEmailTemplateCards = renderEmailTemplateCards;
window.renderEmailLog = renderEmailLog;
