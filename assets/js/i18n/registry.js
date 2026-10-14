(function () {
  "use strict";

  const languages = [
    { code: "en", name: "English", flag: "🇬🇧", country: "GB" },
    { code: "ru", name: "Русский", flag: "🇷🇺", country: "RU" },
    { code: "es", name: "Español", flag: "🇪🇸", country: "ES" },
    { code: "fr", name: "Français", flag: "🇫🇷", country: "FR" },
    { code: "de", name: "Deutsch", flag: "🇩🇪", country: "DE" },
    { code: "pt", name: "Português", flag: "🇵🇹", country: "PT" },
    { code: "tr", name: "Türkçe", flag: "🇹🇷", country: "TR" },
    { code: "ka", name: "ქართული", flag: "🇬🇪", country: "GE" }
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
