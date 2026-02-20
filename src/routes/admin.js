const express = require('express');
const router = express.Router();
const { listTenants, createTenant, updateTenant, getTenantById } = require('../db/supabase');

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || token !== adminKey) {
    return res.status(401).json({ error: 'Uautoriseret' });
  }
  next();
}

router.use(requireAdmin);

/** Fallback så /admin ikke matcher quote-routerens :slug */
router.get('/', (req, res) => res.status(404).json({ error: 'Brug /admin/tenants' }));

/** GET /admin/tenants – liste over alle tenants */
router.get('/tenants', async (req, res, next) => {
  try {
    const tenants = await listTenants();
    res.json(tenants);
  } catch (err) {
    next(err);
  }
});

/** POST /admin/tenants – opret tenant */
router.post('/tenants', async (req, res, next) => {
  try {
    const { slug, name, contact_email, webhook_url, pricing, quote_template } = req.body || {};
    if (!slug?.trim() || !name?.trim() || !contact_email?.trim()) {
      return res.status(400).json({
        error: 'Manglende felter: slug, name og contact_email er påkrævet',
      });
    }
    if (!pricing || typeof pricing !== 'object') {
      return res.status(400).json({ error: 'pricing skal være et objekt' });
    }
    if (!quote_template || typeof quote_template !== 'string') {
      return res.status(400).json({ error: 'quote_template skal være en streng' });
    }

    const defaultPricing = {
      min_price: 399,
      price_per_window: 45,
      top_window_surcharge: 80,
      second_floor_surcharge_pct: 0.15,
      frequency_discounts: { one_time: 0, quarterly: 0.05, monthly: 0.1 },
    };

    const tenant = await createTenant({
      slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
      name: name.trim(),
      contact_email: contact_email.trim(),
      webhook_url: webhook_url?.trim() || null,
      pricing: { ...defaultPricing, ...pricing },
      quote_template: quote_template.trim(),
      active: true,
    });
    res.status(201).json(tenant);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug findes allerede' });
    }
    next(err);
  }
});

/** PATCH /admin/tenants/:id – opdater tenant */
router.patch('/tenants/:id', async (req, res, next) => {
  try {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant findes ikke' });
    }

    const allowed = ['name', 'contact_email', 'webhook_url', 'pricing', 'quote_template', 'active', 'slug'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Ingen gyldige opdateringer' });
    }
    if (updates.pricing && typeof updates.pricing !== 'object') {
      delete updates.pricing;
    }

    const updated = await updateTenant(req.params.id, updates);
    res.json(updated);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug findes allerede' });
    }
    next(err);
  }
});

module.exports = router;
