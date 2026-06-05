# Booking Business Configuration Specification

## Purpose

Data model and API for managing business profiles, service catalogs, and availability schedules. All time values stored in UTC with timezone conversion at the display layer.

## Requirements

### Requirement: Business Profile

A business MUST have a unique slug, name, contact info, and timezone.

#### Scenario: Create business with valid data

- GIVEN valid name, slug, phone, email, and timezone
- WHEN a business is created
- THEN it is stored and retrievable by slug

#### Scenario: Duplicate slug rejection

- GIVEN a business with slug "barberia-juan" exists
- WHEN another business with slug "barberia-juan" is created
- THEN the system returns a 409 Conflict

#### Scenario: Timezone-aware display

- GIVEN a business in "America/Santo_Domingo" timezone
- WHEN availability is requested
- THEN all times are displayed in that timezone

### Requirement: Service Catalog

A business MUST have zero or more services, each with name, duration_minutes, price, and active flag.

#### Scenario: Active services listed for booking

- GIVEN a business with 2 active and 1 inactive service
- WHEN the booking page requests services
- THEN only the 2 active services are returned

#### Scenario: Service with zero price

- GIVEN a business creates a service with price = 0
- WHEN the service is saved
- THEN it is stored and displayed as "Gratis" (free)

### Requirement: Weekly Availability

A business MUST define weekly recurring availability per day_of_week with start_time and end_time.

#### Scenario: Set weekly schedule

- GIVEN a business sets Mon–Fri 09:00–17:00, Sat 09:00–13:00, Sun closed
- WHEN slots are calculated for a given week
- THEN slots appear only within those day/time ranges

#### Scenario: Overlapping availability update

- GIVEN a business updates Mon availability from 09:00–17:00 to 10:00–18:00
- WHEN the update is saved
- THEN existing bookings at 09:00–10:00 remain valid (no retroactive cancellation)

### Requirement: Date Exceptions

A business MAY define date-specific overrides that block or modify availability.

#### Scenario: Block a holiday

- GIVEN a business adds a date exception for Dec 25 as "closed"
- WHEN slots are calculated for Dec 25
- THEN no slots appear

#### Scenario: Extended hours override

- GIVEN a business adds a date exception for Dec 24 as "open 08:00–20:00"
- WHEN slots are calculated for Dec 24
- THEN slots appear from 08:00–20:00 (replacing the normal weekly schedule)

### Requirement: Booking CRUD

The system MUST support creating, listing, and cancelling bookings with double-booking prevention via DB constraint.

#### Scenario: List bookings by date range

- GIVEN a business has bookings on Jan 5, 6, 7
- WHEN bookings are requested for Jan 6–7
- THEN only bookings on those dates are returned, ordered by time

#### Scenario: Cancel a booking

- GIVEN a confirmed booking
- WHEN the cancellation endpoint is called
- THEN the booking status changes to "cancelled"
- AND the slot becomes available again

#### Scenario: DB constraint prevents double-booking

- GIVEN two concurrent requests for the same slot
- WHEN both reach the database
- THEN a UNIQUE constraint on (business_id, service_id, date, start_time) rejects the second

### Requirement: Email Notifications

The system MUST send confirmation emails via Resend (existing integration).

#### Scenario: Customer confirmation email

- GIVEN a booking is created
- WHEN the system sends email
- THEN an email is sent to the customer with service, date, time, and business name
- AND the email uses the configured Resend API key

#### Scenario: Business owner notification

- GIVEN a booking is created
- WHEN the system sends email
- THEN an email is sent to the business owner with customer name, phone, and booking details