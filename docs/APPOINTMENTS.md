# Appointment Backend Requirements

This document explains the backend endpoints and business rules needed to power the owner appointments page in `frontend/src/pages/owner/AppointmentsPage.jsx`.

## 1) API Base

- Base URL prefix: `/api/v1`
- Appointment route group: `/api/v1/appointments`
- Auth required on every route: `Authorization: Bearer <access_token>`
- The router is protected by `requireAuth`, so unauthenticated requests are rejected before reaching the controller.

## 2) Appointment Status Model

The backend stores appointments with these statuses:

- `PENDING`
- `CONFIRMED`
- `DECLINED`
- `CANCELLED`

The frontend page currently groups appointments as:

- Upcoming: `Pending`, `Confirmed`
- Past: `Completed`, `Cancelled`

Note: `Completed` is used in the current UI mock, but it is not part of the backend `AppointmentStatus` enum. If the backend is the source of truth, the UI should either stop using `Completed` or the backend should add a completion flow.

## 3) Required Backend Endpoints

### 3.1 Book an appointment

`POST /api/v1/appointments`

Request body:

```json
{
  "propertyId": "prop_123",
  "startsAt": "2026-03-22T10:00:00.000Z",
  "endsAt": "2026-03-22T10:30:00.000Z",
  "note": "Please call me when you arrive"
}
```

Validation rules:

- `propertyId` is required.
- `startsAt` is required and must be a valid date-time.
- `endsAt` is required and must be a valid date-time.
- `note` is optional and limited to 500 characters.
- `endsAt` must be later than `startsAt`.

Successful response:

```json
{
  "status": "success",
  "data": {
    "appointment": {
      "id": "appt_123"
    }
  }
}
```

### 3.2 List appointments

`GET /api/v1/appointments`

Query params:

- `status` optional: `PENDING | CONFIRMED | DECLINED | CANCELLED`
- `propertyId` optional: filter by property
- `from` optional: ISO date-time lower bound on `startsAt`
- `to` optional: ISO date-time upper bound on `startsAt`

Role-based visibility:

- `renter` sees only appointments where `renterId = current user`
- `owner` sees only appointments where `ownerId = current user`
- `admin` sees all appointments

Successful response:

```json
{
  "status": "success",
  "data": {
    "appointments": []
  }
}
```

### 3.3 Update appointment status

`PATCH /api/v1/appointments/:id/status`

Request body:

```json
{
  "status": "CONFIRMED"
}
```

Allowed values:

- `CONFIRMED`
- `DECLINED`
- `CANCELLED`

Successful response:

```json
{
  "status": "success",
  "data": {
    "appointment": {
      "id": "appt_123"
    }
  }
}
```

### 3.4 Delete appointment

`DELETE /api/v1/appointments/:id`

Successful response:

```json
{
  "status": "success",
  "data": {
    "id": "appt_123"
  }
}
```

### 3.5 Update appointment note

`PATCH /api/v1/appointments/:id/note`

Request body:

```json
{
  "note": "Renter requested a short follow-up call after visit"
}
```

Validation rules:

- `note` is required.
- `note` must be a string with max length 500.

Authorization:

- Only the appointment owner or an admin can update the note.

Successful response:

```json
{
  "status": "success",
  "data": {
    "appointment": {
      "id": "appt_123"
    }
  }
}
```

## 4) Appointment Business Logic

### 4.1 Booking rules

The current backend booking flow in `backend/src/modules/appointments/service.ts` enforces these rules:

1. Only renters can book appointments.
2. The property must exist.
3. A renter cannot book an appointment for their own property.
4. A renter cannot create an overlapping appointment when they already have a `PENDING` or `CONFIRMED` appointment that intersects the requested time range.
5. The appointment is created with:
   - `propertyId`
   - `renterId`
   - `ownerId`
   - `startsAt`
   - `endsAt`
   - `note`

Time overlap check used by the backend:

- existing appointment starts before the new appointment ends
- and existing appointment ends after the new appointment starts

In other words, the backend blocks any intersecting time window for the same renter.

After creation, the backend:

- sends an email to the property owner if an email exists
- creates an `APPOINTMENT_BOOKED` notification for the owner
- writes an audit log entry for traceability

### 4.2 Status update rules

Only the property owner or an admin can change the appointment status.

When the new status is `CONFIRMED`, the backend also checks that the owner does not already have another confirmed appointment that overlaps the same slot.

If the slot is already taken, the backend returns a `409 Conflict`.

After a successful status update, the backend:

- creates an `APPOINTMENT_UPDATED` notification for the renter
- writes an audit log entry with the previous and new status

### 4.3 Delete rules

An appointment can be deleted by:

- the renter who booked it
- the owner of the property
- an admin

After deletion, the backend:

- notifies the other participant that the appointment was deleted
- creates an audit log entry

## 5) Data Returned to the UI

The backend selects and returns these appointment fields:

- `id`
- `propertyId`
- `renterId`
- `ownerId`
- `startsAt`
- `endsAt`
- `status`
- `note`
- `createdAt`
- `updatedAt`
- `property.id`, `property.title`, `property.address`
- `renter.id`, `renter.email`, `renter.first_name`, `renter.last_name`
- `owner.id`, `owner.email`, `owner.first_name`, `owner.last_name`

That payload is enough to drive the appointment list, filters, and detail cards on the owner page.

## 6) Frontend Integration Notes

The current owner appointments page is still using local mock state in `frontend/src/pages/owner/AppointmentsPage.jsx`.

To make it data-driven, the page should:

- fetch appointments with `GET /api/v1/appointments`
- call `PATCH /api/v1/appointments/:id/status` for accept/reject actions
- call `DELETE /api/v1/appointments/:id` for removal actions if needed
- call `PATCH /api/v1/appointments/:id/note` for the “Save Note” action

## 7) Recommended UI Mapping

For the owner page, the backend response can be mapped like this:

- renter name: `renter.first_name + renter.last_name` fallback to `renter.email`
- property name: `property.title`
- date/time: format `startsAt` and `endsAt`
- status badge: map backend status to UI badge color
- notes: use the `note` field from the appointment record

## 8) Summary

The appointment backend is a simple request/response flow with three core actions:

- book an appointment as a renter
- approve, decline, or cancel it as the owner or admin
- delete it as one of the participants or as admin

The most important business rule is time-slot protection: renters cannot double-book overlapping visits, and owners cannot confirm overlapping visits for the same time window.
