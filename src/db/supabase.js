const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL og SUPABASE_SERVICE_KEY skal være sat i .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/** Hent tenant ud fra slug */
async function getTenantBySlug(slug) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();
  if (error) return null;
  return data;
}

/** Hent tenant ud fra id */
async function getTenantById(id) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

/** Opret lead */
async function createLead(lead) {
  const { data, error } = await supabase
    .from('leads')
    .insert(lead)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Opret quote */
async function createQuote(quote) {
  const { data, error } = await supabase
    .from('quotes')
    .insert(quote)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Liste alle tenants (admin) */
async function listTenants() {
  const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Opret tenant (admin) */
async function createTenant(tenant) {
  const { data, error } = await supabase
    .from('tenants')
    .insert(tenant)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Opdater tenant (admin) */
async function updateTenant(id, updates) {
  const { data, error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

module.exports = {
  supabase,
  getTenantBySlug,
  getTenantById,
  createLead,
  createQuote,
  listTenants,
  createTenant,
  updateTenant,
};
