# Owner Agreements — Backend API Endpoints

This document lists the backend endpoints required by the owner-facing agreement pages (`AgreementsPage.jsx`, `AgreementDetailPage.jsx`). Authentication required: Bearer token (JWT). Authorization: owner or admin role.

---

## List agreements

- Method: GET
- Path: /api/owner/agreements
- Query params:
  - `page` (int, optional)
  - `limit` (int, optional)
  - `search` (string, optional) — property, renter, or id
  - `status` (string, optional)
- Response: 200
  {
  "items": [{
  "id": "string",
  "property": { "id":"", "title":{"en":""}},
  "renter": { "id":"", "name":"" },
  "monthlyRent": number,
  "deposit": number,
  "durationMonths": number,
  "status": "string",
  "startDate": "ISODate",
  "paymentDay": string,
  "totalPaid": number,
  "nextPaymentDue": "ISODate|null"
  }],
  "meta": { "page": number, "limit": number, "total": number }
  }

Notes: supports filtering, paging and CSV export via `/api/owner/agreements/export?format=csv`.

---

## Get agreement detail

- Method: GET
- Path: /api/agreements/:agreementId
- Response: 200
  {
  "id": "string",
  "property": { id, title, address, location },
  "owner": { id, name, email, phone },
  "renter": { id, name, email, phone },
  "monthlyRent": number,
  "currency": "string",
  "securityDeposit": number,
  "startDate": "ISODate",
  "endDate": "ISODate",
  "durationMonths": number,
  "paymentDay": string,
  "status": "string",
  "paymentStatus": "pending|proof_uploaded|confirmed",
  "payments": [ { id, amount, currency, status, proofUrl, paidAt, confirmedAt, stripeId } ],
  "messagesConversationId": "string"
  }

---

## List payments for an agreement

- Method: GET
- Path: /api/agreements/:agreementId/payments
- Query: `page`, `limit`
- Response: 200 — paged list of payment objects (see above)

---

## Create payment (upload proof)

- Method: POST
- Path: /api/agreements/:agreementId/payments
- Content-Type: multipart/form-data
- Body fields:
  - `amount` (number)
  - `currency` (string, optional)
  - `proof` (file) — image/pdf of receipt
  - `stripeId` (string, optional)
- Behavior: creates Payment record with status `proof_uploaded` (or `pending` if no proof) and stores `proofUrl`.
- Response: 201 — created payment object

---

## Confirm a payment (owner/admin)

- Method: PATCH
- Path: /api/payments/:paymentId/confirm
- Body (json): { "confirmedAt": "ISODate?", "stripeId": "string?" }
- Behavior: sets status => `confirmed`, sets `confirmedAt` and returns updated payment.
- Response: 200 — updated payment

---

## Download payment receipt

- Method: GET
- Path: /api/payments/:paymentId/receipt
- Response: 200 — file content (image/pdf) or 302 redirect to `proofUrl`

---

## Confirm agreement activation (owner action)

- Method: PATCH
- Path: /api/agreements/:agreementId
- Body (json): { "status": "active|terminated|pending_owner|pending_renter", "paymentStatus": "confirmed|pending|proof_uploaded" }
- Behavior: update agreement status and paymentStatus
- Response: 200 — updated agreement

---

## Terminate agreement (owner)

- Method: POST
- Path: /api/agreements/:agreementId/terminate
- Body: { "reason": "string" }
- Behavior: set status to `terminated`, create audit log/notification
- Response: 200 — { "success": true, "agreement": { ... } }

---

## Get agreement PDF / download contract

- Method: GET
- Path: /api/agreements/:agreementId/pdf
- Response: 200 — application/pdf

---

## Messaging (agreement-related conversation)

- Get messages
  - Method: GET
  - Path: /api/conversations/:conversationId/messages
  - Query: `page`, `limit`
- Send message
  - Method: POST
  - Path: /api/conversations/:conversationId/messages
  - Body: { "content": "string", "replyToId": "string?" }
  - Response: 201 — message

Note: frontend links to `/owner/messages` — ensure conversationId is present on agreement detail (see `messagesConversationId`).

---

## Renter info

- Method: GET
- Path: /api/users/:userId
- Response: 200 — { id, first_name, last_name, email, phone, image }

---

## Export agreements CSV

- Method: GET
- Path: /api/owner/agreements/export
- Query: `format=csv` (default), filters same as list endpoint
- Response: 200 — `text/csv` attachment

---

## Auth & Errors

- All endpoints require `Authorization: Bearer <token>` header.
- Common responses: 401 Unauthorized, 403 Forbidden (wrong role), 404 Not Found, 400 Validation Error, 500 Server Error.

---

Implementation notes

- Use `multipart/form-data` for file uploads and return stored URL in `proofUrl`.
- Payment creation should optionally accept a `stripeId` if the frontend integrates with Stripe webhooks.
- Keep payment statuses consistent with Prisma enum: `confirmed`, `proof_uploaded`, `pending`.
- Emit notifications when payments are uploaded/confirmed and when agreements change status.

---

If you want, I can add example curl commands and request/response JSON samples for each endpoint.
