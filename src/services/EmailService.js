const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const DEFAULT_FROM = 'Vinduespudser App <onboarding@resend.dev>';

/**
 * Generér HTML-email til kunden med tilbudsoversigt.
 */
function buildCustomerQuoteHtml({ tenant, lead, quote, address, frequencyLabel }) {
  const services = tenant.pricing?.services || {};
  const selectedKeys = Object.keys(quote.selected_services || {});
  const servicesList = selectedKeys
    .map((key) => (services[key]?.label || key) + (quote.selected_services[key]?.count ? ` (${quote.selected_services[key].count} stk)` : ''))
    .join('</li><li>');

  const basePrice = quote.base_price ?? 0;
  const surcharges = quote.total_surcharges ?? 0;
  const discount = quote.frequency_discount ?? 0;
  const subtotal = basePrice + surcharges;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.5;color:#334155;background:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px;">
  <tr><td style="padding:24px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:600;color:#0f172a;">${escapeHtml(tenant.name)}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">Din prisoversigt</p>

    <p style="margin:0 0 16px 0;">Kære ${escapeHtml(lead.name)},</p>
    <p style="margin:0 0 24px 0;">Tak for din henvendelse. Her er dit tilbud fra ${escapeHtml(tenant.name)}.</p>

    <table style="width:100%;border-collapse:collapse;margin:0 0 24px 0;">
      <tr><td style="padding:12px;background:#f1f5f9;border-radius:8px;">
        <p style="margin:0 0 4px 0;font-size:14px;color:#64748b;">Adresse</p>
        <p style="margin:0;font-weight:500;">${escapeHtml(address)}</p>
      </td></tr>
    </table>

    ${servicesList ? `<p style="margin:0 0 4px 0;font-size:14px;color:#64748b;">Valgte services</p><ul style="margin:0 0 24px 0;padding-left:20px;"><li>${servicesList}</li></ul>` : ''}

    <p style="margin:0 0 4px 0;"><strong>Antal vinduer:</strong> ${quote.window_count ?? quote.estimated_windows ?? 0}</p>
    <p style="margin:0 0 16px 0;"><strong>Frekvens:</strong> ${escapeHtml(frequencyLabel)}</p>

    <table style="width:100%;border-collapse:collapse;margin:0 0 24px 0;font-size:15px;">
      <tr><td style="padding:8px 0;">Basispris</td><td style="text-align:right;">${basePrice} kr.</td></tr>
      ${surcharges > 0 ? `<tr><td style="padding:8px 0;">Tillæg</td><td style="text-align:right;">${surcharges} kr.</td></tr>` : ''}
      ${discount > 0 ? `<tr><td style="padding:8px 0;">Rabat</td><td style="text-align:right;color:#16a34a;">-${discount} kr.</td></tr>` : ''}
      <tr style="border-top:1px solid #e2e8f0;"><td style="padding:12px 0;font-weight:600;font-size:18px;">Total</td><td style="text-align:right;font-weight:600;font-size:18px;">${quote.final_price} kr.</td></tr>
    </table>

    <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">Tilbuddet er uforpligtende og gælder i 14 dage.</p>

    <p style="margin:0;">Med venlig hilsen,<br><strong>${escapeHtml(tenant.name)}</strong></p>
  </td></tr>
</table>
</body>
</html>
  `.trim();
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send tilbudsemail til kunden. Fire-and-forget – fejl logges, blokerer ikke brugerflow.
 */
async function sendQuoteToCustomer({ tenant, lead, quote, address, frequencyLabel }) {
  if (!resend) {
    console.warn('RESEND_API_KEY ikke sat – kunde-email sendes ikke');
    return { ok: false };
  }
  try {
    const html = buildCustomerQuoteHtml({ tenant, lead, quote, address, frequencyLabel });
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: lead.email,
      subject: `Dit tilbud fra ${tenant.name}`,
      html,
    });
    if (error) {
      console.error('Kunde-email fejl:', error);
      return { ok: false };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('Send kunde-email fejl:', err.message);
    return { ok: false };
  }
}

/**
 * Send lead + fuldt tilbud til firma via Resend.
 */
async function sendQuoteToFirm({ tenant, lead, quote, address, frequencyLabel, renderedQuote }) {
  if (!resend) {
    console.warn('RESEND_API_KEY ikke sat – firma-email sendes ikke');
    return { ok: false };
  }
  const services = tenant.pricing?.services || {};
  const selectedKeys = Object.keys(quote.selected_services || {});
  const servicesList = selectedKeys.map((k) => (services[k]?.label || k)).join(', ') || '–';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.5;color:#334155;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px;">
  <tr><td>
    <h2 style="margin:0 0 16px 0;font-size:20px;">Nyt tilbud / lead</h2>

    <h3 style="margin:24px 0 8px 0;font-size:16px;">Kunde</h3>
    <p style="margin:0 0 4px 0;"><strong>Navn:</strong> ${escapeHtml(lead.name)}</p>
    <p style="margin:0 0 4px 0;"><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
    <p style="margin:0 0 16px 0;"><strong>Telefon:</strong> ${escapeHtml(lead.phone)}</p>

    <h3 style="margin:24px 0 8px 0;font-size:16px;">Adresse</h3>
    <p style="margin:0 0 16px 0;">${escapeHtml(address)}</p>

    <h3 style="margin:24px 0 8px 0;font-size:16px;">Tilbud</h3>
    <p style="margin:0 0 4px 0;"><strong>Antal vinduer:</strong> ${quote.window_count ?? quote.estimated_windows ?? 0}</p>
    <p style="margin:0 0 4px 0;"><strong>Valgte services:</strong> ${escapeHtml(servicesList)}</p>
    <p style="margin:0 0 4px 0;"><strong>Frekvens:</strong> ${escapeHtml(frequencyLabel)}</p>
    <p style="margin:0 0 4px 0;"><strong>Basispris:</strong> ${quote.base_price ?? 0} kr.</p>
    <p style="margin:0 0 4px 0;"><strong>Tillæg:</strong> ${quote.total_surcharges ?? 0} kr.</p>
    <p style="margin:0 0 4px 0;"><strong>Rabat:</strong> -${quote.frequency_discount ?? 0} kr.</p>
    <p style="margin:0 0 16px 0;"><strong>Total:</strong> ${quote.final_price} kr.</p>

    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
    <div style="white-space:pre-wrap;">${(renderedQuote || '').replace(/\n/g, '<br>')}</div>
  </td></tr>
</table>
</body>
</html>
  `.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: tenant.contact_email,
      subject: `Nyt tilbud fra ${lead.name} – ${address}`,
      html,
    });
    if (error) {
      console.error('Firma-email fejl:', error);
      return { ok: false };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('Send firma-email fejl:', err.message);
    return { ok: false };
  }
}

/**
 * Send lead-email til firma (backwards compatible wrapper).
 * @deprecated Brug sendQuoteToFirm i stedet
 */
async function sendLeadEmail(opts) {
  if (!resend) {
    console.warn('RESEND_API_KEY ikke sat – email sendes ikke');
    return { ok: false, error: 'Email ikke konfigureret' };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: opts.from || DEFAULT_FROM,
      to: opts.to,
      subject: opts.subject || 'Nyt tilbud / lead',
      html: opts.html,
    });
    if (error) {
      console.error('Resend fejl:', error);
      return { ok: false, error };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error('Send email fejl:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendQuoteToCustomer, sendQuoteToFirm, sendLeadEmail };
