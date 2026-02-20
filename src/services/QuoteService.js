const { renderTemplate } = require('../utils/templateRenderer');
const { calculateQuote } = require('./PricingEngine');

/**
 * Samler tilbud fra prisberegning + ejendomsdata og renderer template.
 */
function assembleQuote(propertyData, pricingConfig, tenant, frequency = 'one_time') {
  const quoteResult = calculateQuote(propertyData, pricingConfig, frequency);
  const { estimated_windows, final_price } = quoteResult;

  const frequencyLabels = {
    one_time: 'Engangs',
    quarterly: 'Kvartalsvis',
    monthly: 'Månedligt',
  };

  const templateData = {
    customer_name: '', // Sættes når lead er oprettet
    address: '', // Sættes fra form
    window_count: estimated_windows,
    price: final_price,
    frequency: frequencyLabels[frequency] || 'Engangs',
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
