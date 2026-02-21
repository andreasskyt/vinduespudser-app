const { renderTemplate } = require('../utils/templateRenderer');
const { calculateQuote } = require('./PricingEngine');

/**
 * Samler tilbud fra prisberegning + ejendomsdata og renderer template.
 * @param {Object} opts - propertyData, pricingConfig, tenant, frequency, selectedServices, windowCount
 */
function assembleQuote(opts) {
  const {
    propertyData,
    pricingConfig,
    tenant,
    frequency = 'one_time',
    selectedServices = {},
    windowCount = null,
  } = opts;

  const quoteResult = calculateQuote(
    propertyData,
    pricingConfig,
    frequency,
    selectedServices,
    windowCount
  );
  const { estimated_windows, final_price } = quoteResult;

  const frequencyLabels = {
    one_time: 'Én gang',
    quarterly: 'Kvartalsvis',
    monthly: 'Månedligt',
  };

  const templateData = {
    customer_name: '',
    address: '',
    window_count: estimated_windows,
    price: final_price,
    frequency: frequencyLabels[frequency] || 'Én gang',
    company_name: tenant?.name || '',
  };

  const quote_html = renderTemplate(tenant?.quote_template || '', templateData);

  return {
    ...quoteResult,
    quote_html,
    templateData,
    pricing_snapshot: pricingConfig,
  };
}

module.exports = { assembleQuote };
