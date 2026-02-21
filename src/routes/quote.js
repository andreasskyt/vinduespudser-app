const express = require('express');
const router = express.Router();
const { getTenantBySlug, createLead, createQuote } = require('../db/supabase');
const { getPropertyData } = require('../services/PropertyDataService');
const { assembleQuote } = require('../services/QuoteService');
const { renderTemplate, normalizeAddress } = require('../utils/templateRenderer');
const { sendQuoteToCustomer, sendQuoteToFirm } = require('../services/EmailService');
const { sendWebhook } = require('../utils/webhook');
const { getDistanceKm } = require('../utils/geoDistance');
const { getAddressSuggestions } = require('../services/PropertyDataService');

/** GET /api/address-suggestions?q=xxx – DAWA autocomplete proxy (undgår CORS) */
router.get('/api/address-suggestions', async (req, res, next) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 3) {
      return res.json([]);
    }
    const items = await getAddressSuggestions(q);
    if (items.length === 0) {
      return res.json([]);
    }
    res.json(items.map((item) => ({ type: 'adgangsadresse', data: { id: item.id }, tekst: item.tekst, forslagstekst: item.tekst })));
  } catch (err) {
    next(err);
  }
});

/** GET /api/property-data?addressId=xxx – hent BBR-ejendomsdata (AJAX) */
router.get('/api/property-data', async (req, res, next) => {
  try {
    const addressId = req.query.addressId?.trim();
    if (!addressId) {
      return res.status(400).json({ error: 'Manglende addressId' });
    }
    const result = await getPropertyData(addressId);
    if (!result) {
      return res.json({ normalized: null, rawBBR: null });
    }
    res.json({ normalized: result.normalized, rawBBR: result.rawBBR });
  } catch (err) {
    next(err);
  }
});

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

    const {
      name,
      email,
      phone,
      address_raw,
      dawa_address_id,
      frequency,
      window_count: windowCountRaw,
      tagvinduer_count,
    } = req.body || {};

    let selected_services = req.body.selected_services;
    if (typeof selected_services === 'string') selected_services = [selected_services];
    if (!Array.isArray(selected_services)) selected_services = [];

    const freq = ['one_time', 'quarterly', 'monthly'].includes(frequency) ? frequency : 'one_time';

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
      propertyData = { buildingType: 'parcelhus', areaM2: 100, floors: 1, builtYear: null };
    }

    if (tenant.service_area?.radius_km && propertyData?.coordinates) {
      const { center_lat, center_lng, radius_km } = tenant.service_area;
      const { lat, lng } = propertyData.coordinates;
      if (
        center_lat != null &&
        center_lng != null &&
        lat != null &&
        lng != null
      ) {
        const distance = getDistanceKm(center_lat, center_lng, lat, lng);
        if (distance > radius_km) {
          return res.status(400).render('error', {
            title: 'Uden for serviceområde',
            message: `${tenant.name} tilbyder desværre kun vinduespudsning inden for ${radius_km} km fra ${tenant.service_area.center_address || 'deres base'}. Din adresse er ca. ${Math.round(distance)} km væk.`,
          });
        }
      }
    }

    const windowCount =
      windowCountRaw != null && windowCountRaw !== ''
        ? Math.min(30, Math.max(1, parseInt(windowCountRaw, 10) || 1))
        : null;

    const selectedServicesObj = {};
    for (const key of selected_services) {
      if (key === 'tagvinduer') {
        selectedServicesObj[key] = { count: Math.min(10, Math.max(0, parseInt(tagvinduer_count, 10) || 0)) };
      } else {
        selectedServicesObj[key] = {};
      }
    }

    const assembled = assembleQuote({
      propertyData,
      pricingConfig: tenant.pricing,
      tenant,
      frequency: freq,
      selectedServices: selectedServicesObj,
      windowCount,
    });

    const {
      final_price,
      estimated_windows,
      base_price,
      total_surcharges,
      frequency_discount,
      quote_html,
      pricing_snapshot,
      templateData,
    } = assembled;

    const addressClean = normalizeAddress(address_raw.trim());
    const templateDataFull = {
      ...templateData,
      customer_name: name.trim(),
      address: addressClean,
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
      window_count: windowCount ?? estimated_windows,
      selected_services: selectedServicesObj,
      frequency: freq,
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
      address: addressClean,
    };

    const leadObj = { id: lead.id, name: name.trim(), email: email.trim(), phone: phone.trim() };
    const quoteForEmail = {
      window_count: windowCount ?? estimated_windows,
      estimated_windows,
      selected_services: selectedServicesObj,
      base_price: base_price ?? 0,
      total_surcharges: total_surcharges ?? 0,
      frequency_discount: frequency_discount ?? 0,
      final_price,
    };

    sendQuoteToCustomer({
      tenant,
      lead: leadObj,
      quote: quoteForEmail,
      address: addressClean,
      frequencyLabel: templateDataFull.frequency,
    }).catch((err) => console.error('Kunde-email fejl:', err.message));

    sendQuoteToFirm({
      tenant,
      lead: leadObj,
      quote: quoteForEmail,
      address: addressClean,
      frequencyLabel: templateDataFull.frequency,
      renderedQuote,
    }).catch((err) => console.error('Firma-email fejl:', err.message));

    if (tenant.webhook_url) {
      const webhookPayload = {
        event: 'new_quote',
        timestamp: new Date().toISOString(),
        tenant_slug: req.params.slug,
        customer: {
          name: leadObj.name,
          email: leadObj.email,
          phone: leadObj.phone,
        },
        property: {
          address: addressClean,
          building_type: propertyData?.buildingType ?? null,
          area_m2: propertyData?.areaM2 ?? null,
          floors: propertyData?.floors ?? null,
        },
        quote: {
          window_count: quoteForEmail.window_count,
          selected_services: selected_services,
          frequency: freq,
          base_price: quoteForEmail.base_price,
          total_surcharges: quoteForEmail.total_surcharges,
          frequency_discount: quoteForEmail.frequency_discount,
          final_price: quoteForEmail.final_price,
        },
      };
      sendWebhook(tenant.webhook_url, webhookPayload).catch((err) => console.error('Webhook fejl:', err.message));
    }

    res.render('quote-result', quoteResultView);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
