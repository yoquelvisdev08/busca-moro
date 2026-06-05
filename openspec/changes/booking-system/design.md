# Design: Booking System MVP

## Technical Approach

Extend the Orion stack with a multi-tenant booking subsystem. New PostgreSQL tables store business configurations, services, availability schedules, and appointments. FastAPI exposes public (unauthenticated) and admin (JWT-protected) routes. The React frontend adds a standalone booking flow page (no sidebar/header chrome) and an admin view within the existing app shell. Demo generation creates seeded business records from industry templates, returning a shareable URL for cold email campaigns.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| UUID PKs (like existing models) vs INT auto-increment | UUIDs prevent enumeration but are longer in URLs; slugs are the public identifier anyway | UUID PKs — matches existing `Lead` pattern, internal only |
| Separate `booking.py` router vs extend `leads.py` | Separation of concerns vs fewer files | Separate `booking.py` router — distinct domain, different auth requirements |
| Standalone booking page (no chrome) vs embedded in app layout | Booking pages need clean customer-facing UX vs reusing layout | Standalone — separate route outside `App` layout, bare page |
| Slot calculation in-memory vs materialized slot table | Simpler code vs query performance | In-memory calculation — MVP scale, weekly schedule + existing bookings is fast enough |
| `is_demo` flag on business vs separate demo table | Single table simpler query vs data isolation | `is_demo` boolean on `booking_businesses` — simpler, cleanup job later |
| Unique constraint `(business_id, date, time)` vs application-level check | DB-level prevents race conditions vs more complex | DB unique constraint — prevents double-booking at source |

## Data Flow

```
Customer                          Frontend                        API                          Database
    │                               │                              │                              │
    ├── GET /booking/{slug} ───────►│                              │                              │
    │                               ├── GET /v1/booking/{slug} ───►│── query business+services ──►│
    │                               │◄── BusinessResponse ─────────│◄─────────────────────────────│
    │                               │                              │                              │
    ├── Select date ───────────────►│                              │                              │
    │                               ├── GET /v1/booking/{slug}/    │                              │
    │                               │   slots?date=... ───────────►│── availability - bookings    │
    │                               │◄── Slot[] ───────────────────│◄─────────────────────────────│
    │                               │                              │                              │
    ├── Select time + submit ──────►│                              │                              │
    │                               ├── POST /v1/booking/{slug}/   │                              │
    │                               │   appointments ─────────────►│── INSERT appointment         │
    │                               │                              │── send confirmation email    │
    │                               │◄── AppointmentRead ──────────│◄─────────────────────────────│
    │◄── Confirmation page ─────────│                              │                              │
```

Scout/Closer demo flow:

```
Scout ──► POST /v1/booking-demos {lead_id} ──► API creates business from template
                                                  │
                                                  ├── INSERT booking_businesses (is_demo=true)
                                                  ├── INSERT booking_services (industry template)
                                                  ├── INSERT booking_availability (default 9-18)
                                                  │
                                                  └── Return URL: /booking/{slug}/booking
                                                       │
Closer ◄── demo_url ◄────────────────────────────────┘
    │
    └── Injects URL into cold email → Prospect clicks → sees pre-filled booking page
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `api/app/models/booking.py` | Create | SQLAlchemy models: BookingBusiness, BookingService, BookingAvailability, BookingException, BookingAppointment |
| `api/app/schemas/booking.py` | Create | Pydantic schemas: request/response for all booking endpoints |
| `api/app/services/booking_service.py` | Create | Business logic: availability calculation, slot generation, booking creation, demo seeding |
| `api/app/api/v1/booking.py` | Create | FastAPI router: public + admin endpoints |
| `api/app/api/v1/__init__.py` | Modify | Register booking router |
| `api/app/api/v1/leads.py` | Modify | Add `POST /{lead_id}/booking-demo` endpoint (or keep in booking.py as `/booking-demos`) |
| `frontend/src/pages/BookingPage.tsx` | Create | Public booking flow (service → date → time → form → confirm) |
| `frontend/src/pages/BookingConfirmationPage.tsx` | Create | Post-booking confirmation view |
| `frontend/src/pages/BookingAdminPage.tsx` | Create | Admin booking list within app shell |
| `frontend/src/components/booking/` | Create | Reusable components: Calendar, TimeSlotPicker, BookingForm, ServiceSelector |
| `frontend/src/App.tsx` | Modify | Add `/booking/:slug/booking` and `/booking/:slug/confirmed` routes (standalone, no chrome) + `/booking-admin` route |
| `migrations/versions/` | Create | Alembic migration for 5 new tables |

## Interfaces / Contracts

### Database Models

```python
# api/app/models/booking.py
class BookingBusiness(Base):
    __tablename__ = "booking_businesses"
    id: UUID (PK, uuid4)
    name: str (Text, nullable=False)
    slug: str (CITEXT, unique, nullable=False)
    phone: Optional[str] (Text)
    email: Optional[str] (CITEXT)
    timezone: str (String(64), default="America/Argentina/Buenos_Aires")
    logo_url: Optional[str] (Text)
    is_demo: bool (Boolean, default=False)
    is_active: bool (Boolean, default=True)
    created_at: datetime (UTC, server_default=now)

class BookingService(Base):
    __tablename__ = "booking_services"
    id: UUID (PK, uuid4)
    business_id: UUID (FK → booking_businesses.id)
    name: str (Text, nullable=False)
    duration_minutes: int (Integer, default=30)
    price_cents: int (Integer, default=0)
    currency: str (String(3), default="ARS")
    is_active: bool (Boolean, default=True)

class BookingAvailability(Base):
    __tablename__ = "booking_availability"
    id: UUID (PK, uuid4)
    business_id: UUID (FK → booking_businesses.id)
    day_of_week: int (0=Mon..6=Sun)
    start_time: time (nullable=False)
    end_time: time (nullable=False)

class BookingException(Base):
    __tablename__ = "booking_exceptions"
    id: UUID (PK, uuid4)
    business_id: UUID (FK → booking_businesses.id)
    date: date (nullable=False)
    type: Enum("blocked", "modified")
    start_time: Optional[time]
    end_time: Optional[time]

class BookingAppointment(Base):
    __tablename__ = "booking_appointments"
    id: UUID (PK, uuid4)
    business_id: UUID (FK → booking_businesses.id)
    service_id: UUID (FK → booking_services.id)
    customer_name: str (Text, nullable=False)
    customer_phone: str (Text)
    customer_email: str (CITEXT)
    date: date (nullable=False)
    time: time (nullable=False)
    status: Enum("pending", "confirmed", "cancelled")
    __table_args__ = (
        UniqueConstraint("business_id", "date", "time", name="uq_booking_slot"),
    )
    created_at: datetime (UTC, server_default=now)
    confirmed_at: Optional[datetime] (UTC)
```

### API Contracts

```python
# Public: GET /v1/booking/{slug}
class BusinessPublicResponse(BaseModel):
    name: str
    slug: str
    phone: Optional[str]
    email: Optional[str]
    timezone: str
    logo_url: Optional[str]
    services: list[ServicePublic]

class ServicePublic(BaseModel):
    id: UUID
    name: str
    duration_minutes: int
    price_cents: int
    currency: str

# Public: GET /v1/booking/{slug}/slots?date=YYYY-MM-DD&service_id=UUID
class SlotResponse(BaseModel):
    available_slots: list[time]  # ["09:00", "09:30", ...]
    service_duration: int

# Public: POST /v1/booking/{slug}/appointments
class AppointmentCreate(BaseModel):
    service_id: UUID
    date: date
    time: time
    customer_name: str
    customer_phone: Optional[str]
    customer_email: Optional[EmailStr]

# Internal: POST /v1/booking-demos
class DemoCreateRequest(BaseModel):
    lead_id: UUID

class DemoCreateResponse(BaseModel):
    business_id: UUID
    slug: str
    booking_url: str  # "https://booking.yoquelvis.dev/{slug}/booking"
```

### Industry Templates

```python
INDUSTRY_TEMPLATES = {
    "dental": {
        "services": [
            {"name": "Limpieza", "duration_minutes": 45, "price_cents": 15000},
            {"name": "Blanqueamiento", "duration_minutes": 60, "price_cents": 35000},
            {"name": "Consulta", "duration_minutes": 30, "price_cents": 8000},
            {"name": "Ortodoncia", "duration_minutes": 45, "price_cents": 25000},
        ],
        "availability": [(9, "09:00", "18:00", [1,2,3,4,5])],  # Mon-Fri 9-18
    },
    "barberia": {
        "services": [
            {"name": "Corte", "duration_minutes": 30, "price_cents": 5000},
            {"name": "Barba", "duration_minutes": 20, "price_cents": 3000},
            {"name": "Corte+Barba", "duration_minutes": 45, "price_cents": 7000},
            {"name": "Tinte", "duration_minutes": 60, "price_cents": 12000},
        ],
        "availability": [(9, "09:00", "19:00", [1,2,3,4,5,6])],  # Mon-Sat 9-19
    },
    "restaurante": {
        "services": [
            {"name": "Mesa 2 personas", "duration_minutes": 90, "price_cents": 0},
            {"name": "Mesa 4 personas", "duration_minutes": 90, "price_cents": 0},
            {"name": "Mesa 6+ personas", "duration_minutes": 120, "price_cents": 0},
        ],
        "availability": [(12, "12:00", "23:00", list(range(7)))],  # Daily 12-23
    },
    "generic": {
        "services": [
            {"name": "Consulta", "duration_minutes": 30, "price_cents": 0},
            {"name": "Servicio Premium", "duration_minutes": 60, "price_cents": 0},
            {"name": "Evaluación", "duration_minutes": 45, "price_cents": 0},
        ],
        "availability": [(9, "09:00", "18:00", [1,2,3,4,5])],
    },
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Slot calculation logic (availability - bookings - exceptions) | Pure Python tests with mock data, edge cases: overlapping bookings, exceptions, boundary times |
| Unit | Demo template seeding | Verify correct services/availability created per industry |
| Unit | Slug generation from business name | Collision handling, special characters |
| Integration | Public booking flow end-to-end | Create business → query slots → book → verify DB + email |
| Integration | Tenant isolation | Book on business A, verify business B slots unaffected |
| Integration | Double-booking prevention | Concurrent POST to same slot → one succeeds, one fails with 409 |
| E2E | Frontend booking flow | Playwright: navigate → select service → pick date/time → submit → see confirmation |

## Migration / Rollout

1. **Feature flag**: `BOOKING_SYSTEM_ENABLED` env var (default: `false`) gates all booking routes at the router level in `__init__.py`.
2. **Database migration**: Single Alembic migration creating all 5 tables. Reversible via `alembic downgrade`.
3. **Frontend routes**: Added behind Vite env var `VITE_BOOKING_ENABLED`.
4. **No changes to existing functionality**: Pure additive — new tables, new routes, new pages.
5. **Demo cleanup**: Future cron job to expire `is_demo=true` records older than N days (not in MVP scope).

## Open Questions

- [ ] Should the demo endpoint live in `booking.py` (`/v1/booking-demos`) or as a sub-resource on leads (`/v1/leads/{id}/booking-demo`)? Proposal shows both.
- [ ] What is the exact subdomain strategy for `booking.yoquelvis.dev`? Does the frontend build need a separate Vite config or is this handled by reverse proxy routing?
- [ ] Should confirmation emails use the existing `EmailService` directly or a new `BookingEmailService` with booking-specific templates?
