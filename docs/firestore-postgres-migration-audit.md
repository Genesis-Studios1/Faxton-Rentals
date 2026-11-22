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
| `profiles` | Public profile cards and verified badge sync | Privacy-aware public profile endpoint added in backend draft PR #5; not merged or deployed; frontend still needs integration | Wire public profile cards to the API and define verified-badge semantics from authoritative verification data. |
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
| `suggestions` | Users submit product suggestions; admin/support review and move status through `New`, `Reviewed`, `Planned` and `Done` | Missing | Add customer submission and staff-only review endpoints; keep submitter identity server-derived and preserve status history. |
| `appReleases` | Signed-in users read published app-release notes and platform download metadata; admins publish/update/delete releases | Missing | Add public-to-authenticated read policy for published releases and admin-only publishing; validate file metadata and avoid treating client-provided download URLs as trusted binaries. |
| `staffEvents` | Signup event stream for staff dashboard | Missing | Add server-generated audit/event records; never trust client-supplied staff identity. |
| `config/ice`, `config/payments`, `config/owner` | TURN settings, bank transfer instructions, owner bootstrap/identity | Missing | Move privileged configuration to server-side secrets/config; provide narrow admin APIs. Never return TURN provider credentials to ordinary users. |
| `waitlist` | Website waitlist collection | Not confirmed as app-backend scope | Determine whether this remains a separate marketing-site workflow before migrating it. |

## Additional workflow findings (reviewed 2026-11-22)

The existing Firestore rules show that viewings and applications are not simple request records. Viewings include renter safety/check-in data, SOS, trusted contacts, cancellation, rescheduling and one-time ratings; listing owners can change viewing status. Applications are visible to the renter, listing owner and admins; the renter may withdraw only while the application is `Under review`, while the listing owner manages status. The API must derive listing ownership from the database and must not trust client-supplied `ownerUid`, applicant identity, calculated amount or status.

The live UI call sites are present in `public/js/pages.js`, `public/js/views.js` and `public/js/dash.js`. The booking flow sends tour type, phone, note, agent identity/display metadata and optional trusted-contact details; it then attempts to create a conversation message. The application flow sends applicant contact/address details, occupants, employment/income fields, document filenames and currently embeds attached ID/income documents as data URLs in Firestore. Applications may also carry an accepted `offerId` and negotiated rent. The renter bookings/application/payment/document screens read these records, while owner/agent dashboards load listing enquiries and update viewing status. These are concrete compatibility requirements, not optional future enhancements.


### Detailed viewing/application compatibility notes

- Viewing creation currently includes `tour`, `phone`, `note`, `agentUid`, `agentName`, `agentPhoto`, `agentVerified` and optional `trusted` contact data in addition to listing/date/time fields. The client currently supplies these values; the API must validate and derive authoritative agent/listing ownership server-side.
- Viewing safety operations include renter check-in/check-out, SOS, trusted contact, `sharedWith`, cancellation, reschedule requests and a one-time rating. Owner/agent status updates are used by the dashboard. Model each operation as an explicit endpoint/transition and audit the actor; do not expose a generic unrestricted PATCH.
- Application submission currently includes personal/contact data, current address, occupants, employment status, employer, job title, income band, document labels and attached ID/proof-of-income content. The ID document is required by the current UI. The backend must move file bytes to private R2 objects and store only verified upload/document references in PostgreSQL; do not carry base64 data URLs into JSON rows or logs.
- Accepted rental offers can change the application rent and attach an `offerId`. The backend must verify the offer belongs to the authenticated applicant and the same listing, is accepted, and that the agreed rent matches the offer record. Calculate totals server-side from authoritative pricing rules.
- Listing owner access must come from the database relationship (`properties.owner_user_id` / manager relationship), never from submitted `ownerUid` or `agentUid`. Preserve the source Firestore listing ID in an explicit unique legacy-ID mapping until every client and imported record uses the PostgreSQL UUID. Backend draft PR #5 now adds nullable `properties.legacy_firestore_id` with a unique partial index in migration `008_property_legacy_firestore_ids.sql`.
- Existing Firestore rules allow an applicant to withdraw only while `Under review`; listing owners can manage application status. Encode allowed transitions and prevent owners from editing applicant-provided details or documents.


## Viewing, application and offer workflow requirements (verified against current UI)

The renter and owner UI exposes more than simple create/list records, so these are the required backend contracts before frontend cutover.

### Viewings
- The renter creates a request with listing, requested date/time, tour type, contact phone, note, agent identity snapshot and optional trusted-contact details. The current UI also attempts to start a conversation with a booking message.
- Owner/agent dashboards review requests and update the decision; the renter can cancel only while the request is still `Requested`.
- A renter can ask to reschedule while a request is `Requested` or `Confirmed`. The request is currently a nested `reschedule` object and is communicated through Messages; it is not a confirmed schedule change until the owner/agent responds.
- For confirmed in-person tours, the UI supports trusted-contact sharing, check-in, check-out, overdue prompts, SOS alerts (including optional coarse location), emergency calling and a one-time agent rating.
- Trusted-contact details are stored in browser local storage and copied into a viewing record when shared. Treat them as private personal data; do not return them to public listing or agent-wide list responses unless the viewer is authorized and the specific field is needed.
- Current Firestore rules restrict the renter to named update fields, but accept broad map payloads for `checkIn`, `checkOut`, and `sos`. PostgreSQL should replace this with explicit actions and server timestamps: request, confirm/decline, cancel, ask-to-reschedule, respond-to-reschedule, share-contact, check-in, check-out, raise/resolve SOS, and submit one rating. Validate actor, current state, schedule window, and one-time transitions; append an immutable event/audit row for each safety action.

### Applications
- The application captures applicant name/contact/address, occupants, employment and income details, move-in date, optional note, and required ID document plus optional proof of income.
- The current UI may attach an accepted offer ID and negotiated rent. The backend must re-check that the offer belongs to the authenticated applicant and same listing, is accepted, and that the agreed rent equals the persisted offer amount.
- Application creation currently copies listing title/area/image and client-calculates the move-in total. In the new API, listing and applicant identity must be resolved server-side; pricing and total must be computed from authoritative listing/fee data, never trusted from the client.
- The current application payload can include base64 document data URLs. Replace these with private R2 object uploads and verified upload/document references, with strict owner/applicant/authorized staff access. Do not store raw document bytes in PostgreSQL JSON or expose them through normal application list responses.
- Applicant withdrawal is allowed only while `Under review`. Owner/agent status decisions must be a finite transition set with audit history; owner-side edits must not overwrite applicant-submitted details or document references.

### Offers
- Offers support renter proposals, owner/renter counter-offers, acceptance, decline and renter withdrawal, with a visible negotiation history and a turn indicator.
- Current offer creation snapshots asking rent and fee inputs from the listing, while client code calculates the negotiated move-in total. The backend must snapshot authoritative listing price/fees and compute totals itself.
- Enforce one active negotiation per renter/listing (matching current UI behavior), amount bounds (currently at least half and below asking rent for initial offers; counters are bounded between half and asking rent), correct turn, participant identity and legal state transition.
- Store negotiation entries as append-only offer events rather than trusting a client-submitted replacement `history` array. Accepting an offer must atomically freeze the agreed amount and record who accepted it.

## Firestore rules cross-check (reviewed 2026-11-22)

The current `firestore.rules` contains explicit matches for `appReleases`, `suggestions`, and the nested `calls/{callId}/ice/{candidateId}` signaling subcollection. These are included above as separate migration requirements; `ice` is nested under calls, not a standalone top-level collection. Published app releases are readable by signed-in users while write operations are admin-only. Suggestions are customer-created but readable/reviewable by admin or support, with staff updates limited to the status field. The historic `waitlist` collection is admin-readable only and all client writes are disabled, so it should remain a legacy archive unless a separate marketing workflow is deliberately brought into scope.

The rules also confirm that `documents` are immutable after creation and applicant payment-proof uploads are tied to an existing application, listing, applicant and application state. The existing client currently stores document/proof/message media as base64 data URLs in Firestore. The target design should migrate these to private R2 objects with PostgreSQL metadata and short-lived authorized download access; ordinary application, ticket or message list responses must not expose document bytes.

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
- The public property response previously included exact `addressLine`, coordinates and internal owner UUIDs. Backend draft PR #5 removes those fields from public list/detail responses and adds regression assertions; private owner/admin responses retain the full listing details. The privacy fix, migration 008, and the public detail regression test passed backend CI runs [45056399817](https://github.com/Genesis-Studios1/Faxton-Backend/actions/runs/45056399817) and [45059089895](https://github.com/Genesis-Studios1/Faxton-Backend/actions/runs/45059089895). They remain in draft PR #5 and are not merged or deployed.
- Profile visibility enforcement is implemented in the new public profile endpoint on backend draft PR #5; its CI validation and frontend integration are still pending.
- Real-time messaging and WebRTC signaling are not implemented.
- Rate limiting currently uses per-process memory and does not share counters across instances.

## Source files inspected

- App: `public/js/api-config.js`, `public/js/store.js`, `public/js/calls.js`, `public/js/services.js`, `public/js/mydata.js`, `firestore.rules`.
- Backend: `README.md`, `src/server.ts`, `src/routes/properties.ts`, `src/routes/profiles.ts`, `src/routes/conversations.ts`, `migrations/001_initial_schema.sql` and migrations 002–008.
- This is a code inventory, not a claim that every Firestore collection or workflow has been exhaustively enumerated. The remaining UI modules and rules should be checked as each workflow is implemented.
