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

## Miljøvariabler

Se `.env.example` for krævede variabler.
