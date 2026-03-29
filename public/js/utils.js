/**
 * utils.js — Shared utility functions loaded before all other modules
 */

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function formatDatetime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' ' +
           d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
  } catch { return iso; }
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d - now;
    if (diffMs < 0) return 'Overdue';
    const diffH = Math.floor(diffMs / 3600000);
    const diffM = Math.floor((diffMs % 3600000) / 60000);
    if (diffH > 0) return `in ${diffH}h ${diffM}m`;
    return `in ${diffM}m`;
  } catch { return '—'; }
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('crm_user')); }
  catch { return null; }
}

window.escHtml = escHtml;
window.formatDatetime = formatDatetime;
window.formatTime = formatTime;
window.getCurrentUser = getCurrentUser;
