/**
 * notifications.js — In-app notification display
 */

/**
 * Show a toast notification
 * @param {string} type  - 'success' | 'warning' | 'error' | 'info'
 * @param {string} title
 * @param {string} message
 * @param {number} duration  - ms to auto-dismiss (0 = manual)
 */
function showNotification(type, title, message, duration) {
  const container = document.getElementById('notification-container');
  if (!container) return;

  const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
  duration = duration || 5000;

  const el = document.createElement('div');
  el.className = `notification ${type}`;
  el.innerHTML = `
    <div class="notification-icon">${icons[type] || 'ℹ️'}</div>
    <div class="notification-body">
      <div class="notification-title">${escHtml(title)}</div>
      ${message ? `<div class="notification-msg">${escHtml(message)}</div>` : ''}
    </div>
    <button class="notification-close" onclick="this.closest('.notification').remove()">×</button>
  `;

  container.appendChild(el);

  if (duration > 0) {
    setTimeout(() => {
      if (el.parentNode) {
        el.style.transition = 'opacity .3s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
      }
    }, duration);
  }
}

window.showNotification = showNotification;
