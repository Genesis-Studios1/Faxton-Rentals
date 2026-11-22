# Firestore-to-PostgreSQL migration audit

**Status:** inventory only; no runtime behavior changed.  
**App branch audited:** `staging` at `a3766bb857d3cefa0de9ca9fe55a0aa846b87b41`.  
**Backend implementation audited:** `Genesis-Studios1/Faxton-Backend`, branch `feature/cloudflare-r2-storage`, draft PR #4; notifications API work is tracked separately in draft PR #5.

## Executive finding

The backend is a partial foundation, not a Firestore replacement. The app's API base URL is intentionally empty, and its active data modules still import the Firebase client and Firestore SDK. Do not point users at the API or disable Firestore until each workflow below has an API implementation, frontend integration, migration/import, and end-to-end verification.

## Existing backend coverage

The current backend documents and registers routes for:

- Health checks.
- Authenticated uploads to Cloudflare R2, with upload records in PostgreSQL.
- Property listing CRUD/moderation and property media.
- Current-user profile/settings and admin profile lookup.
- Direct conversations, message paging/sending/editing, attachment references, and read state.

Firebase Authentication remains the identity provider. The API verifies Firebase ID tokens and resolves Firebase UIDs to PostgreSQL users. This is separate from the Firestore database migration.

## Frontend Firestore workflows still present

| Workflow / collection | Observed app behavior | Backend status | Migration requirement |
|---|---|---|---|
| `listings` | Public active listing reads; owner listing flows | Partial property API exists | Map legacy listing fields/statuses to property schema; integrate all listing create/edit/archive/moderation screens; verify public address privacy. |
| `users` | Account/profile, role, saved IDs, onboarding and verification data | Partial profile API; auth user resolver | Define authoritative role/verification/onboarding mapping; migrate saved listings and preserve existing Firebase UID links. |
| `profiles` | Public profile cards and verified badge sync | No public profile read API; admin profile API only | Add privacy-aware public profile endpoint; enforce profile visibility and verified badge authorization. |
| `viewings` | Request/list viewings; renter check-in/check-out, SOS, trusted contacts, sharing, cancellation, reschedule requests and post-viewing ratings; listing owner/agent can manage status | Missing | Model the full lifecycle and safety metadata; enforce renter vs listing-owner permissions and status transitions; do not reduce this to create/list only. Preserve legacy Firebase UID and listing-ID references. |
| `applications` | Rental application, move-in date, details, proposed rent and calculated amount; renter can withdraw while under review; listing owner can change status | Missing | Add schema and validation; derive owner and price from the authoritative listing rather than client input; enforce listing/tenant/owner relationships and explicit status transitions. Preserve legacy Firebase UID and listing-ID references. |
| `documents` | User-uploaded verification documents and deletion | Generic upload category exists; document workflow missing | Store metadata and R2 object references; enforce owner/admin access, immutable evidence rules and retention/deletion policy. |
| `tickets`, `ticketNotes` | Customer support tickets and staff-only internal notes | Missing | Add ticket lifecycle, staff roles, private notes and audit history. Keep internal notes inaccessible to customers. |
| `conversations`, nested `messages` | Direct/support conversations, message attachments, reactions, pins, typing, unread/read/delivery state | Partial basic direct messaging | Preserve legacy thread IDs/participants and add real-time transport; implement reactions, pins, typing, delivery/read receipts, staff inbox and support conversations. |
| `presence` | Online status and last seen | Missing | Add expiring presence/heartbeat design; avoid treating stale online flags as live presence. |
| `calls`, nested `ice` | WebRTC call records, offer/answer, ICE candidates, logs, incoming-call listeners | Missing | Build authenticated call-session and signaling endpoints plus real-time fanout; authorize only call participants; short retention and cleanup. Do not expose TURN secrets to clients. |
| `blocks` | Block/unblock and call/message restrictions | Missing | Add unique blocker/blocked relation and enforce it in conversation and call creation, not only in UI. |
| `offers` | Offer/negotiation workflow; also included in the user's data export | Missing | Inspect full offer UI and rules; model state transitions, listing ownership and participant permissions. |
| `tenancies` | Tenancy records included in the user's data export | Missing | Inspect tenancy UI/rules; define owner/tenant access, lifecycle, and links to accepted applications/offers. |
| `records` | Rent/payment ledger records included in the user's data export | Missing | Model ledger entries as auditable financial records; enforce tenant/owner/admin permissions and immutable payment history. |
| `maintenance` | Maintenance requests and history included in the user's data export | Missing | Add request lifecycle, append-only history and controlled media references. |
| `notices` | Property notices addressed to tenants | Missing | Add recipient-scoped notices with tenant membership checks and read state. |
| `paymentProofs` | Tenant-submitted payment proof/receipt records | Missing | Add private evidence metadata, R2 uploads, immutable proof records and owner/admin review. |
| `dataRequests` | Client-reported export event | Missing | Replace with server-audited data export/delete request workflow; client-side event is not proof of completed export. |
| `serviceRequests` | Customer home-service requests; staff status/private-note updates | Missing | Add service-request schema, customer create/list/cancel and staff assignment/status operations. |
| `notifications` | In-app notifications (rules cover this collection) | PostgreSQL table and authenticated list/read API are present in draft backend PR #5; not merged or frontend-integrated | Add trusted server-side event producers, migrate legacy notifications, integrate frontend list/read actions and define push delivery separately. |
| `reports`, `feedback` | User reports and call/app feedback | Missing | Add authenticated creation, moderation queues, rate limits and data retention. |
| `staffEvents` | Signup event stream for staff dashboard | Missing | Add server-generated audit/event records; never trust client-supplied staff identity. |
| `config/ice`, `config/payments`, `config/owner` | TURN settings, bank transfer instructions, owner bootstrap/identity | Missing | Move privileged configuration to server-side secrets/config; provide narrow admin APIs. Never return TURN provider credentials to ordinary users. |
| `waitlist` | Website waitlist collection | Not confirmed as app-backend scope | Determine whether this remains a separate marketing-site workflow before migrating it. |

## Additional workflow findings (reviewed 2026-11-22)

The existing Firestore rules show that viewings and applications are not simple request records. Viewings include renter safety/check-in data, SOS, trusted contacts, cancellation, rescheduling and one-time ratings; listing owners can change viewing status. Applications are visible to the renter, listing owner and admins; the renter may withdraw only while the application is `Under review`, while the listing owner manages status. The API must derive listing ownership from the database and must not trust client-supplied `ownerUid`, applicant identity, calculated amount or status.

The legacy helpers in `public/js/store.js` define basic create/list payloads, but repository search did not find confirmed UI call sites for `addViewing`, `addApplication`, `myViewings` or `myApplications`. Before frontend integration, trace the actual booking/application screens and all status updates; do not assume those helper payloads represent the complete live workflow.

## Recommended implementation order

1. **Identity and migration foundation:** stable Firebase UID ↔ PostgreSQL user mapping, role/verification reconciliation, idempotent import tooling, per-collection counts and mismatch reports.
2. **Core marketplace:** listings/property media, profiles/public cards, saved listings, viewings and applications.
3. **Customer operations:** documents/KYC, service requests, support tickets and staff-only notes.
4. **Messaging:** legacy conversation mapping, attachment migration, reactions/pins/read/delivery state, then real-time delivery.
5. **Calls:** participant-authorized signaling, ICE candidate exchange, call logs and Metered TURN credential minting.
6. **Admin and platform operations:** offers, reports, feedback, notifications, staff events and privileged configuration.
7. **Cutover:** full staging import, role-based end-to-end tests, data reconciliation, backup/rollback rehearsal, then a separately approved production cutover.

## Data migration and cutover safeguards

- Export Firestore data before any destructive change; retain an immutable backup.
- Use deterministic source identifiers and a source-ID mapping table so imports can be rerun safely.
- Convert Firestore timestamps, document references, nested message subcollections and arrays/maps explicitly; do not stringify them blindly.
- Migrate media bytes from Firebase Storage to R2 with checksum/size verification and update references only after the R2 object is confirmed.
- Reconcile counts by collection and verify parent-child relationships, ownership, roles, statuses and attachment links.
- Run dual-read or controlled shadow comparison in staging before switching writes.
- Keep Firebase Auth until a separate auth migration is designed and tested.
- Do not disable Firestore, delete Firebase resources, or route production traffic to the new backend as part of this inventory.

## Known launch blockers already identified in backend PR #4

- Staging Firebase Admin credentials previously failed token verification and must be checked privately in Render.
- Staging Neon migration history/schema and R2 upload credentials need live verification.
- The current public property response includes exact `addressLine` and internal user UUID fields; decide and test a privacy-safe public representation.
- Profile visibility is stored but not enforced by a public profile endpoint.
- Real-time messaging and WebRTC signaling are not implemented.
- Rate limiting currently uses per-process memory and does not share counters across instances.

## Source files inspected

- App: `public/js/api-config.js`, `public/js/store.js`, `public/js/calls.js`, `public/js/services.js`, `public/js/mydata.js`, `firestore.rules`.
- Backend: `README.md`, `src/server.ts`, `src/routes/properties.ts`, `src/routes/profiles.ts`, `src/routes/conversations.ts`, `migrations/001_initial_schema.sql` and migrations 002–007.
- This is a code inventory, not a claim that every Firestore collection or workflow has been exhaustively enumerated. The remaining UI modules and rules should be checked as each workflow is implemented.
