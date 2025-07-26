/**
 * HTML Escape Utilities
 * Prevents XSS attacks by escaping HTML special characters
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  
  const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  
  return String(str).replace(/[&<>"'\/]/g, char => htmlEscapeMap[char]);
}

/**
 * Escape an object's string values for HTML
 * @param {Object} obj - Object with values to escape
 * @returns {Object} - New object with escaped values
 */
function escapeHtmlObject(obj) {
  const escaped = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      escaped[key] = escapeHtml(value);
    } else {
      escaped[key] = value;
    }
  }
  
  return escaped;
}

module.exports = {
  escapeHtml,
  escapeHtmlObject
};