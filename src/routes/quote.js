const express = require('express');
const router = express.Router();
const { getTenantBySlug, createLead, createQuote } = require('../db/supabase');
const { getPropertyData } = require('../services/PropertyDataService');
const { assembleQuote } = require('../services/QuoteService');
const { renderTemplate } = require('../utils/templateRenderer');
const { sendLeadEmail } = require('../services/EmailService');

/** GET /:slug – vis tilbudsformular */
router.get('/:slug', async (req, res, next) => {
  try {
    const tenant = await getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).render('error', {
        title: 'Siden findes ikke',
        message: 'Vi kunne ikke finde denne side.',
      });
    }
    res.render('quote-form', {
      tenant,
      slug: req.params.slug,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /:slug/submit – indsend formular og vis tilbud */
router.post('/:slug/submit', async (req, res, next) => {
  try {
    const tenant = await getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).render('error', {
        title: 'Siden findes ikke',
        message: 'Vi kunne ikke finde denne side.',
      });
    }

    const { name, email, phone, address_raw, dawa_address_id, frequency } = req.body || {};
    const freq = ['one_time', 'quarterly', 'monthly'].includes(frequency) ? frequency : 'one_time';

    // Validering
    if (!name?.trim() || !email?.trim() || !phone?.trim() || !address_raw?.trim()) {
      return res.status(400).render('quote-form', {
        tenant,
        slug: req.params.slug,
        error: 'Udfyld venligst navn, email, telefon og adresse.',
        formData: req.body,
      });
    }

    let propertyData = null;
    let bbrData = null;

    if (dawa_address_id?.trim()) {
      try {
        const result = await getPropertyData(dawa_address_id);
        if (result) {
          propertyData = result.normalized;
          bbrData = result.rawBBR;
        }
      } catch (e) {
        console.warn('Ejendomsdata hent fejlede:', e.message);
      }
    }

    if (!propertyData) {
      propertyData = { buildingType: 'villa', areaM2: 100, floors: 1, builtYear: null };
    }

    const assembled = assembleQuote(propertyData, tenant.pricing, tenant, freq);
    const { final_price, estimated_windows, quote_html, pricing_snapshot, templateData } = assembled;

    const templateDataFull = {
      ...templateData,
      customer_name: name.trim(),
      address: address_raw.trim(),
    };
    const renderedQuote = renderTemplate(tenant.quote_template, templateDataFull);

    const lead = await createLead({
      tenant_id: tenant.id,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address_raw: address_raw.trim(),
      dawa_address_id: dawa_address_id?.trim() || null,
      bbr_data: bbrData,
    });

    await createQuote({
      lead_id: lead.id,
      tenant_id: tenant.id,
      pricing_snapshot,
      calculated_price: final_price,
      window_count_estimated: estimated_windows,
      quote_html: renderedQuote,
    });

    const quoteResultView = {
      tenant,
      quote: {
        final_price,
        estimated_windows,
        frequency: templateDataFull.frequency,
        rendered: renderedQuote,
      },
      customer_name: name.trim(),
      address: address_raw.trim(),
    };

    // Send email til tenant
    const emailHtml = `
      <h2>Nyt tilbud / lead</h2>
      <p><strong>Navn:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Telefon:</strong> ${phone}</p>
      <p><strong>Adresse:</strong> ${address_raw}</p>
      <p><strong>Estimeret antal vinduer:</strong> ${estimated_windows}</p>
      <p><strong>Pris:</strong> ${final_price} kr.</p>
      <p><strong>Frekvens:</strong> ${templateDataFull.frequency}</p>
      <hr>
      <div>${renderedQuote.replace(/\n/g, '<br>')}</div>
    `;
    await sendLeadEmail({
      to: tenant.contact_email,
      subject: `Nyt tilbud fra ${name} – ${address_raw}`,
      html: emailHtml,
    });

    // Webhook hvis konfigureret
    if (tenant.webhook_url) {
      try {
        await fetch(tenant.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead: { id: lead.id, name, email, phone, address_raw, dawa_address_id },
            quote: { final_price, estimated_windows, quote_html: renderedQuote },
          }),
        });
      } catch (e) {
        console.warn('Webhook fejl:', e.message);
      }
    }

    res.render('quote-result', quoteResultView);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
