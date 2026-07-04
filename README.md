# CarDiagnostic AI
PULS AI is an AI-powered vehicle diagnostic platform that combines automotive knowledge, real repair cases, DTC interpretation, service manuals, and conversational diagnostics.

## Topics

`ai`, `automotive`, `car-diagnostics`, `vehicle-diagnostics`, `fastapi`, `python`, `openai`, `claude`, `supabase`


Статический прототип сайта для GitHub Pages.

## Как открыть

Откройте `index.html` в браузере.

## Как опубликовать на GitHub Pages

1. Создайте новый репозиторий на GitHub.
2. Загрузите в него `index.html` и `README.md`.
3. Откройте `Settings -> Pages`.
4. В `Build and deployment` выберите `Deploy from a branch`.
5. Выберите ветку `main` и папку `/root`.
6. Нажмите `Save`.

Через 1-2 минуты GitHub даст ссылку вида:

`https://username.github.io/repository-name/`

## Подключение n8n

В файле `index.html` найдите:

```js
const N8N_WEBHOOK_URL = "";
```

Вставьте URL webhook из n8n:

```js
const N8N_WEBHOOK_URL = "https://your-n8n-domain/webhook/car-diagnostic";
```

Сайт отправляет в webhook JSON:

```json
{
  "message": "текст пользователя",
  "vehicle": {
    "model": "Nissan X-Trail T32",
    "year": 2016,
    "engine": "2.0 dCi",
    "drive": "4WD",
    "fuel": "Дизель"
  }
}
```

Ожидаемый ответ от n8n:

```json
{
  "answer": "ответ AI ассистента"
}
```

Также подойдут поля `message` или `output`.

## Подключение Spline

В файле `index.html` найдите:

```js
const SPLINE_SCENE_URL = "";
```

Вставьте ссылку на опубликованную Spline-сцену:

```js
const SPLINE_SCENE_URL = "https://my.spline.design/your-scene/";
```

После этого 3D-сцена появится в правой карточке AI ассистента.
