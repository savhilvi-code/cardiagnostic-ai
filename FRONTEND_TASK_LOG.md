# Frontend Task Log

## 2026-09-20 — Mobile Chat attachment visibility and video fallback

- Kept the selected-attachment action bar inside the mobile portrait viewport above the fixed composer, without horizontal overflow.
- Added an attachment-specific scroll target and bottom inset so every pending upload card becomes visible immediately in portrait.
- Preserved authoritative MIME routing and added a filename-extension fallback only when MIME is absent/generic, covering MP4/MOV/WebM/M4V without changing stored metadata.

## 2026-09-20 — Chat attachment UX completion and safe delete UI

- Added finite native-video loading states, explicit ready/playback-error outcomes, and an authenticated Blob-based Open PDF action for mobile browsers.
- Multi-file selection now creates one immediate independently updating upload card per file.
- Added owner attachment selection, confirmation and authenticated delete requests; failures reload authoritative Chat state and remain visible to the user.

## 2026-09-20 — Authenticated PDF and video attachment viewers

- Made persisted PDF and video Chat cards openable on touch and desktop using the existing authenticated attachment Blob fetch and preview modal.
- Added an embedded PDF viewer and native video player without public R2 URLs or backend changes; unsupported video codecs now show an explicit localized state.
- Playback currently downloads the full authenticated response to a browser Blob before opening; range streaming remains a future large-video optimization.

## 2026-09-20 — Authoritative Chat attachment restoration

- Restored persisted Chat attachments from each backend Message's `attachments` metadata and removed the browser localStorage attachment registry.
- Preserved pending local previews, upload UX, authenticated thumbnails and desktop/mobile lightbox behavior; multiple attachments render in backend relation order.
- Persisted file bytes still load only through the authenticated backend download endpoint.

## 2026-09-20 — Mobile Chat image preview activation

- Bound the existing persisted thumbnail to a direct pointer/click activation path: touch/pen opens on `pointerup`, while desktop and keyboard retain click behavior without duplicate opening.
- Full preview still resolves the private image through the existing authenticated backend download function; no storage/upload behavior changed.
- Cross-device restoration remains blocked by the current history contract, which does not return Message attachment metadata; the existing browser registry is not an authoritative backend source.

## 2026-09-20 — Chat image upload state and preview

- Added an immediate indeterminate uploading card for selected Chat files, with a local image thumbnail used only while the request is pending and an explicit failed state on errors.
- Persisted only safe `message_id`/`file_id` metadata from the existing upload response; restored image thumbnails and the larger preview fetch private bytes through the authenticated backend download endpoint.
- Added a compact image preview modal with close button, backdrop close and Escape support; no public R2 URL or binary is stored locally.

## 2026-09-20 — Live Flow trace-driven mapping

- Unified Trace, Graph, Replay, Copy Trace and Export TXT on one ordered projection of the selected request's saved `trace_events`.
- Removed invented `Event`/`Result`/`table_name` routes; events without real endpoints remain selectable and exportable as `UNMAPPED` instrumentation gaps.
- Graph activation now follows only saved `from_node` → `to_node` events in their real sequence.

## 2026-09-20 — Chat attachment final execution-path fix

- Kept the existing picker/change/upload implementation, made its file input visually hidden instead of `display:none`, and added a visible picker error fallback.
- The selected-file path now explicitly restores the existing chat session before its final `conversation_id` check, then uses the unchanged attachment POST; missing context and request failures remain visible through localized UI messages.
- Constrained and wrapped the disabled DTC row fully inside the compact popup.

## 2026-09-20 — Chat selected-file upload

- Moved chat-session synchronization to the existing post-selection upload path, so `conversation_id` is restored before `uploadChatAttachment` decides whether it can POST; picker opening remains synchronous and unchanged.
- Allowed the disabled code-diagnostics label to wrap inside the compact attachment popup.

## 2026-09-20 — Chat attachment picker and menu polish

- Removed the premature conversation-ID gate from the trusted menu click, so the existing hidden input always opens for photo/video/document; the existing upload-time context guard remains unchanged.
- Tightened the existing popup spacing/alignment and replaced the `+` glyph with a geometrically centered CSS-drawn plus while keeping code diagnostics disabled.

## 2026-09-20 — Chat attachment picker activation

- Kept the existing hidden input and upload handler, but now opens the system picker synchronously from the trusted `+` menu click so browser user activation is preserved.

## 2026-09-20 — Service/Repair attachments

- Enabled photo/video/document selection in the persisted Service/Repair modal; files upload only after backend returns the real `vehicle_events.id`.
- History loads attachment metadata per Service/Repair event and downloads through the authenticated backend. No Data URL or localStorage file persistence is used.
- All remains an aggregate filter only; no Vehicle relation or duplicate binary is created.

## 2026-09-20 — Persisted My Car Service/Repair

- Reused the existing Service modal for create/edit and switched new records from temporary `srv_*`/localStorage writes to authenticated `vehicle_events` POST/PUT responses.
- My Car state immediately uses the returned persisted event row and real `vehicle_events.id`; History continues reading the backend timeline with unchanged All/Maintenance/Repairs/Problems semantics.
- Legacy localStorage records remain untouched and are not migrated. The file control stays disabled because attachments are explicitly outside this block.

## 2026-09-20 — Chat attachment controls

- Connected the existing Chat `+` menu photo/video/document controls to the authenticated Message attachment endpoint; binaries remain private behind the backend and no file data enters localStorage.
- The UI requires an existing vehicle-scoped conversation because the approved backend flow attaches the binary to a persisted Message. Code diagnostics is visibly disabled as coming soon.
- My Car Service/Repair attachment work remains blocked: its legacy form still writes `srv_*` records and photo Data URLs to localStorage, while My Car V2 has no persisted create/edit flow. Active Problem is currently read-only in My Car, so no false relation was introduced.

## 2026-09-20 — Admin Knowledge private-file upload

- Enabled the existing Upload File mode in the Knowledge material form and connected it to the admin-only backend multipart endpoint after the Knowledge Item is saved.
- File upload uses authenticated `FormData`; applicability and URL/source provenance continue through their existing structured paths without binary duplication or frontend R2 access.

## 2026-09-17 — Admin Data Inspector Block 2

- Replaced the sparse Overview with real metric cards, database-composition bars, Search pipeline, problem/event/source distributions, recent activity, and a canonical PULS Data Flow diagram. Missing metrics render as ERROR rather than zero.
- Search Memory now formats object-valued query/context/result fields as readable summaries and keeps raw JSON secondary. Problem Trace presents human-readable relationship rows before raw details.
- Added a persisted desktop sidebar collapse control, icon rail, hover expansion and auto-collapse after section selection. Mobile keeps its existing full-width navigation behavior.
- Focused browser fixtures cover Dashboard structure, lazy message/run/trace loading, object rendering, sidebar collapse and the absence of mutating Inspector requests.

## 2026-09-17 — Admin shell and Knowledge Base Data Inspector V1

- Converted the existing Admin page to a persistent responsive left navigation shell with `Users` and `Knowledge Base`, while preserving the existing User Management controls and modals.
- Added the read-only Data Inspector views: Overview, Conversations, Problems, Vehicle Events, Search Memory, Sources, and Knowledge. Counts and rows come from authenticated backend endpoints; there are no fake metrics or production placeholders.
- Conversation messages and Search Episode runs load only when their parent row expands. Problem Trace loads on demand and visibly reports the missing direct Problem-to-Knowledge relation instead of inferring one.

## 2026-09-13

- Renamed the frontend "Request log" surface to `Confirmed cases` / `Подтверждённые кейсы` in navigation and page headings without changing its backend data source.
- Made the top-right PULS status auth-aware: guests now see the localized sign-in/register CTA that opens the existing auth modal, while signed-in users keep the existing quota/premium display.
- Moved request-details modal labels, link fallbacks, request type labels, status badges, and affected section descriptions into the existing `assets/js/app.js` i18n dictionary.
- Removed the circular help `?` buttons from Confirmed cases, Request history, Manuals, and Video; their `.page-help` descriptions are now always visible.

## 2026-07-16

- Restored the original PULS access gate for guests: unauthenticated users can no longer send chat requests, and the login/register modal opens instead of calling backend `/chat`.
- Restored the original splash behavior: startup screen no longer auto-hides on timer or on chat input focus, and the user must explicitly tap/click the splash icon to open the site. Idle re-show after inactivity remains active.

## 2026-07-17

- Restored the live frontend after an accidental broken UI sync so login, page scale and the composer visibility on non-PULS pages returned to the previous working behavior.
- Connected car photo upload to Supabase Storage `vehicle-photos`, persisted `photo_url` through backend `/api/vehicles`, and added user-facing upload error messages for missing bucket/policy cases.
- Refined the photo card without changing the surrounding page design: uploaded photos now fit the frame better, the inline attach label disappears once a photo exists, the image itself no longer reopens the file picker, and a dedicated bottom dropdown handles replace/delete actions.
- Added the technical-spec autoload button inside the specs card. It reuses the existing internet VIN lookup flow, fills the editable spec fields, and keeps the values synced with the vehicle save flow.
- Fixed vehicle-card draft autosave so typing VIN/year no longer spawns extra blank cars. The active draft is now reused during input, and duplicate empty placeholder cards are collapsed back to a single draft until the user explicitly presses `Add vehicle`.
- Fixed the `Add vehicle` draft flow after the autosave cleanup: one intentionally created blank card now stays active for editing, while stray inactive empty cards are still removed.
- Removed the duplicate top `Add vehicle` button from the `My cars` header, leaving vehicle creation only in the lower chip row next to saved vehicles.
- Switched the vehicle editor back to explicit-save behavior: typing in the form and `Decode VIN` now update only the current draft in the UI, while backend `/api/vehicles` writes happen only after the user presses `Save car`.
- Upgraded the `Load from internet` flow for the car draft: frontend now sends the current draft to backend `/api/vehicles/enrich`, so PULS can verify remaining fields, auto-fill missing specs, and immediately place a representative car photo into the draft before the user decides whether to save it.

## 2026-07-18

- Expanded frontend JDM identifier validation so short compact chassis numbers with one-letter prefixes, such as `E11321342`, are accepted by the browser and sent to backend lookup.
- Changed the JDM decode draft merge so a newly detected Japanese chassis result starts from a clean vehicle draft instead of inheriting stale brand/model/engine fields from the previously selected car.
- 2026-07-19: Fixed assistant chat bottom clearance so the latest answer scrolls above the fixed composer instead of hiding under it. Also updated the assistant scroll behavior to align the last message against the composer top during page-level scrolling in assistant mode.
- 2026-07-19: Updated the request-history list cards to show a short answer preview directly in the row instead of only the question title. This makes saved replies visible at a glance and reduces the false impression that the backend failed to save the answer.
- 2026-07-19: Restored an explicit visible scrollbar for the request-details modal. The small popup now keeps a stable vertical scroll area with its own styled track/thumb, so long saved answers remain obviously scrollable.
- 2026-07-19: Documented page-by-page frontend data ownership. The frontend architecture now explicitly separates production-backed pages (`My car`, `History`, `Journal`, quota/auth surfaces) from pages that still render demo/static data (`Videos`, `Manuals`, `DTC`, local service notes inside the vehicle card).
- 2026-07-19: Softened UI subtitles for pages that are not fully backend-backed yet. `Videos`, `Manuals`, `DTC`, and the service-notes subtitle inside `My car` no longer claim a stronger production persistence guarantee than the current implementation actually provides.
- 2026-07-19: Restored a clearly visible scrollbar for the fixed right-side assistant rail in desktop assistant mode. The sticky summary/source column now has its own stable gutter plus explicit track/thumb styling, so overflow on the small side panel remains visible instead of looking cut off.

## 2026-07-06

- Confirmed frontend still uses backend `/chat` and `/api/history`, reads `quota` from backend response, and does not write `diagnostic_requests` or use legacy `telegram_id` / `chat_id` fields.
- Reproduced the production UX issue: the startup splash could make the chat composer look unresponsive before the user dismissed it.
- Updated `assets/js/app.js` so the splash auto-hides shortly after load and also closes immediately when the chat input receives focus or pointer interaction.
- Updated localhost preview config to use `/api/chat` on the same origin and extended `serve.mjs` with a lightweight backend proxy so local frontend checks no longer depend on Render CORS for `localhost`.
- Bumped the `assets/js/app.js` cache-busting query in `index.html` so GitHub Pages clients receive the fresh frontend script after redeploy.
- Stopped frontend Auth/profile sync from reading legacy `users.requests_left`, `users.conversation_history`, and `users.car_info`, and stopped sending `conversation_history` in `/chat` payloads. Backend is now the single source of runtime chat context and quota.

## 2026-07-05

- Connected "My car" vehicle cards to backend `/api/vehicles`; LocalStorage remains only a UI cache/fallback after login.
- Frontend now sends the active vehicle label/year/engine/drive to `/chat` as `car_info` so backend can resolve `vehicles.id`.
- Deleting a vehicle in the UI calls backend delete for the personal card while shared solved cases remain stored by backend.
- Fixed logout privacy state: guest mode no longer reads cached request history or previous user's vehicle cards after logout + refresh.
- Scoped vehicle UI cache by authenticated user id and cleared legacy private cache keys on `puls-auth-change` logout.
- 2026-07-19: Strengthened the assistant right rail after live chat regressions. Clarification-style answers now clear stale `Итог: что проверить` / `Видео / ссылки по теме` content instead of reusing the previous response, and the desktop rail forces an internal visible scrollbar so the small side panel can actually scroll on Windows while the fixed composer is on screen.

## 2026-07-03

- Создана система документации для Codex по frontend.
- Добавлены ARCHITECTURE_FRONTEND.md, FRONTEND_CODEX_RULES.md, FRONTEND_TASK_LOG.md.
- Добавлен scripts/generate_frontend_architecture.py для обновления карты frontend-проекта.
- Убрана отправка telegram_id/chat_id из frontend-запросов к PULS.
- Удалены Telegram-упоминания из frontend README и генератора карты frontend API.
- Убрана прямая вставка diagnostic_requests из frontend после ответа PULS; история должна сохраняться backend-ом централизованно.
- Страница истории переведена на чтение через backend `/api/history`, а не напрямую из Supabase.
- Исправлена отправка сообщений на сайте: при отсутствии Supabase Auth создается локальный `web-guest-* auth_user_id`, поэтому кнопка отправки и Enter реально вызывают backend `/chat`.
- Обновлен frontend dev `server.js`: старый PostgreSQL/n8n mini-backend заменен proxy на backend FastAPI, без прямой записи `diagnostic_requests`.
- Обновлен cache-busting `assets/js/app.js` в `index.html` для GitHub Pages.
- 2026-07-19: Changed frontend default language boot behavior to English for first-time and incognito visitors. Updated `assets/js/app.js` so the app falls back to `en` when no saved language exists in localStorage, and changed `index.html` root `lang` attribute to `en` with a new cache-busting version for `app.js`. Tested by reviewing the startup language path; expected behavior is that `https://pulscar.co/` opens in English until the user explicitly switches language. Frontend commit hash: `2f70896`.

- 2026-07-20: Added the Settings support entry point and modal for PULS. Updated `index.html`, `assets/js/app.js`, and `assets/css/style.css` so both guests and signed-in users can open `Contact Support` / `Написать в поддержку`, enter `Subject`, `Message`, editable `Email address`, attach up to 3 images, and send the form to backend `POST /api/support`. The modal is fully bilingual (`en`/`ru`), prefills the email from the current auth profile when available, validates file count/type/size on the client, and shows a translated success state after submission. Updated `ARCHITECTURE_FRONTEND.md` and `FRONTEND_TASK_LOG.md`. Tested by reviewing the rendered markup/selectors, confirming the new support wiring in `assets/js/app.js`, and checking the touched frontend diff. Known limitation: browser-side validation is covered, but full live end-to-end submission still depends on the deployed backend route and Supabase Storage bucket being reachable in production.
- 2026-07-20: Corrected the VIN decode trigger in the `My car` editor. Updated `assets/js/app.js` so typing or leaving the `VIN / chassis` field no longer starts automatic lookup. Vehicle decoding now runs only after the user explicitly presses `Decode VIN / chassis`, while the input still shows readiness/validation status text. Updated `FRONTEND_TASK_LOG.md`. Tested by reviewing the event handlers around `#carVinInput` and `#carLookupBtn` plus checking the frontend diff.
- 2026-07-20: Confirmed the live frontend VIN behavior after deployment. On the production site, entering a VIN/chassis value no longer starts decoding automatically during typing; decoding starts only after pressing `Decode VIN / chassis`. The user manually verified the corrected behavior in the live `My car` editor.
- 2026-07-20: Polished the public frontend repository presentation by replacing the old prototype-oriented README with a production-facing overview for `pulscar.co`, without changing runtime code.
## 2026-09-16 — My Car V2 and current chat session

- Replaced the real My Car view with vehicle selection, compact identity, an explicit Add/Edit form, Overview/Data/History, structured problem details and a technical log. Connected existing V2 reads, soft delete and restore; retained photo storage architecture and photos in Trash.
- Removed Request History and Confirmed Cases from primary navigation and HTML views. Raw messages are never used as vehicle history.
- Added backend-message current-chat restoration with a centralized 12-hour inactivity window and a small per-user ID marker. Added existing vehicle_id/problem_id/conversation_id to chat requests; expiration does not delete data.
- Fixed active chat viewport and mobile navigation. Preserved backend quota display, API configuration, auth and Admin.
- Added isolated browser regression checks and documented exact Stage 4 gaps and verification limits in MY_CAR_V2_INTEGRATION.md. Backend/Supabase were not modified; all write-path tests use fixtures.

## 2026-09-17 — Phase A specification compatibility checkpoint

- Read V2 vehicle_specs.items parameter rows in My Car display and edit forms, preserving actual values on save. Legacy flat responses remain supported.
- Updated regression fixtures to the actual backend response shape; frontend V2 suite passed. Production test vehicle PULS-STABILIZATION-SPECS-20260917 saved and re-read 2.0 L / 206 kW through authenticated API and public.vehicle_specs. UI deployment verification follows this checkpoint.
- Backend main 403550a already fixed vehicle writes; real create/update, ownership, UUID, no duplicates, Admin count, F5 and logout/login verified. Failed UI save preserves its draft. No schema changes.

## 2026-09-17 — Phase B chat restoration

- Normalize canonical uppercase roles/content and use authoritative /chat conversation identity. Restore backend latest history on navigation and refresh regardless of cached marker. Transcript stays backend-only; 12-hour visibility rule retained.
- Frontend regression passed with actual canonical response shape. Phase A production UI confirmed 206 → 207 kW persisted after save/F5.

## 2026-09-17 — Stabilization Block 1 subscription UI

- Replaced the static Settings `Free — 5 requests` status with the authenticated quota returned by backend `GET /api/quota`, the same state already used by the top quota indicator. Settings now renders plan, limit, and remaining quota; the Pro offer remains static product copy.
- Focused browser fixtures verify Paid / 100 with 95 remaining and Free / 5 with 5 remaining. Backend subscription contract tests remain green. No backend, Supabase, schema, conversation, or diagnostic-flow changes were made.
