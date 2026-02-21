/**
 * Prisberegning baseret på ejendomsdata, tenant prisconfig og valgte services.
 */

/*
 * EKSEMPEL PÅ PRISCONFIG (gemmes i tenants.pricing i Supabase):
 *
 * {
 *   "min_price": 399,              // Mindstepris i kr. – tilbuddet kan aldrig gå under dette
 *   "price_per_window": 45,        // Kr. per vindue
 *   "second_floor_surcharge_pct": 0.15,  // 15% tillæg på basisprisen ved 2+ etager
 *   "frequency_discounts": {
 *     "one_time": 0.00,            // Ingen rabat ved enkeltbesøg
 *     "quarterly": 0.05,           // 5% rabat ved aftale om vask hver 3. måned
 *     "monthly": 0.10              // 10% rabat ved månedlig aftale
 *   },
 *   "services": {
 *     "udvendig": { "included": true, "label": "Udvendig vinduesvask", "default_selected": true, "surcharge_flat": 0 },
 *     "indvendig": { "included": true, "label": "Indvendig vinduesvask", "surcharge_pct": 0.50 },
 *     "karme": { "included": true, "label": "Karme og rammer", "surcharge_per_window": 8 },
 *     "tagvinduer": { "included": true, "label": "Ovenlysvinduer/tagvinduer", "surcharge_each": 80, "requires_count": true },
 *     ...
 *   }
 * }
 */

const FREQUENCIES = ['one_time', 'quarterly', 'monthly'];

/**
 * Simpel heuristik: estimer antal vinduer fra bygningstype + areal + etager.
 * Bruges som fallback hvis bruger ikke angiver vinduesantal.
 */
function estimateWindowCount(propertyData) {
  const { buildingType, areaM2 = 80, floors = 1 } = propertyData || {};

  const basePerType = {
    villa: 16,
    parcelhus: 14,
    rækkehus: 12,
    stuehus: 12,
    etagebolig: 8,
    kollegium: 6,
  };

  const base = basePerType[buildingType] ?? 12;

  if (buildingType === 'etagebolig' || buildingType === 'kollegium') {
    return base;
  }

  const areaFactor = Math.min(1.5, Math.max(0.7, areaM2 / 100));
  const floorBonus = Math.max(0, floors - 1) * 4;
  return Math.round(base * areaFactor + floorBonus);
}

/**
 * Beregn tilbud baseret på ejendomsdata, prisconfig, valgte services og vinduesantal.
 * @param {Object} propertyData - { buildingType, areaM2, floors }
 * @param {Object} pricingConfig - tenant.pricing
 * @param {string} frequency - 'one_time' | 'quarterly' | 'monthly'
 * @param {Object} selectedServices - { tagvinduer: { count: 2 }, indvendig: {}, karme: {} } eller { tagvinduer: 2 } for surcharge_each
 * @param {number|null} windowCount - brugerens vinduesantal (1-30), eller null for estimat
 * @returns {Object}
 */
function calculateQuote(
  propertyData,
  pricingConfig,
  frequency = 'one_time',
  selectedServices = {},
  windowCount = null
) {
  const config = pricingConfig || {};

  const minPrice = Number(config.min_price) || 399;
  const pricePerWindow = Number(config.price_per_window) || 45;
  const secondFloorPct = Number(config.second_floor_surcharge_pct) || 0.15;
  const discounts = config.frequency_discounts || { one_time: 0, quarterly: 0.05, monthly: 0.1 };
  const discountPct = Number(discounts[frequency]) || 0;

  const estimated_windows =
    windowCount != null && windowCount >= 1
      ? Math.min(30, Math.max(1, Math.round(Number(windowCount))))
      : estimateWindowCount(propertyData);
  const windows = estimated_windows;

  let base_price = windows * pricePerWindow;

  const floors = propertyData?.floors ?? 1;
  if (floors > 1) {
    base_price += Math.round(base_price * secondFloorPct);
  }

  const service_surcharges = {};
  let total_surcharges = 0;
  const services = config.services || {};

  for (const [key, sel] of Object.entries(selectedServices)) {
    const svc = services[key];
    if (!svc) continue;

    let amt = 0;
    if (svc.surcharge_flat != null) {
      amt = Number(svc.surcharge_flat) || 0;
    } else if (svc.surcharge_pct != null) {
      amt = Math.round(base_price * Number(svc.surcharge_pct));
    } else if (svc.surcharge_per_window != null) {
      amt = windows * (Number(svc.surcharge_per_window) || 0);
    } else if (svc.surcharge_each != null && svc.requires_count) {
      const count = typeof sel === 'object' && sel != null && 'count' in sel ? Number(sel.count) || 0 : Number(sel) || 0;
      amt = count * (Number(svc.surcharge_each) || 0);
    }

    if (amt > 0) {
      service_surcharges[key] = amt;
      total_surcharges += amt;
    }
  }

  const subtotal = base_price + total_surcharges;
  const frequency_discount = Math.round(subtotal * discountPct);
  let final_price = Math.max(minPrice, subtotal - frequency_discount);

  return {
    estimated_windows: windows,
    base_price,
    service_surcharges,
    total_surcharges,
    frequency_discount,
    final_price,
  };
}

module.exports = {
  calculateQuote,
  estimateWindowCount,
  FREQUENCIES,
};
