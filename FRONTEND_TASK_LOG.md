# Frontend Task Log

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
