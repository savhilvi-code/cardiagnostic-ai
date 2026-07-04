# Frontend Architecture

## Краткое описание

CarDiagnostic AI frontend - статический frontend-проект для сайта PULS. Он состоит из HTML-страниц, CSS-стилей и JavaScript-модулей, которые управляют интерфейсом, навигацией, авторизацией, Supabase-клиентом и запросами к backend FastAPI.

Frontend не принимает диагностические решения и не пишет `diagnostic_requests` напрямую. Чат отправляет сообщения в backend `/chat`, история читается из backend `/api/history`, а quota берется из ответа backend. Для незалогиненного пользователя используется локальный `web-guest-* auth_user_id`, чтобы кнопка отправки и Enter всегда доходили до backend; после Supabase Auth используется настоящий `auth_user_id`.

## Структура папок

```text
- cardiagnostic-ai-github/
  - .nojekyll
  - ARCHITECTURE_FRONTEND.md
  - CNAME
  - FRONTEND_CODEX_RULES.md
  - FRONTEND_TASK_LOG.md
  - README.md
  - assets/
    - css/
      - style.css
    - img/
      - puls-logo.png
    - js/
      - api.js
      - app.js
      - auth.js
      - config.js
      - router.js
      - supabaseClient.js
    - pages/
      - car.js
      - dtc.js
      - history.js
      - login.js
      - manuals.js
      - profile.js
      - puls.js
      - service.js
      - settings.js
      - subscription.js
      - videos.js
  - index.html
  - pages/
    - about.html
    - privacy.html
    - terms.html
  - robots.txt
  - scripts/
    - generate_frontend_architecture.py
  - serve.mjs
  - server.js
  - sitemap.xml
```

## HTML-страницы

- `index.html`
- `pages/about.html`
- `pages/privacy.html`
- `pages/terms.html`

## CSS-файлы

- `assets/css/style.css`

## JavaScript-файлы

- `assets/js/api.js`
- `assets/js/app.js`
- `assets/js/auth.js`
- `assets/js/config.js`
- `assets/js/router.js`
- `assets/js/supabaseClient.js`
- `assets/pages/car.js`
- `assets/pages/dtc.js`
- `assets/pages/history.js`
- `assets/pages/login.js`
- `assets/pages/manuals.js`
- `assets/pages/profile.js`
- `assets/pages/puls.js`
- `assets/pages/service.js`
- `assets/pages/settings.js`
- `assets/pages/subscription.js`
- `assets/pages/videos.js`
- `serve.mjs`
- `server.js`

## Pages

- `pages/about.html`
- `pages/privacy.html`
- `pages/terms.html`

## Assets

- `assets/css/style.css`
- `assets/img/puls-logo.png`
- `assets/js/api.js`
- `assets/js/app.js`
- `assets/js/auth.js`
- `assets/js/config.js`
- `assets/js/router.js`
- `assets/js/supabaseClient.js`
- `assets/pages/car.js`
- `assets/pages/dtc.js`
- `assets/pages/history.js`
- `assets/pages/login.js`
- `assets/pages/manuals.js`
- `assets/pages/profile.js`
- `assets/pages/puls.js`
- `assets/pages/service.js`
- `assets/pages/settings.js`
- `assets/pages/subscription.js`
- `assets/pages/videos.js`

## API-вызовы к backend

- `assets/js/api.js` - `GET /api/history?user_id=...`
- `assets/js/api.js` - `POST /chat`
- `assets/js/app.js:2` - /chat`; - `const CHAT_API_URL = PULS_CONFIG.CHAT_API_URL || `${String(PULS_CONFIG.API_BASE_URL || "https://puls-backend-t3sn.onrender.com").replace(/\/$/, "")}/chat`;`
- `assets/js/app.js` - `POST /chat` через `CHAT_API_URL`
- `assets/js/app.js` - `GET /api/history?user_id=...`
- `assets/js/app.js` - quota отображается из `data.quota`
- `assets/js/config.js:3` - https://puls-backend-t3sn.onrender.com/chat - `CHAT_API_URL: "https://puls-backend-t3sn.onrender.com/chat",`
- `server.js` - локальный dev proxy: `/api/health`, `/api/history`, `/api/chat` проксируются в backend без прямой записи в Supabase

## Использование Supabase

- `assets/js/supabaseClient.js:11` - createClient - `window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);`
- Supabase на frontend используется для Auth/profile sync. История и диагностические записи сохраняются backend-ом.

## Поток frontend-запроса

```mermaid
flowchart LR
    Browser[Browser] --> Frontend[Frontend HTML/CSS/JS]
    Frontend --> APIConfig[API Config]
    APIConfig --> Chat[POST /chat]
    APIConfig --> History[GET /api/history]
    Chat --> Backend[Backend FastAPI]
    History --> Backend
    Backend --> Response[Response]
    Response --> UI[UI]
```
