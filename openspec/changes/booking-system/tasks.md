# Tasks: Booking System MVP

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1200–1500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main|feature-branch-chain|size-exception|pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend foundation: DB models, schemas, migration | PR 1 | Base = main; models + migration only, no business logic |
| 2 | Backend service + API: slot calc, booking CRUD, demo generator | PR 2 | Base = PR 1; service layer, API routes, leads endpoint |
| 3 | Frontend: components, pages, routing | PR 3 | Base = PR 2; React booking flow, confirmation, admin |

## Phase 1: Database Foundation

- [ ] 1.1 Create `api/app/models/booking.py` with 5 SQLAlchemy models: `BookingBusiness`, `BookingService`, `BookingAvailability`, `BookingException`, `BookingAppointment`
- [ ] 1.2 Add `__table_args__` with `UniqueConstraint("business_id", "date", "time", name="uq_booking_slot")` on `BookingAppointment`
- [ ] 1.3 Create `migrations/versions/xxx_booking_tables.sql` with `CREATE TABLE` for all 5 tables, indexes, and the unique constraint
- [ ] 1.4 Add `booking_businesses.is_demo` index for demo cleanup queries

## Phase 2: Schemas

- [ ] 2.1 Create `api/app/schemas/booking.py` with `BusinessPublicResponse`, `ServicePublic`, `SlotResponse`, `AppointmentCreate`, `AppointmentRead`, `DemoCreateRequest`, `DemoCreateResponse`
- [ ] 2.2 Add `EmailStr` validation for `customer_email` in `AppointmentCreate`
- [ ] 2.3 Add `time` and `date` schema types using Pydantic `contime`/`condate` for slot validation

## Phase 3: Service Layer

- [ ] 3.1 Create `api/app/services/booking_service.py` with `BookingService` class: `get_business_by_slug()`, `list_active_services()`, `calculate_available_slots()`
- [ ] 3.2 Implement slot calculation: weekly availability − existing bookings − exceptions, respecting business timezone
- [ ] 3.3 Add `create_appointment()` with DB-level double-booking prevention (try/except on constraint violation → 409)
- [ ] 3.4 Add `generate_demo()` with `INDUSTRY_TEMPLATES` dict (dental, barberia, restaurante, generic)
- [ ] 3.5 Implement slug collision handling: append `-2`, `-3` suffix on unique constraint failure

## Phase 4: API Routes

- [ ] 4.1 Create `api/app/api/v1/booking.py` with FastAPI router
- [ ] 4.2 Add public endpoints: `GET /v1/booking/{slug}`, `GET /v1/booking/{slug}/slots`, `POST /v1/booking/{slug}/appointments`
- [ ] 4.3 Add admin endpoints: `GET /v1/admin/bookings`, `PATCH /v1/admin/bookings/{id}/cancel`
- [ ] 4.4 Add `POST /v1/booking-demos` with lead_id → demo generation
- [ ] 4.5 Gate all routes behind `BOOKING_SYSTEM_ENABLED` feature flag
- [ ] 4.6 Register router in `api/app/api/v1/__init__.py`
- [ ] 4.7 Add `POST /{lead_id}/booking-demo` to `api/app/api/v1/leads.py` (delegates to booking service)

## Phase 5: Frontend Components

- [ ] 5.1 Create `frontend/src/components/booking/ServiceCard.tsx` with name, duration, price display
- [ ] 5.2 Create `frontend/src/components/booking/DatePicker.tsx` with month navigation and date selection
- [ ] 5.3 Create `frontend/src/components/booking/TimeSlotPicker.tsx` with 30-min slot grid, disabled state for booked slots
- [ ] 5.4 Create `frontend/src/components/booking/BookingForm.tsx` with name, phone, email fields and validation
- [ ] 5.5 Create `frontend/src/components/booking/ServiceSelector.tsx` as wrapper for service list + selection state

## Phase 6: Frontend Pages

- [ ] 6.1 Create `frontend/src/pages/BookingPage.tsx` with 4-step flow: service → date/time → customer info → submit
- [ ] 6.2 Create `frontend/src/pages/BookingConfirmationPage.tsx` with booking details display and CTA
- [ ] 6.3 Create `frontend/src/pages/BookingAdminPage.tsx` with booking list per business
- [ ] 6.4 Add `VITE_BOOKING_ENABLED` env var guard to all booking page routes

## Phase 7: Router Integration

- [ ] 7.1 Add `/booking/:slug/booking` route in `frontend/src/App.tsx` pointing to `BookingPage` (layout-free)
- [ ] 7.2 Add `/booking/:slug/confirmed` route pointing to `BookingConfirmationPage` (layout-free)
- [ ] 7.3 Add `/booking-admin` route pointing to `BookingAdminPage` (inside app shell)
- [ ] 7.4 Ensure no sidebar/header chrome on `/booking/*` routes

## Phase 8: Scout Integration (Optional)

- [ ] 8.1 Modify `scout/internal/enrichment/commercial.go` to set `commercial_signals = append(commercial_signals, "booking_demo_candidate")` when `HasBooking=false`
- [ ] 8.2 Update `revenue_signal` to "services" if not already higher when flagging demo candidate