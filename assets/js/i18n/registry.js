(function () {
  "use strict";

  const languages = [
    { code: "en", name: "English", flag: "assets/img/flags/gb.svg", country: "GB" },
    { code: "ru", name: "Русский", flag: "assets/img/flags/ru.svg", country: "RU" },
    { code: "es", name: "Español", flag: "assets/img/flags/es.svg", country: "ES" },
    { code: "fr", name: "Français", flag: "assets/img/flags/fr.svg", country: "FR" },
    { code: "de", name: "Deutsch", flag: "assets/img/flags/de.svg", country: "DE" },
    { code: "pt", name: "Português", flag: "assets/img/flags/pt.svg", country: "PT" },
    { code: "tr", name: "Türkçe", flag: "assets/img/flags/tr.svg", country: "TR" },
    { code: "ka", name: "ქართული", flag: "assets/img/flags/ge.svg", country: "GE" }
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
