/**
 * Fjerner tomme komma-delte dele fra adresse (f.eks. "Åhusene 7, , 8000 Aarhus C" → "Åhusene 7, 8000 Aarhus C").
 */
function normalizeAddress(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Erstatter {{placeholders}} i en template-streng.
 * Bruger-input (customer_name, address) escapes for XSS.
 * @param {string} template - Template med {{placeholder}} syntaks
 * @param {Object} data - Objekt med nøgle-værdi par
 * @returns {string} Renderet streng
 */
function renderTemplate(template, data) {
  if (!template || typeof template !== 'string') return '';
  const userFields = ['customer_name', 'address'];
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = data[key] != null ? String(data[key]) : '';
    return userFields.includes(key) ? escapeHtml(val) : val;
  });
}

module.exports = { renderTemplate, normalizeAddress };
