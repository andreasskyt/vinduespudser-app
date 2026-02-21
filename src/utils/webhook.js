/**
 * Send webhook payload. Fire-and-forget – fejl logges, blokerer aldrig brugerflowet.
 */
async function sendWebhook(webhookUrl, payload) {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('Webhook fejl:', res.status, res.statusText);
    }
  } catch (err) {
    console.error('Webhook fejl:', err.message);
  }
}

module.exports = { sendWebhook };
