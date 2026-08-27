# School Fees & Communication App

One installable web app (PWA) that Android users add to their home screen, with role-based access: administrators manage students and invoices, parents view balances, pay by MoMo, and read announcements. Later it can be wrapped for the Play Store without rewriting anything.

## Roles

- **Admin** — full access: students, classes, fee items, invoices, payments, announcements, parent accounts.
- **Parent** — sees only their own children: balances, invoice history, payment, announcements.

Roles are stored server-side in a dedicated roles table, never on the profile, so they can't be changed from the browser.

## Screens

**Shared**
- Sign in / sign up (email + password), password reset
- Role-aware home that routes admins and parents to their own dashboard
- Installable on Android: app icon, name, splash colors

**Admin**
- Dashboard: total outstanding, collected this term, recent payments, unpaid count
- Students: list with search and class filter; add/edit student; link to parent account(s)
- Classes and fee items (e.g. Tuition, Books, Transport) with amounts per term
- Invoices: create for one student, a whole class, or all students; each invoice has line items, due date, and status (unpaid / part-paid / paid / overdue)
- Payments: see all payments, and manually record cash/bank payments
- Announcements: compose a message to all parents or one class; parents get it in-app and by email

**Parent**
- Children list with current balance each
- Invoice detail: line items, amount due, due date, payment history
- Pay now: choose MoMo (MTN / Telecel / AirtelTigo) or card, complete on Paystack, return to a confirmation screen
- Announcements feed and notification badge

## Payments (Paystack)

- Parent taps Pay; the server creates a Paystack transaction and returns the checkout URL.
- Paystack handles MoMo prompts and cards.
- A webhook endpoint verifies Paystack's signature and is what actually marks the invoice paid — never the browser redirect. This makes payment recording tamper-proof and correct even if the parent closes the app mid-payment.
- Every payment is recorded with reference, channel, amount, and timestamp for reconciliation.
- Needs your Paystack secret and public keys (test keys first, live keys when you're ready). I'll ask for them securely at the point they're needed.

## Notifications

- In-app feed for invoices, payment receipts, and announcements, with unread counts.
- Email delivery for the same events (invoice issued, payment received, new announcement).
- Web push and SMS can be added later without changing the data model.

## Build order

1. Backend enabled, database schema, roles, and access rules
2. Auth + role-based routing and app shell
3. Admin: students, classes, fee items
4. Admin: invoices and balances
5. Parent: dashboard, invoices, balances
6. Paystack checkout + webhook + receipts
7. Announcements and in-app notifications
8. Email delivery
9. PWA install polish (icon, manifest, offline-friendly shell)

## Technical notes

- Stack: React + TanStack Start, Tailwind, Lovable Cloud (Postgres, auth, storage, server functions).
- Tables: `profiles`, `user_roles`, `students`, `classes`, `guardians` (parent↔student links), `fee_items`, `invoices`, `invoice_lines`, `payments`, `announcements`, `announcement_reads`, `notifications`. Row-level security on every table plus explicit grants; parents are scoped through the `guardians` link, admins through a `has_role()` security-definer function.
- Balances are derived from invoices minus confirmed payments rather than stored, so they can't drift.
- Paystack calls happen only in server functions; the webhook lives at a public API route with signature verification.
- Amounts stored as integer pesewas (GHS minor units) to avoid float rounding errors.
- Play Store wrapping later: Capacitor around the same build; no app rewrite needed.

## Not included initially

Report cards / grading, attendance, timetables, staff payroll, and offline data entry. Any of these can follow once the fee and communication core is live.
