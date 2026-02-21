# Vinduespudser App

Multi-tenant SaaS til danske vinduespudserfirmaer. Appen genererer automatiske pris tilbud til kunder baseret på deres adresse.

## Funktioner

- **Kundeflow**: Kunden besøger `/firma-slug`, udfylder formular (navn, email, telefon, adresse med DAWA-autocomplete), får øjeblikkelig prisberegning
- **Leads**: Tilbud + lead sendes til firmaet via email (Resend) og evt. webhook
- **Admin API**: Opret/rediger tenants via HTTP API (curl/Postman)

## Tech Stack

- Node.js + Express
- EJS (server-rendered)
- Tailwind CSS via CDN
- Supabase (PostgreSQL)
- Resend.io (email)
- DAWA (adresse-autocomplete)
- BBR via Datafordeler (ejendomsdata)

## Opsætning

1. Kopiér `.env.example` til `.env` og udfyld værdier
2. `npm install`
3. Kør Supabase-migrationer: `001_initial_schema.sql` og `002_quote_details.sql` i Supabase Dashboard
4. `npm run dev` eller `npm start`

## Admin API

Alle admin-routes kræver `Authorization: Bearer ADMIN_KEY` header.

- `GET /admin/tenants` – liste over tenants
- `POST /admin/tenants` – opret tenant (JSON body)
- `PATCH /admin/tenants/:id` – opdater tenant

### Oprettelse af tenant (POST /admin/tenants)

Obligatoriske felter: `slug`, `name`, `contact_email`, `pricing`, `quote_template`.

**Prisconfig (pricing)** – JSON-objekt med basispriser og services:

```json
{
  "min_price": 399,
  "price_per_window": 45,
  "second_floor_surcharge_pct": 0.15,
  "frequency_discounts": {
    "one_time": 0.00,
    "quarterly": 0.05,
    "monthly": 0.10
  },
  "services": {
    "udvendig": { "included": true, "label": "Udvendig vinduesvask", "default_selected": true, "surcharge_flat": 0 },
    "indvendig": { "included": true, "label": "Indvendig vinduesvask", "surcharge_pct": 0.5 },
    "karme": { "included": true, "label": "Karme og rammer", "surcharge_per_window": 8 },
    "tagvinduer": { "included": true, "label": "Ovenlysvinduer/tagvinduer", "surcharge_each": 80, "requires_count": true },
    "konservatorium": { "included": false, "label": "Konservatorium/vinterhave", "surcharge_flat": 400 }
  }
}
```

| Felt | Betydning |
|------|-----------|
| `min_price` | Mindstepris i kr. |
| `price_per_window` | Kr. per vindue |
| `second_floor_surcharge_pct` | Procent tillæg (0–1) for 2+ etager |
| `frequency_discounts` | Rabatter per frekvens |
| `services` | Valgfrie tillæg. Kun `included: true` vises i formen. Tillægstyper: `surcharge_flat`, `surcharge_pct`, `surcharge_per_window`, `surcharge_each` (kræver `requires_count: true`) |

**Valgfri webhook**: `webhook_url` – URL som modtager POST med lead og tilbudsdata ved nyt tilbud.

**Eksempel – opret tenant med curl:**
```bash
curl -X POST http://localhost:3000/admin/tenants \
  -H "Authorization: Bearer DIN_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "mit-firma",
    "name": "Mit Vinduespudser",
    "contact_email": "info@mitfirma.dk",
    "webhook_url": "https://mit-crm.dk/webhooks/leads",
    "pricing": { "min_price": 399, "price_per_window": 45 },
    "quote_template": "Kære {{customer_name}}, tilbud for {{address}}: {{price}} kr."
  }'
```

## Miljøvariabler

Se `.env.example` for krævede variabler.
