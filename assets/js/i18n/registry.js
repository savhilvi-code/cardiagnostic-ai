(function () {
  "use strict";

  const languages = [
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "ru", name: "Русский", flag: "🇷🇺" },
    { code: "es", name: "Español", flag: "🇪🇸" },
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "pt", name: "Português", flag: "🇵🇹" },
    { code: "tr", name: "Türkçe", flag: "🇹🇷" },
    { code: "ka", name: "ქართული", flag: "🇬🇪" }
  ];

  window.PulsLanguageRegistry = Object.freeze({
    defaultLanguage: "en",
    languages: Object.freeze(languages.map(Object.freeze)),
    codes: Object.freeze(languages.map((item) => item.code)),
    get(code) {
      const normalized = String(code || "").trim().toLowerCase().split(/[-_]/)[0];
      return languages.find((item) => item.code === normalized) || languages[0];
    }
  });
})();
