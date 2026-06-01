const N8N_WEBHOOK_URL = "https://auto-diagnost.app.n8n.cloud/webhook/a8c9c31d-1ae8-4bea-aae3-fbc30909bca3";
const SPLINE_SCENE_URL = "";

    const iconMap = {
      bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 4v4M8 13h.01M16 13h.01M7 21h10M3 11v4M21 11v4"/></svg>',
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
      journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
      history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/><path d="M12 7v5l3 2"/></svg>',
      car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 13l2-5h12l2 5"/><rect x="3" y="13" width="18" height="6" rx="2"/><path d="M7 19v2M17 19v2M7 16h.01M17 16h.01"/></svg>',
      service: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 7l3-3 3 3-3 3zM4 20l6-6M6 4l14 14M4 10l6-6"/></svg>',
      file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/></svg>',
      play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/></svg>',
      settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3-.2-.1a1.7 1.7 0 0 0-2 .2 1.7 1.7 0 0 0-.8 1.5V22h-3.6v-.3a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.2.1-2-3 .1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1.1H4v-3.6h.3a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3 .2.1a1.7 1.7 0 0 0 2-.2A1.7 1.7 0 0 0 10.4 3V2h3.6v1a1.7 1.7 0 0 0 .9 1.5 1.7 1.7 0 0 0 1.9-.3l.2-.1 2 3-.1.1a1.7 1.7 0 0 0-.3 1.9c.2.7.8 1.1 1.5 1.1h.3V14h-.3a1.7 1.7 0 0 0-1.5 1z"/></svg>',
      calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
      engine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 8h8l3 3v5h-3l-2 3H9l-2-3H4v-5h3z"/><path d="M9 5h6M12 5v3M20 12h2M2 12h2"/></svg>',
      drivetrain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h8M8 18h8M6 8v8M18 8v8"/></svg>',
      fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9v18H6z"/><path d="M15 8h2l2 2v8a2 2 0 0 0 4 0v-6l-3-3"/><path d="M8 7h5"/></svg>'
    };

    const requests = [
      ["Гул под капотом на 2000–3000 оборотах", "Возможные причины: износ подшипника генератора, натяжитель ремня, помпа и др.", "Сегодня, 10:42", "Решено"],
      ["Горит Check Engine", "Ошибка P0420 — эффективность катализатора ниже порога. Рекомендована диагностика выхлопной системы.", "Вчера, 18:15", "Решено"],
      ["Дым из выхлопной трубы", "Возможные причины: износ маслосъемных колпачков, турбина, система EGR.", "12 мая, 14:30", "Решено"],
      ["Быстро разряжается аккумулятор", "Проверить генератор, утечки тока и состояние АКБ. Рекомендована нагрузочная проверка.", "8 мая, 09:12", "Решено"],
      ["Пинки при переключении передач", "Проверить масло в вариаторе, адаптацию CVT, износ ремня или шкивов.", "5 мая, 16:45", "Решено"],
      ["Стук в подвеске спереди справа", "Рекомендована проверка стойки стабилизатора, опорного подшипника и шаровой опоры.", "2 мая, 11:20", "Решено"]
    ];

    const services = [
      ["Замена моторного масла и масляного фильтра", "Масло: 5W-30 Nissan Genuine Oil. Фильтр: оригинальный Nissan", "Сегодня, 10:30", "98 500 км", "violet", "🛢"],
      ["Замена ремня ГРМ с комплектом", "Ремень ГРМ, ролики, натяжитель, помпа. Производитель: Gates", "24 марта 2024", "90 120 км", "green", "⚙"],
      ["Замена воздушного фильтра", "Фильтр воздушный двигателя. Производитель: Mann", "24 марта 2024", "90 120 км", "", "▥"],
      ["Замена передних тормозных колодок", "Колодки передние. Производитель: Brembo", "12 февраля 2024", "86 780 км", "orange", "◎"],
      ["Замена топливного фильтра", "Фильтр топливный. Производитель: Nissan", "10 ноября 2023", "80 450 км", "violet", "▣"],
      ["Обслуживание кондиционера", "Заправка фреоном, проверка герметичности", "5 августа 2023", "74 230 км", "cyan", "❄"]
    ];

    const dtc = [
      ["P0171", "Слишком бедная смесь (Bank 1)", "Система управления двигателем зафиксировала слишком бедную топливно-воздушную смесь.", "Активная", "danger"],
      ["P0401", "Недостаточный поток системы рециркуляции ОГ (EGR)", "Обнаружен недостаточный поток выхлопных газов через клапан рециркуляции.", "Сохраненная", "warn"],
      ["P0202", "Неисправность цепи форсунки цилиндра 2", "Обрыв или короткое замыкание в цепи управления форсункой второго цилиндра.", "Сохраненная", "warn"]
    ];

    const manuals = ["Сервисный мануал", "Мануал по автохимии", "Мануал по дворникам", "Мануал по расходникам", "Тормозная система", "Руководство по эксплуатации", "Электрооборудование", "Система охлаждения", "Подвеска и рулевое"];
    const videos = ["Замена воздушного фильтра Укажите машину", "Замена моторного масла и фильтра Укажите мотор", "Замена передних тормозных колодок", "Замена щеток стеклоочистителя", "Замена цепи ГРМ на Nissan X-Trail Укажите мотор", "Диагностика ошибок с помощью OBD2", "Замена салонного фильтра", "Как снять и заменить аккумулятор"];

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));
    const LANGUAGE_STORAGE_KEY = "puls_language_v1";

    const i18n = {
      en: {
        "brand.subtitle": "Your AI assistant for car diagnostics",
        "system.ready": "PULS works for you 24/7",
        "system.freeQuota": "PULS: {remaining} of {limit} requests",
        "system.premium": "PULS Premium: no limit",
        "hero.car": "Select car",
        "hero.year": "Year",
        "hero.yearValue": "Select year",
        "hero.engine": "Engine",
        "hero.engineValue": "Select engine",
        "hero.drive": "Drive",
        "hero.driveValue": "Select drive",
        "hero.fuel": "Fuel type",
        "hero.fuelValue": "Select fuel",
        "nav.car": "My car",
        "nav.journal": "Request log",
        "nav.history": "Request history",
        "nav.dtc": "Errors (DTC)",
        "nav.service": "Service",
        "nav.manuals": "Manuals",
        "nav.video": "Video",
        "nav.settings": "Settings",
        "sound.title": "Noise diagnostics",
        "sound.subtitle": "Like Shazam,<br>but for your car",
        "sound.listening": "Listening...",
        "sound.link": "Record problem sound",
        "sound.text": "Speak or play the noise and I will help identify it",
        "assistant.subtitle": "Ask any question about your car",
        "assistant.demoAnswer": "This looks like a problem with auxiliary engine components. Possible causes: alternator bearing wear, belt tensioner pulley, water pump, or drive belt.",
        "assistant.demoActions": "What you can do:",
        "assistant.demoChecks": "• Check the belt and pulleys<br>• Listen with a stethoscope or long screwdriver<br>• Check pulley and bearing play",
        "assistant.checksTitle": "Summary: what to check",
        "assistant.checksEmpty": "After PULS answers, key checks will appear here.",
        "assistant.linksTitle": "Videos / related links",
        "assistant.linksEmpty": "Links to videos, manuals, and n8n materials will appear here later.",
        "assistant.linksFoundEmpty": "Related links will appear here when PULS finds materials.",
        "assistant.watchVideo": "Watch video",
        "assistant.loading": "PULS is analyzing your request...",
        "assistant.authRequired": "Please sign in or register to ask PULS questions.",
        "assistant.error": "Could not get a response from n8n. Check the webhook URL, CORS, and Respond to Webhook node.",
        "car.title": "My car",
        "car.subtitle": "Information about your car and available materials",
        "car.infoTitle": "Car information",
        "car.model": "Model:",
        "car.year": "Year:",
        "car.engine": "Engine:",
        "car.drive": "Drive:",
        "car.fuel": "Fuel:",
        "car.transmission": "Transmission:",
        "car.transmissionValue": "Select transmission",
        "car.vinValue": "Enter VIN",
        "car.quickTitle": "Quick access",
        "car.quickService": "Maintenance schedule",
        "car.quickSchemes": "Component diagrams",
        "car.quickTorque": "Torque specs",
        "car.quickElectrical": "Wiring diagrams",
        "car.quickFuses": "Fuses",
        "car.specTitle": "Technical specifications",
        "journal.title": "Request log",
        "journal.subtitle": "History of questions and received solutions",
        "history.title": "Request history",
        "history.subtitle": "Your recent PULS requests",
        "dtc.title": "Errors (DTC)",
        "dtc.subtitle": "Diagnostic trouble codes for your car",
        "dtc.clear": "Clear all",
        "dtc.found": "3 errors found.",
        "dtc.warning": "It is recommended to check and fix errors for correct vehicle operation.",
        "service.title": "Service",
        "service.subtitle": "Maintenance history and completed work",
        "service.add": "Add record",
        "manuals.title": "Manuals and guides",
        "manuals.subtitle": "Detailed service guides and recommendations",
        "video.title": "Video",
        "video.subtitle": "History of all videos provided in the chat",
        "settings.title": "Settings",
        "settings.subtitle": "Manage your account, subscription, and app",
        "settings.profile": "Profile",
        "settings.subscription": "Subscription",
        "settings.notifications": "Notifications",
        "settings.languageRegion": "Language and region",
        "settings.appLanguage": "App language",
        "settings.units": "Units",
        "settings.unitsValue": "km, °C",
        "settings.timezone": "Time zone",
        "subscription.freeStatus": "Status: Free — 5 requests",
        "subscription.plan": "PULS Pro subscription: 100 requests for $15.",
        "notifications.service": "Service reminders",
        "notifications.diagnostics": "Diagnostics and errors",
        "notifications.content": "New videos and manuals",
        "notifications.updates": "Promotions and updates",
        "common.on": "On",
        "common.off": "Off",
        "common.filter": "Filter",
        "common.close": "Close",
        "search.requests": "Search requests",
        "search.manuals": "Search manuals",
        "search.video": "Search videos",
        "composer.placeholder": "Describe the problem or ask a question...",
        "composer.attachPhoto": "Attach photo",
        "composer.sendVideo": "Send video",
        "composer.dtc": "Code diagnostics",
        "profile.guest": "Guest",
        "profile.signIn": "Sign in to your account",
        "profile.supabaseMissing": "Supabase is not configured",
        "profile.user": "PULS user",
        "profile.emailMissing": "Email is missing",
        "auth.open": "Sign in / Register",
        "auth.logout": "Log out",
        "auth.title": "PULS account",
        "auth.description": "Sign in or register by email to connect your history, subscription, and devices.",
        "auth.newUserHint": "New user? Enter your email and password, then click Register.",
        "auth.password": "Password",
        "auth.passwordPlaceholder": "Minimum 6 characters",
        "auth.login": "Sign in",
        "auth.register": "Register",
        "auth.statusReady": "Enter email and password.",
        "auth.statusConfig": "Add Supabase URL and anon key in assets/js/supabaseClient.js.",
        "auth.enterEmail": "Enter email.",
        "auth.enterPassword": "Enter password.",
        "auth.shortPassword": "Password must be at least 6 characters.",
        "auth.registerSuccess": "Registration successful. Check your email to confirm.",
        "toast.dtc": "Code diagnostics section opened.",
        "toast.voice": "Voice input can be connected to Web Speech API or n8n.",
        "toast.demo": "This is a demo button. It can be connected to n8n, uploads, or a materials database."
      },
      ru: {
        "brand.subtitle": "Ваш AI-помощник для диагностики автомобиля",
        "system.ready": "PULS работает для вас 24/7",
        "system.freeQuota": "PULS: {remaining} из {limit} запросов",
        "system.premium": "PULS Premium: без лимита",
        "hero.car": "Укажите машину",
        "hero.year": "Год выпуска",
        "hero.yearValue": "Укажите год",
        "hero.engine": "Двигатель",
        "hero.engineValue": "Укажите мотор",
        "hero.drive": "Привод",
        "hero.driveValue": "Укажите привод",
        "hero.fuel": "Тип топлива",
        "hero.fuelValue": "Укажите топливо",
        "nav.car": "Мой автомобиль",
        "nav.journal": "Журнал запросов",
        "nav.history": "История запросов",
        "nav.dtc": "Ошибки (DTC)",
        "nav.service": "Сервис и ТО",
        "nav.manuals": "Мануалы",
        "nav.video": "Видео",
        "nav.settings": "Настройки",
        "sound.title": "Диагностика по шуму",
        "sound.subtitle": "Как Shazam, только<br>для вашего авто",
        "sound.listening": "Слушаю...",
        "sound.link": "Запись звука неполадки",
        "sound.text": "Говорите или воспроизведите шум — я распознаю и помогу",
        "assistant.subtitle": "Задайте любой вопрос о вашем автомобиле",
        "assistant.demoAnswer": "Похоже на проблему со вспомогательными узлами двигателя. Вероятные причины: износ подшипника генератора, ролик натяжителя ремня, помпа или приводной ремень.",
        "assistant.demoActions": "Что можно сделать:",
        "assistant.demoChecks": "• Проверьте состояние ремня и роликов<br>• Послушайте шум стетоскопом или длинной отверткой<br>• Проверьте люфт роликов и подшипников",
        "assistant.checksTitle": "Итог: что проверить",
        "assistant.checksEmpty": "После ответа PULS здесь появится краткий список ключевых проверок.",
        "assistant.linksTitle": "Видео / ссылки по теме",
        "assistant.linksEmpty": "Здесь позже будут появляться ссылки на видео, мануалы и материалы из n8n.",
        "assistant.linksFoundEmpty": "Ссылки по теме появятся здесь, когда PULS найдет материалы.",
        "assistant.watchVideo": "Смотреть видео",
        "assistant.loading": "PULS анализирует запрос...",
        "assistant.authRequired": "Войдите или зарегистрируйтесь, чтобы задавать вопросы PULS.",
        "assistant.error": "Не получилось получить ответ от n8n. Проверьте URL webhook, CORS и Respond to Webhook node.",
        "car.title": "Мой автомобиль",
        "car.subtitle": "Информация о вашем автомобиле и доступные материалы",
        "car.infoTitle": "Информация об автомобиле",
        "car.model": "Модель:",
        "car.year": "Год выпуска:",
        "car.engine": "Двигатель:",
        "car.drive": "Привод:",
        "car.fuel": "Топливо:",
        "car.transmission": "КПП:",
        "car.transmissionValue": "Укажите КПП",
        "car.vinValue": "Укажите VIN",
        "car.quickTitle": "Быстрый доступ",
        "car.quickService": "Регламент ТО",
        "car.quickSchemes": "Схемы узлов",
        "car.quickTorque": "Моменты затяжки",
        "car.quickElectrical": "Электросхемы",
        "car.quickFuses": "Предохранители",
        "car.specTitle": "Технические характеристики",
        "journal.title": "Журнал запросов",
        "journal.subtitle": "История обращений и полученных решений",
        "history.title": "История запросов",
        "history.subtitle": "Ваши недавние запросы и обращения к PULSу",
        "dtc.title": "Ошибки (DTC)",
        "dtc.subtitle": "Диагностические коды неисправностей вашего автомобиля",
        "dtc.clear": "Удалить все",
        "dtc.found": "Найдено 3 ошибки.",
        "dtc.warning": "Рекомендуется проверить и устранить ошибки для корректной работы автомобиля.",
        "service.title": "Сервис и ТО",
        "service.subtitle": "История технического обслуживания и выполненных работ",
        "service.add": "Добавить запись",
        "manuals.title": "Мануалы и руководства",
        "manuals.subtitle": "Подробные руководства и рекомендации по обслуживанию",
        "video.title": "Видео",
        "video.subtitle": "История всех видеороликов, предоставленных в переписке",
        "settings.title": "Настройки",
        "settings.subtitle": "Управляйте аккаунтом, подпиской и приложением",
        "settings.profile": "Профиль",
        "settings.subscription": "Подписка",
        "settings.notifications": "Уведомления",
        "settings.languageRegion": "Язык и регион",
        "settings.appLanguage": "Язык приложения",
        "settings.units": "Единицы измерения",
        "settings.unitsValue": "км, °C",
        "settings.timezone": "Часовой пояс",
        "subscription.freeStatus": "Статус: Free — 5 запросов",
        "subscription.plan": "Подписка PULS Pro: 100 запросов за $15.",
        "notifications.service": "Напоминания о ТО",
        "notifications.diagnostics": "Диагностика и ошибки",
        "notifications.content": "Новые видео и мануалы",
        "notifications.updates": "Акции и обновления",
        "common.on": "Вкл",
        "common.off": "Выкл",
        "common.filter": "Фильтр",
        "common.close": "Закрыть",
        "search.requests": "Поиск по запросам",
        "search.manuals": "Поиск по мануалам",
        "search.video": "Поиск по видео",
        "composer.placeholder": "Опишите проблему или задайте вопрос...",
        "composer.attachPhoto": "Прикрепить фото",
        "composer.sendVideo": "Отправить видео",
        "composer.dtc": "Диагностика по коду",
        "profile.guest": "Гость",
        "profile.signIn": "Войдите в аккаунт",
        "profile.supabaseMissing": "Supabase не настроен",
        "profile.user": "Пользователь PULS",
        "profile.emailMissing": "Email не указан",
        "auth.open": "Войти / Регистрация",
        "auth.logout": "Выйти",
        "auth.title": "Аккаунт PULS",
        "auth.description": "Войдите или зарегистрируйтесь по email, чтобы привязать историю, подписку и устройства.",
        "auth.newUserHint": "Если вы новый пользователь, напишите свою почту и пароль, затем нажмите «Регистрация».",
        "auth.password": "Пароль",
        "auth.passwordPlaceholder": "Минимум 6 символов",
        "auth.login": "Вход",
        "auth.register": "Регистрация",
        "auth.statusReady": "Введите email и пароль.",
        "auth.statusConfig": "Добавьте Supabase URL и anon key в assets/js/supabaseClient.js.",
        "auth.enterEmail": "Введите email.",
        "auth.enterPassword": "Введите пароль.",
        "auth.shortPassword": "Пароль должен быть минимум 6 символов.",
        "auth.registerSuccess": "Регистрация успешна. Проверьте почту для подтверждения.",
        "toast.dtc": "Открыт раздел диагностики по коду.",
        "toast.voice": "Голосовой ввод можно подключить к Web Speech API или n8n.",
        "toast.demo": "Это демо-кнопка. Ее можно подключить к n8n, загрузке файлов или базе материалов."
      }
    };

    function getLanguage() {
      try {
        return localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en";
      } catch (error) {
        return "en";
      }
    }

    function t(key, params = {}) {
      const lang = getLanguage();
      const template = i18n[lang]?.[key] || i18n.en[key] || key;
      return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), template);
    }

    window.pulsT = t;

    function setTranslatedContent(node, value) {
      if (node.firstElementChild?.tagName?.toLowerCase() === "svg") {
        Array.from(node.childNodes).forEach((child) => {
          if (child !== node.firstElementChild) child.remove();
        });
        node.appendChild(document.createTextNode(value));
        return;
      }

      node.innerHTML = value;
    }

    function applyLanguage() {
      const lang = getLanguage();
      document.documentElement.lang = lang;
      $$("[data-i18n]").forEach((node) => setTranslatedContent(node, t(node.dataset.i18n)));
      $$("[data-i18n-placeholder]").forEach((node) => {
        node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
      });
      $$("[data-i18n-aria-label]").forEach((node) => {
        node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
      });
      $$(".language-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.lang === lang);
      });
      window.updateProfileBlock?.();
    }

    function setLanguage(lang) {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      } catch (error) {
        console.warn("Could not save language preference:", error);
      }
      applyLanguage();
      renderLists();
    }

    function injectIcons() {
      $$("[data-icon]").forEach((node) => {
        const key = node.dataset.icon;
        if (!iconMap[key]) return;
        if (node.tagName === "BUTTON") node.insertAdjacentHTML("afterbegin", iconMap[key]);
        else node.insertAdjacentHTML("afterbegin", iconMap[key]);
      });
    }

    async function renderLists() {
      const english = getLanguage() === "en";
      const requestRows = english ? [
        ["Humming under the hood at 2000-3000 rpm", "Possible causes: alternator bearing wear, belt tensioner, water pump, and other auxiliary components.", "Today, 10:42", "Solved"],
        ["Check Engine light is on", "Code P0420 — catalyst efficiency below threshold. Exhaust system diagnostics recommended.", "Yesterday, 18:15", "Solved"],
        ["Smoke from the exhaust pipe", "Possible causes: valve stem seals, turbocharger, or EGR system.", "May 12, 14:30", "Solved"],
        ["Battery drains quickly", "Check the alternator, parasitic draw, and battery condition. Load testing is recommended.", "May 8, 09:12", "Solved"],
        ["Jerks when shifting gears", "Check CVT fluid, CVT adaptation, belt wear, or pulley condition.", "May 5, 16:45", "Solved"],
        ["Knock in front right suspension", "Check stabilizer link, strut mount bearing, and ball joint.", "May 2, 11:20", "Solved"]
      ] : requests;
      const serviceRows = english ? [
        ["Engine oil and oil filter replacement", "Oil: 5W-30 Nissan Genuine Oil. Filter: original Nissan", "Today, 10:30", "98,500 km", "violet", "🛢"],
        ["Timing belt kit replacement", "Timing belt, rollers, tensioner, water pump. Manufacturer: Gates", "March 24, 2024", "90,120 km", "green", "⚙"],
        ["Air filter replacement", "Engine air filter. Manufacturer: Mann", "March 24, 2024", "90,120 km", "", "▥"],
        ["Front brake pad replacement", "Front brake pads. Manufacturer: Brembo", "February 12, 2024", "86,780 km", "orange", "◎"],
        ["Fuel filter replacement", "Fuel filter. Manufacturer: Nissan", "November 10, 2023", "80,450 km", "violet", "▣"],
        ["A/C service", "Freon refill and leak check", "August 5, 2023", "74,230 km", "cyan", "❄"]
      ] : services;
      const dtcRows = english ? [
        ["P0171", "System too lean (Bank 1)", "The engine control system detected a lean air-fuel mixture.", "Active", "danger"],
        ["P0401", "EGR flow insufficient", "Insufficient exhaust gas flow through the EGR valve was detected.", "Stored", "warn"],
        ["P0202", "Cylinder 2 injector circuit malfunction", "Open or short circuit in the second cylinder injector control circuit.", "Stored", "warn"]
      ] : dtc;
      const manualRows = english ? ["Service manual", "Car chemicals manual", "Wiper manual", "Consumables guide", "Brake system", "Owner's manual", "Electrical system", "Cooling system", "Suspension and steering"] : manuals;
      const videoRows = english ? ["Air filter replacement Select car", "Engine oil and filter replacement Select engine", "Front brake pad replacement", "Wiper blade replacement", "Timing chain replacement on Nissan X-Trail Select engine", "OBD2 error diagnostics", "Cabin filter replacement", "How to remove and replace a battery"] : videos;
      const selectCar = t("hero.car");
      const demoLabel = english ? "Demo" : "Демо";
      const savedLabel = english ? "Saved" : "Сохранено";
      const textRequestLabel = english ? "Text request" : "Текстовый запрос";
      const voiceRequestLabel = english ? "Voice request" : "Голосовой запрос";
      const codeErrorLabel = english ? "Error code" : "Код ошибки";
      const completedLabel = english ? "Completed" : "Выполнено";
      const systemLabel = english ? "System:" : "Система:";
      const possibleCausesLabel = english ? "Possible causes:" : "Возможные причины:";
      const actionsLabel = english ? "Recommended actions:" : "Рекомендуемые действия:";

      const savedHistory = await loadUserHistory();
      const savedRows = savedHistory.map((item) => [item.question, item.answer, item.date, savedLabel, item.vehicle, item.type]);
      const baseRows = requestRows.map((item) => [item[0], item[1], item[2], item[3], selectCar, demoLabel]);
      const allRows = savedRows.concat(baseRows);

      $("#journalList").innerHTML = allRows.map((item, index) => `
        <article class="row ${index === 0 ? "featured" : ""}">
          <div class="thumb" aria-hidden="true"></div>
          <div>
            <h3>${escapeHtml(item[0])}</h3>
            <span class="tag">${escapeHtml(item[4] || selectCar)}</span>
            <p>${escapeHtml(item[1]).slice(0, 220)}${String(item[1]).length > 220 ? "..." : ""}</p>
          </div>
          <div><p>${escapeHtml(item[2])}</p><p class="ok">${escapeHtml(item[3])} ✓</p></div>
        </article>
      `).join("");

      $("#historyList").innerHTML = allRows.concat([[english ? "P0171 system too lean" : "Ошибка P0171 слишком бедная смесь", `${selectCar} • ${t("hero.engineValue")} • ${t("hero.fuelValue")}`, english ? "Apr 28, 20:33" : "28 апр., 20:33", codeErrorLabel, selectCar, codeErrorLabel]]).map((item, index) => `
        <article class="row" style="grid-template-columns:64px 1fr 150px">
          <div class="square ${item[5] === voiceRequestLabel ? "violet" : ""}">${item[5] === voiceRequestLabel ? "🎙" : "⌨"}</div>
          <div><h3>${escapeHtml(item[0])}</h3><p>${escapeHtml(item[4] || `${selectCar} • ${t("hero.engineValue")} • ${t("hero.driveValue")}`)}</p></div>
          <div><p>${escapeHtml(item[2])}</p><span class="tag">${escapeHtml(item[5] || item[3] || textRequestLabel)}</span></div>
        </article>
      `).join("");

      $("#serviceList").innerHTML = serviceRows.map((item) => `
        <article class="service">
          <div class="square ${item[4]}">${item[5]}</div>
          <div><h3>${item[0]}</h3><p>${item[1]}</p><p class="ok">${completedLabel}</p></div>
          <div><p>${item[2]}</p><p>${english ? "Mileage" : "Пробег"}: ${item[3]}</p></div>
        </article>
      `).join("");

      $("#dtcList").innerHTML = dtcRows.map((item) => `
        <article class="dtc">
          <div class="dtc-top">
            <div class="code ${item[4]}">⚙ ${item[0]}</div>
            <div><h3>${item[1]}</h3><p>${item[2]}</p></div>
          </div>
          <div class="cols">
            <div><strong>${english ? "Status:" : "Статус:"}</strong><br><span class="${item[4]}">${item[3]}</span><br><br><strong>${systemLabel}</strong><br>${english ? "Engine / fuel system" : "Двигатель / топливная система"}</div>
            <div><strong>${possibleCausesLabel}</strong><br>${english ? "• Air leak<br>• Sensor malfunction<br>• Low fuel pressure<br>• Dirty component" : "• Подсос воздуха<br>• Неисправность датчика<br>• Низкое давление топлива<br>• Загрязнение узла"}</div>
            <div><strong>${actionsLabel}</strong><br>${english ? "• Check connectors<br>• Run diagnostics<br>• Clean or replace component<br>• Read errors again" : "• Проверить разъемы<br>• Провести диагностику<br>• Очистить или заменить узел<br>• Повторно считать ошибки"}</div>
          </div>
        </article>
      `).join("");

      $("#manualList").innerHTML = manualRows.map((title, index) => `
        <article class="manual">
          <h3>${title}</h3>
          <div class="manual-pic" aria-hidden="true"></div>
          <p>PDF • ${(6 + index * 2.1).toFixed(1)} MB</p>
          <p>${english ? `Materials adapted for ${selectCar}.` : `Материалы адаптированы для ${selectCar}.`}</p>
          <button class="btn blue" data-action="demo">${english ? "Open" : "Открыть"}</button>
        </article>
      `).join("");

      $("#videoList").innerHTML = videoRows.map((title, index) => `
        <article class="row">
          <div class="thumb" aria-hidden="true"></div>
          <div><h3>${title}</h3><p>${english ? `Step-by-step service guide for ${selectCar}.` : `Пошаговая инструкция по обслуживанию ${selectCar}.`}</p></div>
          <div><p>${index < 2 ? (english ? "Today" : "Сегодня") : (english ? "May 2024" : "Май 2024")}</p><span class="tag">${index % 3 === 0 ? (english ? "Service" : "Обслуживание") : index % 3 === 1 ? t("hero.engine") : (english ? "Diagnostics" : "Диагностика")}</span></div>
        </article>
      `).join("");
    }

    function showView(viewId) {
      $$(".nav button, .view").forEach((node) => node.classList.remove("active"));
      $(`.nav button[data-view="${viewId}"]`).classList.add("active");
      $(`#${viewId}`).classList.add("active");
      document.body.classList.toggle("assistant-mode", viewId === "assistant");
      document.body.classList.toggle("page-mode", viewId !== "assistant");
      syncAssistantMessageHeight();
      if (window.innerWidth < 1050) window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function toast(message) {
      const box = $("#toast");
      box.textContent = message;
      box.classList.add("show");
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => box.classList.remove("show"), 3600);
    }

    function appendMessage(text, isUser) {
      const div = document.createElement("div");
      div.className = `bubble ${isUser ? "user" : ""}`;
      div.innerHTML = `${linkifyText(text)} <small>${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small>`;
      const messagesBox = $("#messages");
      messagesBox.appendChild(div);
      scrollMessagesToBottom();
      return div;
    }

    function scrollMessagesToBottom() {
      const messagesBox = $("#messages");
      if (!messagesBox) return;
      requestAnimationFrame(() => {
        const isAssistantMode = document.body.classList.contains("assistant-mode");
        const scrollBox = document.body.classList.contains("assistant-mode")
          ? $(".content > .main-panel")
          : messagesBox;

        if (!isAssistantMode && getComputedStyle(messagesBox).overflowY !== "visible") {
          messagesBox.scrollTop = messagesBox.scrollHeight;
          return;
        }

        const lastBubble = messagesBox.querySelector(".bubble:last-child");
        const composer = $(".composer");

        if (!lastBubble || !composer) return;

        if (scrollBox && scrollBox !== messagesBox) {
          scrollBox.scrollTo({ top: scrollBox.scrollHeight, behavior: "smooth" });
        }

        requestAnimationFrame(() => {
          const bubbleBottom = lastBubble.getBoundingClientRect().bottom;
          const composerTop = composer.getBoundingClientRect().top;
          const hiddenByComposer = bubbleBottom - composerTop + 52;

          if (hiddenByComposer <= 0) return;

          if (scrollBox && scrollBox !== messagesBox) {
            scrollBox.scrollBy({ top: hiddenByComposer, behavior: "smooth" });
          } else {
            window.scrollBy({ top: hiddenByComposer, behavior: "smooth" });
          }
        });
      });
    }

    function syncAssistantMessageHeight() {
      const messagesBox = $("#messages");
      const assistantRight = $(".assistant-right");

      if (messagesBox) {
        messagesBox.style.height = "";
        messagesBox.style.maxHeight = "";
      }

      if (assistantRight) assistantRight.style.maxHeight = "";
    }

    function escapeHtml(text) {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return String(text).replace(/[&<>"']/g, (m) => map[m]);
    }
    function cleanUrl(url) {
      return String(url || "").replace(/[),.;:!?}\]]+$/g, "");
    }

    function linkifyText(text) {
      return escapeHtml(text || "")
        .replace(/(https?:\/\/[^\s<>"']+)/g, (match) => {
          const url = cleanUrl(match);
          const tail = match.slice(url.length);
          return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${tail}`;
        })
        .replace(/\n/g, "<br>");
    }

    function extractLinks(text) {
      const raw = String(text || "");
      const matches = raw.match(/https?:\/\/[^\s<>"']+/g) || [];
      const links = [];

      for (const match of matches) {
        const url = cleanUrl(match);
        if (!url || links.some((item) => item.url === url)) continue;

        const index = raw.indexOf(match);
        const before = raw.slice(Math.max(0, index - 260), index);
        const titleMatch = before.match(/"title"\s*:\s*"([^"]+)"/i);
        const forumMatch = before.match(/"forum"\s*:\s*"([^"]+)"/i);
        const hostMatch = url.match(/^https?:\/\/(?:www\.)?([^/]+)/i);
        const isVideo = /youtube\.com|youtu\.be|rutube\.ru|vimeo\.com/i.test(url);

        links.push({
          url,
          title: titleMatch ? titleMatch[1] : (isVideo ? "Видео по теме" : "Ссылка по теме"),
          source: forumMatch ? forumMatch[1] : (hostMatch ? hostMatch[1] : "Материал"),
          isVideo
        });
      }

      return links;
    }

    function updateTopicLinks(answer) {
      const box = $("#topicLinks");
      if (!box) return;

      const links = extractLinks(answer);

      if (!links.length) {
        box.innerHTML = `<p>${t("assistant.linksFoundEmpty")}</p>`;
        return;
      }

      box.innerHTML = links.slice(0, 10).map((item) => `
        <div class="topic-link-item">
          <div class="topic-link-title">${item.isVideo ? "Видео: " : ""}${escapeHtml(item.title)}</div>
          <div>${escapeHtml(item.source)}</div>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a>
        </div>
      `).join("");
    }

    const HISTORY_STORAGE_KEY = "puls_request_history_v1";
    const USER_STORAGE_KEY = "puls_web_user_id_v1";

    function getWebUserId() {
      let userId = localStorage.getItem(USER_STORAGE_KEY);

      if (!userId) {
        userId = "web_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(USER_STORAGE_KEY, userId);
      }

      return userId;
    }

    function loadLocalHistory() {
      try {
        return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
      } catch (error) {
        return [];
      }
    }

    async function loadUserHistory() {
      return loadLocalHistory();
    }

    async function saveHistoryItem(question, answer) {
      const item = {
        question,
        answer,
        vehicle: `${t("hero.car")} • ${t("hero.engineValue")} • ${t("hero.driveValue")}`,
        type: getLanguage() === "en" ? "Text request" : "Текстовый запрос"
      };

      const history = loadLocalHistory();
      const now = new Date();
      history.unshift({
        ...item,
        date: now.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) + ", " + now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      });
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 50)));
      await renderLists();
    }

    function updateQuota(quota) {
      if (!quota) return;
      const pill = $(".system-pill");
      if (!pill) return;

      if (quota.unlimited) {
        pill.textContent = t("system.premium");
      } else {
        pill.textContent = t("system.freeQuota", { remaining: quota.remaining, limit: quota.limit });
      }
    }

    function updateKeyChecks(answer) {
      const box = $("#keyChecks");
      if (!box) return;
      const lines = String(answer)
        .split(/\n|•|-|\d+[.)]/)
        .map((line) => line.trim())
        .filter(Boolean);
      const important = lines.filter((line) => /проверь|проверить|начни|датчик|ремень|ролик|генератор|масло|ошиб|obd|свеч|катуш|насос|давлен|egr|турбин|фильтр/i.test(line)).slice(0, 5);
      const finalLines = important.length ? important : lines.slice(0, 4);
      box.innerHTML = finalLines.length
        ? `<ul style="margin:8px 0 0; padding-left:20px; color:var(--soft); line-height:1.6">${finalLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
        : `<p>${t("assistant.checksEmpty")}</p>`;
    }

    async function getCurrentAuthUser() {
      if (!window.supabaseClient) return null;
      const { data, error } = await window.supabaseClient.auth.getUser();
      return error ? null : data.user;
    }

    async function sendPrompt() {
      const input = $("#promptInput");
      const prompt = input.value.trim();
      if (!prompt) return;
      showView("assistant");

      const user = await getCurrentAuthUser();
      if (!user) {
        toast(t("assistant.authRequired"));
        window.openAuthModal?.();
        return;
      }

      appendMessage(prompt, true);
      input.value = "";

      const loading = appendMessage(t("assistant.loading"), false);
      try {
        const res = await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: prompt,
            text: prompt,
            prompt,
            source: "web",
            userId: user.id,
            user_id: user.id,
            raw_user_id: user.id,
            chat_id: user.id,
            username: user.email || "web_user",
            first_name: user.user_metadata?.full_name || "Web",
            email: user.email,
            language: getLanguage(),
            vehicle: {
              model: "",
              year: "",
              engine: "",
              drive: "",
              fuel: ""
            }
          })
        });

        if (!res.ok) throw new Error("n8n webhook вернул ошибку");

        const rawAnswer = await res.text();
        let data;
        try {
          data = JSON.parse(rawAnswer);
        } catch (error) {
          data = { answer: rawAnswer };
        }

        const answer = data.answer || data.reply || data.message || data.output || rawAnswer || JSON.stringify(data, null, 2);
        loading.innerHTML = `<strong>PULS</strong><br>${linkifyText(answer)} <small>${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small>`;
        updateKeyChecks(answer);
        updateTopicLinks(answer);
        updateQuota(data.quota);
        await saveHistoryItem(prompt, answer);
        await renderLists();
        scrollMessagesToBottom();
      } catch (error) {
        const errorText = t("assistant.error");
        loading.innerHTML = `<strong>PULS</strong><br>${errorText} <small>${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</small>`;
        updateKeyChecks(errorText);
        await saveHistoryItem(prompt, errorText);
        scrollMessagesToBottom();
      }
    }

    function connectSpline() {
      if (!SPLINE_SCENE_URL) return;
      if (!$("#splineBox")) return;
      $("#splineBox").innerHTML = `<iframe title="Spline scene" src="${SPLINE_SCENE_URL}" allow="autoplay; fullscreen; xr-spatial-tracking"></iframe>`;
    }

    document.addEventListener("DOMContentLoaded", async () => {
      document.body.classList.add("assistant-mode");
      injectIcons();
      applyLanguage();
      await renderLists();
      connectSpline();

      $("#sendBtn").addEventListener("click", sendPrompt);
      $("#promptInput").addEventListener("keydown", (event) => {
        if (event.key === "Enter") sendPrompt();
      });
      window.addEventListener("resize", syncAssistantMessageHeight);
      syncAssistantMessageHeight();
      document.addEventListener("click", (event) => {
        const composerMenuButton = event.target.closest("#composerMenuBtn");
        if (composerMenuButton) {
          event.stopPropagation();
          const menu = $("#composerMenu");
          const isOpen = menu.classList.toggle("show");
          composerMenuButton.setAttribute("aria-expanded", String(isOpen));
          return;
        }

        const viewButton = event.target.closest(".nav button[data-view]");
        if (viewButton) {
          showView(viewButton.dataset.view);
          return;
        }

        const languageButton = event.target.closest(".language-btn[data-lang]");
        if (languageButton) {
          setLanguage(languageButton.dataset.lang);
          return;
        }

        const action = event.target.closest("[data-action]")?.dataset.action;
        if (!action) return;
        $("#composerMenu")?.classList.remove("show");
        $("#composerMenuBtn")?.setAttribute("aria-expanded", "false");
        if (event.target.closest("#composerMenuBtn")) return;
        if (action === "dtc") {
          showView("dtc");
          toast(t("toast.dtc"));
        } else if (action === "voice") {
          toast(t("toast.voice"));
        } else {
          toast(t("toast.demo"));
        }
      });
    });





