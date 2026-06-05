# Proposal: Booking System MVP

## Intent

Build a minimal booking system integrated into the existing Orion stack to auto-generate demo booking pages for prospects detected without booking systems. This enables the Closer to send personalized cold emails with working demos showing the prospect's business already set up.

## Scope

### In Scope
- Public booking page with calendar, time slots, and booking form
- Business configuration (services, availability, info)
- Orion Scout integration for "no booking" detection
- Demo generation API endpoint
- Email confirmations via existing Resend integration
- Multi-tenant routing by URL path: `booking.yoquelvis.dev/{business-slug}`

### Out of Scope
- Business dashboard (manual DB/API management for MVP)
- Payment processing
- SMS notifications
- Recurring bookings
- Staff management
- Analytics
- Embeddable widgets

## Capabilities

### New Capabilities
- `booking-public-page`: Customer-facing booking interface with calendar, service selection, time slot picker, booking form, and confirmation page
- `booking-business-config`: Business configuration model including service catalog (name, duration, price), weekly availability schedule, and business metadata (name, slug, contact info, timezone)
- `booking-orion-integration`: Integration with Orion pipeline including enhanced Scout signal for "no booking" detection, demo generation API (`POST /v1/booking-demos`), and Closer email injection of demo links

### Modified Capabilities
None

## Approach

Extend the existing docker-compose stack with new FastAPI routes and React pages. Use PostgreSQL for multi-tenant data storage with business slug as tenant identifier. Scout detects prospects without booking systems and triggers demo generation with auto-populated business data (name, industry-appropriate services, colors). Demo pages become production pages upon signup.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api/app/api/v1/booking.py` | New | FastAPI routes for booking operations |
| `api/app/models/booking.py` | New | SQLAlchemy models for booking tables |
| `api/app/schemas/booking.py` | New | Pydantic schemas for request/response validation |
| `api/app/services/booking_service.py` | New | Business logic for availability calculation and booking creation |
| `frontend/src/pages/BookingPage.tsx` | New | Public booking interface |
| `frontend/src/pages/BookingConfirmation.tsx` | New | Booking confirmation display |
| `frontend/src/components/booking/` | New | Reusable booking components (calendar, time slots, form) |
| Database migrations | New | Tables: booking_businesses, booking_services, booking_availability, booking_appointments |
| `api/app/api/v1/leads.py` | Modified | Add demo generation endpoint integration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Timezone handling errors | Medium | Store all times in UTC, convert at display layer using business timezone config |
| Multi-tenant data leakage | Low | Enforce business_id filtering at query layer, add integration tests for tenant isolation |
| Demo data conflicts with production | Low | Separate demo flag on business records, cleanup job for expired demos |

## Rollback Plan

1. Feature flag `BOOKING_SYSTEM_ENABLED` (default: false) gates all booking routes
2. Database migrations are reversible with `alembic downgrade`
3. Frontend routes can be disabled via environment variable
4. No changes to existing functionality — pure additive change

## Dependencies

- Existing FastAPI application structure
- PostgreSQL database
- React frontend with routing
- Resend email service (already integrated)
- Docker Compose orchestration

## Success Criteria

- [ ] Scout detects prospects without booking systems with >80% accuracy
- [ ] Demo generation creates working booking page in <5 seconds
- [ ] End customers can complete booking flow (select service → pick time → submit → receive confirmation)
- [ ] Confirmation emails sent successfully via Resend
- [ ] Closer emails include personalized demo links
- [ ] Multi-tenant routing works correctly (different businesses on same domain)
