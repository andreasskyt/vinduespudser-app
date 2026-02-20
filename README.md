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
3. Kør Supabase-migration: `001_initial_schema.sql` i Supabase Dashboard
4. `npm run dev` eller `npm start`

## Admin API

Alle admin-routes kræver `Authorization: Bearer ADMIN_KEY` header.

- `GET /admin/tenants` – liste over tenants
- `POST /admin/tenants` – opret tenant (JSON body)
- `PATCH /admin/tenants/:id` – opdater tenant

### Oprettelse af tenant (POST /admin/tenants)

Obligatoriske felter: `slug`, `name`, `contact_email`, `pricing`, `quote_template`.

**Prisconfig (pricing)** – JSON-objekt med følgende felter:

```json
{
  "min_price": 399,
  "price_per_window": 45,
  "top_window_surcharge": 80,
  "second_floor_surcharge_pct": 0.15,
  "frequency_discounts": {
    "one_time": 0.00,
    "quarterly": 0.05,
    "monthly": 0.10
  }
}
```

| Felt | Betydning |
|------|-----------|
| `min_price` | Mindstepris i kr. – tilbuddet kan aldrig gå under dette |
| `price_per_window` | Kr. per vindue – grundprisen ganges med antal estimerede vinduer |
| `top_window_surcharge` | Fast tillæg i kr. hvis bygningen har flere etager (tagvinduer/ovenlysvinduer) |
| `second_floor_surcharge_pct` | Procentvis tillæg (0–1) for 2. sal og derover – dækker ekstra arbejde ved høje vinduer |
| `frequency_discounts.one_time` | Ingen rabat ved enkeltbesøg (0) |
| `frequency_discounts.quarterly` | Rabat ved kvartalsvis aftale (0.05 = 5%) |
| `frequency_discounts.monthly` | Rabat ved månedlig aftale (0.10 = 10%) |

## Miljøvariabler

Se `.env.example` for krævede variabler.
