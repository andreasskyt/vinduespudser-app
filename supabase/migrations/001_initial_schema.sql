-- TENANTS: En række per vinduespudserfirma
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,              -- URL slug f.eks. "vinduesklart-aarhus"
  name TEXT NOT NULL,                     -- Firmavisning
  contact_email TEXT NOT NULL,            -- Hvor leads sendes
  webhook_url TEXT,                       -- Valgfri webhook til CRM
  pricing JSONB NOT NULL,                 -- Fuld prisindstilling (se struktur nedenfor)
  quote_template TEXT NOT NULL,           -- Email/visningstemplate med {{placeholders}}
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- LEADS: En række per indsendt formular
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_raw TEXT NOT NULL,             -- Fuld adressestrenge som indtastet
  dawa_address_id TEXT,                  -- DAWA adresse ID til BBR-opslag
  bbr_data JSONB,                        -- Snapshot af BBR-respons
  created_at TIMESTAMPTZ DEFAULT now()
);

-- QUOTES: En række per genereret tilbud, koblet til lead
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  tenant_id UUID REFERENCES tenants(id),
  pricing_snapshot JSONB NOT NULL,       -- Snapshot af tenant pricing ved tilbudstidspunkt
  calculated_price NUMERIC NOT NULL,
  window_count_estimated INTEGER,
  quote_html TEXT,                       -- Renderet tilbud til visning/email
  created_at TIMESTAMPTZ DEFAULT now()
);
