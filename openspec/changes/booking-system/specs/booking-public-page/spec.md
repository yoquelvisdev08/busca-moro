# Booking Public Page Specification

## Purpose

Customer-facing booking interface. Visitors land on `/{business-slug}/booking`, select a service, pick an available slot, submit their details, and receive a confirmation.

## Requirements

### Requirement: Service Selection Display

The page SHALL display all active services for the business with name, duration, and price.

#### Scenario: Business with multiple active services

- GIVEN a business has 3 active services and 1 inactive
- WHEN a customer visits the booking page
- THEN only the 3 active services are shown with their duration and price

#### Scenario: Business with no active services

- GIVEN a business has zero active services
- WHEN a customer visits the booking page
- THEN a message is displayed indicating no services are available

### Requirement: Available Slot Calculation

The system MUST calculate available time slots from the business weekly schedule minus existing bookings, respecting timezone.

#### Scenario: Slot not blocked by existing booking

- GIVEN a business has availability Mon 09:00–17:00 America/Santo_Domingo
- AND no existing bookings on a given Monday
- WHEN a customer views that Monday's slots
- THEN 30-minute slots appear from 09:00 to 17:00 in the business timezone

#### Scenario: Slot blocked by existing booking

- GIVEN a booking exists Mon 10:00–10:30
- WHEN a customer views slots
- THEN the 10:00 slot does NOT appear

#### Scenario: Date exception blocks availability

- GIVEN a date exception marks a specific date as unavailable
- WHEN a customer views that date's slots
- THEN no slots are shown

### Requirement: Booking Submission

The system MUST create a booking atomically — validating slot availability at write time to prevent double-booking.

#### Scenario: Successful booking

- GIVEN an available slot on a specific date/time
- WHEN a customer submits name, phone, email, service, and slot
- THEN the booking is created with status "confirmed"
- AND a confirmation email is sent to the customer
- AND a notification email is sent to the business owner

#### Scenario: Concurrent double-booking prevention

- GIVEN two customers submit for the same slot simultaneously
- THEN only one booking succeeds
- AND the other receives a 409 Conflict response

#### Scenario: Past slot rejection

- GIVEN a slot time is in the past
- WHEN a customer attempts to book it
- THEN the system returns a validation error

### Requirement: Booking Confirmation Page

After successful booking, the system MUST display a confirmation page with booking details.

#### Scenario: Confirmation displays booking info

- GIVEN a booking was just created
- WHEN the confirmation page renders
- THEN it shows service name, date, time, business name, and customer details

### Requirement: Mobile-First Responsive Design

The booking page MUST render correctly on viewports from 320px to 1440px.

#### Scenario: Mobile viewport rendering

- GIVEN a customer on a 375px-wide device
- WHEN they visit the booking page
- THEN all controls are usable without horizontal scrolling

### Requirement: Sub-2-Second Page Load

The booking page MUST achieve Time to Interactive under 2 seconds on a 3G connection.

#### Scenario: Cold visit performance

- GIVEN a customer with a 3G connection
- WHEN they visit a booking URL
- THEN the page is interactive within 2 seconds