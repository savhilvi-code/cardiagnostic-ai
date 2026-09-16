# My Car V2 — Stage 3 delivery and Stage 4 boundaries

Implemented on `main`, from `47f7f21`, 2026-09-16. This document describes the final frontend behavior; it supersedes older My Car/history descriptions in the architecture notes.

## Architecture and ownership

The existing static application remains the only application: `index.html`, `assets/css/style.css`, the shared `assets/js/app.js` controller, Supabase Auth and authenticated fetch helpers. `assets/pages/car.js`, previously a placeholder, now controls the real My Car page. `assets/js/chat-session.js` owns the current visible chat lifecycle. Admin, API base configuration, auth implementation and backend were not changed.

The old frontend used persistent edit forms, an in-memory vehicle store, an older question/answer history adapter, and local service-note/demo rendering. My Car V2 reads structured backend records instead. Request History and Confirmed Cases buttons and page sections were removed from the HTML; the navigation allowlist excludes both routes. No backend conversations/messages were deleted. Legacy unexposed helpers remain in app.js to avoid an unrelated refactor; My Car V2 does not invoke their local-storage service persistence.

## Operational against existing contracts

The deployed OpenAPI document and local backend source were inspected read-only. No speculative routes were added.

| Feature | Existing contract |
| --- | --- |
| Active vehicle list / creation | `GET /api/vehicles`, `POST /api/vehicles` |
| Identity, photo URL and supported specs | `GET /api/vehicles/{id}`, `PUT /api/vehicles/{id}` |
| VIN / frame enrichment | Existing NHTSA full-VIN lookup and `POST /api/vehicles/enrich` |
| Active and completed problems | `GET /api/vehicles/{id}/problems?status=all` |
| Structured problem summary | `GET /api/problems/{id}` |
| Technical log | `GET /api/vehicles/{id}/timeline` plus dated problem records |
| Move to Trash | Existing soft-delete `DELETE /api/vehicles/{id}` |
| Trash / restoration | `GET /api/vehicles?include_trashed=true`, `POST /api/vehicles/{id}/restore` |
| Current messages | `GET /api/history`, `GET /api/conversations/{id}/messages` |
| Chat context | Existing `/chat` request fields `vehicle_id`, `problem_id`, `conversation_id` |

Overview shows open/in-progress problem cards and the technical log. Data uses expandable categories with real returned fields and honest empty states. History has All/Maintenance/Repairs/Problems filters; problem conclusions and confirmation data are included. Raw conversation messages never enter the technical history.

The editor opens only on Add/Edit. Make and model are required by the current backend; incomplete specifications and failed identifiers never block manual creation. The entered frame/VIN is retained. Automatic lookups fill blanks and keep existing owner values. Saves are acknowledged only after successful backend responses; failure keeps the draft visible. Generation, notes, country and city are retained through the adapter. New backend UUIDs are preserved rather than replaced with temporary draft IDs.

The existing temporary adapter still maps make → `brand`, engine_code → `engine`, drivetrain → `drive`, fuel_type → `fuel` because these are the actual current API payload fields. It does not introduce a second canonical model. The backend has one `vin` input for VIN/frame, integer mileage and no mileage-unit field; the current interface retains kilometre display. Separate chassis_number/mileage_unit support requires the backend contract below.

Existing photo upload uses the existing `vehicle-photos` bucket and photo_url adapter. This task did not create buckets or upload live files. Moving a vehicle to Trash no longer deletes its photo. The frontend reads `restore_until` and disables recovery after that time instead of inventing a retention date.

Async vehicle/detail results check user and vehicle identity before rendering. Account changes clear private views; lookup results cannot spill into a different vehicle draft.

## Current chat session

`CHAT_SESSION_TTL_HOURS = 12` is centralized in chat-session.js. Activity means a persisted user/assistant message, not page refresh or merely opening the site. The latest message timestamp determines expiration. The displayed messages are the contiguous tail after the latest 12-hour gap, scoped to one conversation. F5 and reopening within the window reload backend `role`, `message_text`, `created_at` records. At or beyond 12 hours the visible chat is empty; the next send omits conversation_id. No delete/update request is sent for expired messages.

A per-authenticated-user local marker stores only conversation/vehicle/problem IDs and activity time. Message content remains exclusively backend-authoritative. Without a marker, `/api/history` supplies the latest active conversation. With a marker, the specific conversation endpoint supplies up to 100 messages. The API currently exposes no pagination; the frontend does not claim to load unlimited transcripts.

The chat response omits conversation_id. After a successful send, the frontend resolves it through the existing message read API, matching the recent user message and vehicle/problem scope. That is a compatibility fallback, not a new API contract. Concurrent sends from other devices or an unavailable history read can prevent reliable ID resolution; Stage 4 should return the accepted IDs directly from `/chat`.

Continuing a problem opens a fresh visible discussion with the vehicle/problem IDs and an in-memory copy of the structured summary. It does not replay historical raw dialogue. Only supported IDs are sent to `/chat`; arbitrary summary fields are not added to its payload. Structured reasoning/restoration remains Stage 4/5 work. A pending problem marker can survive refresh independently of the normal visible-chat TTL.

Thus message persistence and timestamps are backend-backed; the visibility rule and ID marker are frontend policy. No backend session-expiry feature was introduced.

Active chat sets `chat-active`, hides the large vehicle hero and uses a viewport-height flex layout with an internally scrolling message area. Messages start near the top; the existing composer stays at the bottom. Empty chat retains its starting state. Mobile uses a left drawer, an upper-left hamburger and closes after navigation; desktop keeps the left navigation.

## Exact Stage 4 requirements

1. **Manual technical log writes:** timeline has a GET endpoint, but no public create/update event route. “Add entry” explains that recording is unavailable; it does not save locally or claim success. Expose an authenticated, vehicle-scoped event write contract with accepted event types, date, mileage, description and structured data before enabling the form.
2. **Canonical identity contract:** expose/confirm make, engine_code, drivetrain, separate vin/chassis_number and mileage_unit, including round-trip behavior. Remove legacy adapter aliases only after that contract exists.
3. **Primary vehicle:** no primary flag or operation is exposed. The action is disabled; no fake MAIN badge appears.
4. **Richer technical passport:** current supported flat specs are displacement, power, torque, engine_type, cylinders, emissions and tank. Recommended catalog values, actual installed consumables, provenance and persistent owner overrides lack an exposed contract. Category/Recommended/Used sections are honest empty states where data is absent.
5. **Chat identity and pagination:** return accepted conversation_id, vehicle_id and problem_id in ChatResponse; add pagination if restoring more than the current 50/100 message limits is required. Preserve authoritative message timestamps/last activity and define cross-device current-session selection.
6. **Structured problem continuation:** validate end-to-end that the backend reasoning layer uses the supported problem_id/vehicle_id, retrieving a compact summary and keeping problem lifecycle independent from visible chat. Frontend context/IDs are ready; Intelligence V2 was not implemented.
7. **Recovery enforcement:** local backend source soft-deletes for 30 days, but its restore function does not enforce restore_until. The frontend disables expired recovery; backend enforcement must be implemented separately. No lifecycle schema or backend code was changed here.

## Verification and limits

`scripts/test-frontend-v2.cjs` uses Playwright with isolated auth/API fixtures and runs the real static application through serve.mjs. Every external request is intercepted. It covers startup, quota, auth/login/logout, removed navigation, empty state, failed VIN/manual entry, failed save, multiple vehicles, selection isolation, supported specs/owner-field preservation, tabs/filtering, structured problem details, problem-to-chat IDs, F5, 0/0.5/5/12/13-hour boundaries, non-deletion on expiry, a fresh send without old conversation_id, desktop/mobile chat geometry, Trash/restore, mobile drawer and overflow. Screenshots were inspected at 1440×960 and 390×844.

JavaScript syntax and git diff whitespace checks are also required. Example test command with Playwright on NODE_PATH:

```text
node scripts/test-frontend-v2.cjs
```

CHROME_PATH optionally points to an installed Chrome/Chromium executable. SCREENSHOT_DIR optionally captures screenshots. Tests do not mutate production, Supabase, or backend files. Actual production login, vehicle writes, photo upload/storage policy and backend reasoning were not exercised with a real account; those remain deployment smoke checks with authorized test data.

The frontend preview servers forward the existing problem/message reads with bearer auth. serve.mjs also uses fileURLToPath so static files resolve on Windows. No production API URL changed.
