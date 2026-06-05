# Exploration: Booking System

## Current State

Orion is a lead generation platform with these services:
- **Scout** (Go): Finds businesses with bad websites, detects `HasBooking` signal
- **Auditor** (Python): Lighthouse audits
- **Closer** (Python): LLM-generated cold emails
- **Sniper** (Go): Uptime monitoring
- **API** (FastAPI): Central REST API with PostgreSQL
- **Frontend** (React+Vite): Internal dashboard

The system currently detects if a business ALREADY has booking (Calendly, "reserva", "turno" patterns in `commercial.go:74-79`), but doesn't provide booking as a service.

## Architecture Decision

### Recommendation: **Option B — Standalone Next.js App**

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| A: Module in docker-compose | Shared DB, integrated pipeline | Couples booking to SaaS infra, hard to deploy per client | Medium |
| B: Standalone Next.js | Independent deployment, SSR for SEO, per-client customization, SaaS-ready | Separate DB/service to manage | Medium |
| C: Module in FastAPI | Reuses existing patterns | Wrong tech for public-facing pages, poor SEO, tight coupling | Low |

**Why Option B:**
1. **SaaS requirement**: Each client needs isolated deployment or multi-tenant isolation
2. **Demo generation**: Must be fast to spin up personalized instances
3. **SEO matters**: Booking pages need SSR for discoverability
4. **Clean separation**: Booking product shouldn't depend on internal SaaS pipeline

## Multi-Tenancy Strategy

**Recommended: Path-based with subdomain option**

```
Primary:    book.yourdomain.com/{business-slug}
Vanity:     {business}.book.yourdomain.com (premium)
```

- Path-based is simpler for MVP (single deployment, DNS wildcard optional)
- Subdomain for paying clients who want white-label
- Database: `business_id` FK on all tables, RLS or application-level isolation

## MVP Feature List

### Phase 1: Core Booking (MVP)
1. **Service catalog** — CRUD for services (name, duration, price)
2. **Availability engine** — Weekly schedule + exceptions
3. **Booking form** — Customer selects service, date/time, enters details
4. **Confirmation** — Email to customer + business owner
5. **Business dashboard** — View/manage bookings, set availability
6. **Demo generator** — Template-based: inject business name, services, logo

### Phase 2: Growth Features
- Embeddable widget (iframe/script)
- SMS reminders (Twilio)
- Payment deposit (Stripe)
- Multi-staff support
- Recurring bookings

## Tech Stack Recommendation

```
Frontend:  Next.js 14+ (App Router, SSR, Server Actions)
Database:  PostgreSQL (shared or dedicated per deployment)
ORM:       Prisma (type-safe, migrations)
Auth:      NextAuth.js or Clerk (business owner login)
Email:     Resend (already in stack)
Deploy:    Vercel (easy) or Docker (self-hosted)
```

**Why not reuse FastAPI+React:**
- FastAPI serves API, not SSR pages — bad for SEO
- React SPA requires client-side rendering — slow first paint
- Next.js gives SSR + API routes in one package
- Easier to deploy standalone per client

## Integration with Orion Pipeline

```
Scout detects HasBooking=false
         ↓
API creates lead with booking_opportunity flag
         ↓
Closer generates email with demo link:
  "Mira cómo se vería tu sistema de reservas: 
   https://book.yourdomain.com/demo-barberia"
         ↓
Demo page auto-generated from:
  - Business name (from Scout)
  - Industry (dentist/barber/restaurant → template)
  - Suggested services (pre-populated per industry)
         ↓
If lead clicks → track engagement
If lead replies → Closer handles conversion
```

### API Integration Points

1. **Demo generation endpoint** (new): `POST /api/v1/booking/demos`
   - Input: business_name, industry, services[]
   - Output: demo_url, demo_id
   
2. **Lead enrichment**: Add `booking_demo_url` to leads table

3. **Email template**: Closer includes demo link in cold email

## Risks and Considerations

1. **Deployment complexity**: Multi-tenant vs multi-instance decision affects everything
2. **Demo abuse**: Need rate limiting, expiry on demo links
3. **Data isolation**: If multi-tenant, one DB breach = all clients
4. **Maintenance burden**: Two codebases (Orion + Booking) to maintain
5. **Cold start**: Demo pages must load fast (<2s) or prospects bounce

## Estimated Scope

| Component | Lines (approx) | Files |
|-----------|----------------|-------|
| Next.js app structure | 500 | 10 |
| Database schema (Prisma) | 200 | 2 |
| API routes (booking CRUD) | 800 | 8 |
| Availability engine | 400 | 3 |
| Booking form + UI | 600 | 6 |
| Business dashboard | 500 | 5 |
| Demo generator | 300 | 3 |
| Email integration | 200 | 2 |
| Tests | 600 | 8 |
| **Total** | **~4,100** | **~47** |

## Ready for Proposal

**Yes** — the exploration is complete. The orchestrator can proceed to proposal with:
- Architecture: Standalone Next.js app (Option B)
- Multi-tenancy: Path-based with subdomain option
- MVP scope: 6 core features (~4,100 lines)
- Integration: Demo generator endpoint + Closer email template
