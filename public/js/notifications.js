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

  // Build DOM nodes to avoid innerHTML XSS risk with user-supplied content
  const iconDiv = document.createElement('div');
  iconDiv.className = 'notification-icon';
  iconDiv.textContent = icons[type] || 'ℹ️';

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'notification-body';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'notification-title';
  titleDiv.textContent = title || '';
  bodyDiv.appendChild(titleDiv);

  if (message) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'notification-msg';
    msgDiv.textContent = message;
    bodyDiv.appendChild(msgDiv);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'notification-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => el.remove());

  el.appendChild(iconDiv);
  el.appendChild(bodyDiv);
  el.appendChild(closeBtn);
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
