# Frontend Task Log

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
