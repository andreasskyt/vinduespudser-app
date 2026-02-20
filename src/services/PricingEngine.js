/**
 * Prisberegning baseret på ejendomsdata og tenant prisconfig.
 */

const FREQUENCIES = ['one_time', 'quarterly', 'monthly'];

/**
 * Simpel heuristik: estimer antal vinduer fra bygningstype + areal + etager.
 * Villa ~16, rækkehus ~12, lejlighed ~8, justeret efter etager.
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
  // Justér lidt med areal (større bolig = flere vinduer)
  const areaFactor = Math.min(1.5, Math.max(0.7, areaM2 / 100));
  const floorBonus = Math.max(0, floors - 1) * 4;
  return Math.round(base * areaFactor + floorBonus);
}

/**
 * Beregn tilbud baseret på ejendomsdata og prisconfig.
 * @param {Object} propertyData - { buildingType, areaM2, floors }
 * @param {Object} pricingConfig - tenant.pricing
 * @param {string} frequency - 'one_time' | 'quarterly' | 'monthly'
 * @returns {Object} { estimated_windows, base_price, surcharges, discount, final_price }
 */
function calculateQuote(propertyData, pricingConfig, frequency = 'one_time') {
  const config = pricingConfig || {};
  const minPrice = Number(config.min_price) || 399;
  const pricePerWindow = Number(config.price_per_window) || 45;
  const topWindowSurcharge = Number(config.top_window_surcharge) || 80;
  const secondFloorPct = Number(config.second_floor_surcharge_pct) || 0.15;
  const discounts = config.frequency_discounts || { one_time: 0, quarterly: 0.05, monthly: 0.1 };
  const discountPct = Number(discounts[frequency]) || 0;

  const estimated_windows = estimateWindowCount(propertyData);
  let base_price = estimated_windows * pricePerWindow;

  let surcharges = 0;
  const floors = propertyData?.floors ?? 1;
  if (floors > 1) {
    surcharges += topWindowSurcharge;
    surcharges += Math.round(base_price * secondFloorPct);
  }

  base_price += surcharges;
  const discount = Math.round(base_price * discountPct);
  let final_price = base_price - discount;
  final_price = Math.max(minPrice, final_price);

  return {
    estimated_windows,
    base_price: base_price - surcharges,
    surcharges,
    discount,
    final_price,
  };
}

module.exports = {
  calculateQuote,
  estimateWindowCount,
  FREQUENCIES,
};
