const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Send lead + tilbud til tenant via Resend.
 * @param {Object} opts - { to, subject, html, from? }
 */
async function sendLeadEmail(opts) {
  if (!resend) {
    console.warn('RESEND_API_KEY ikke sat – email sendes ikke');
    return { ok: false, error: 'Email ikke konfigureret' };
  }
  try {
    const from = opts.from || 'Vinduespudser App <onboarding@resend.dev>';
    const { data, error } = await resend.emails.send({
      from,
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

module.exports = { sendLeadEmail };
