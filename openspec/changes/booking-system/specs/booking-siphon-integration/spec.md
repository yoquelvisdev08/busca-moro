# Booking Orion Integration Specification

## Purpose

Connects the booking system to the existing Orion pipeline: Scout flags leads without booking systems, a demo generator creates working booking pages from lead data, and Closer injects demo links into cold emails.

## Requirements

### Requirement: Scout Booking Opportunity Detection

When Scout detects `HasBooking=false`, the lead SHALL be flagged as a booking demo candidate in the API.

#### Scenario: Lead flagged as booking candidate

- GIVEN Scout processes a lead and HasBooking=false
- WHEN the lead is upserted to the API
- THEN `commercial_signals` includes "booking_demo_candidate"
- AND `revenue_signal` is updated to "services" if not already higher

#### Scenario: Lead with existing booking not flagged

- GIVEN Scout processes a lead and HasBooking=true
- WHEN the lead is upserted
- THEN "booking_demo_candidate" is NOT appended to commercial_signals

### Requirement: Demo Generator Endpoint

The API MUST expose `POST /v1/booking-demos` to create a fully functional demo booking page from lead data.

#### Scenario: Create demo from lead

- GIVEN a lead ID with business name and industry
- WHEN `POST /v1/booking-demos` is called with { lead_id }
- THEN a BookingBusiness is created with slug derived from the lead domain
- AND industry-appropriate services are auto-populated (e.g., barber → corte, barba)
- AND a default weekly availability schedule is set (Mon–Sat reasonable hours)
- AND the response includes `demo_url` and `demo_id`
- AND the demo page is fully functional (real bookings can be made)

#### Scenario: Demo from missing lead

- GIVEN a non-existent lead ID
- WHEN `POST /v1/booking-demos` is called
- THEN the system returns 404

#### Scenario: Demo slug collision

- GIVEN a business already exists with slug "barberia-juan"
- WHEN a demo is generated for a lead whose domain resolves to the same slug
- THEN the system appends a numeric suffix (e.g., "barberia-juan-2")

### Requirement: Industry Template Services

The demo generator MUST auto-populate services based on industry classification.

#### Scenario: Barber industry template

- GIVEN an industry of "barber" or "barbería"
- WHEN a demo is generated
- THEN default services include: Corte (30min), Barba (20min), Corte + Barba (45min)

#### Scenario: Dental industry template

- GIVEN an industry of "dental" or "dentista"
- WHEN a demo is generated
- THEN default services include: Limpieza (60min), Consulta (30min), Blanqueamiento (45min)

#### Scenario: Unknown industry falls back to generic

- GIVEN an industry that has no template
- WHEN a demo is generated
- THEN a single generic "Consulta" service (30min, price 0) is created

### Requirement: Demo to Paid Conversion

Demo pages MUST have an upgrade path from demo to production.

#### Scenario: Demo page displays upgrade CTA

- GIVEN a booking page created from a demo
- WHEN a visitor views the page
- THEN a subtle CTA is present linking to a signup or contact page

#### Scenario: Demo expiry cleanup

- GIVEN a demo business with `is_demo=true` and `expires_at` in the past
- WHEN a cleanup job runs
- THEN the demo business and its data are soft-deleted
- AND the demo URL returns 410 Gone

### Requirement: Closer Email Demo Injection

When generating a cold email for a lead flagged as "booking_demo_candidate", the Closer MUST include the demo booking link.

#### Scenario: Demo link in cold email

- GIVEN a lead with "booking_demo_candidate" in commercial_signals
- AND a demo booking page exists for that lead
- WHEN the Closer generates a cold email
- THEN the email body includes the demo URL with personalized intro text

#### Scenario: Lead without demo link

- GIVEN a lead flagged as "booking_demo_candidate" but no demo exists yet
- WHEN the Closer generates a cold email
- THEN the email is generated WITHOUT a demo link (graceful degradation)