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

- Switched the live VIN/chassis lookup to backend `/api/vehicles/lookup` so the browser no longer guesses cars on its own.
- Added pending lookup confirmation metadata to the vehicle save flow: detected cars are saved as confirmed only after the user presses `Save car`.
- Added an ambiguous-result chooser for JDM chassis codes with multiple possible models, instead of auto-selecting one.
- Prevented `Load from internet` from overwriting brand/model/year/engine with speculative enrichment data; it now only fills technical specs and a missing photo in the draft.

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

