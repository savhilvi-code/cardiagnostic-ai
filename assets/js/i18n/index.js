(function () {
  "use strict";

  const STORAGE_KEY = "puls_language_v1";
  const registry = window.PulsLanguageRegistry;
  const sourceLocales = window.PulsLocales || {};
  const english = Object.freeze({ ...(sourceLocales.en || {}) });
  const locales = {};

  registry.codes.forEach((code) => {
    locales[code] = Object.freeze({ ...english, ...(sourceLocales[code] || {}) });
  });

  function normalizeLanguage(code, fallback = registry.defaultLanguage) {
    const normalized = String(code || "").trim().toLowerCase().split(/[-_]/)[0];
    return registry.codes.includes(normalized) ? normalized : fallback;
  }

  function getLanguage() {
    try {
      return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
    } catch {
      return registry.defaultLanguage;
    }
  }

  function t(key, params = {}, language = getLanguage()) {
    const code = normalizeLanguage(language);
    const template = locales[code]?.[key] ?? english[key] ?? key;
    return Object.entries(params).reduce(
      (text, [name, value]) => String(text).replaceAll(`{${name}}`, String(value)),
      String(template)
    );
  }

  function setLanguage(code, { persist = true, announce = true } = {}) {
    const language = normalizeLanguage(code);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, language); }
      catch (error) { console.warn("Could not save language preference:", error); }
    }
    document.documentElement.lang = language;
    if (announce) {
      window.dispatchEvent(new CustomEvent("puls-language-change", { detail: { language } }));
    }
    return language;
  }

  async function profileLanguageHeaders() {
    if (!window.supabaseClient) throw new Error("Authentication is unavailable.");
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error || !data?.session?.access_token) throw new Error("Authentication is required.");
    return {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json"
    };
  }

  function profileLanguageUrl() {
    const baseUrl = String(window.PULS_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");
    if (!baseUrl) throw new Error("PULS API is unavailable.");
    return `${baseUrl}/api/profile/language`;
  }

  async function loadProfileLanguage() {
    const response = await fetch(profileLanguageUrl(), {
      headers: await profileLanguageHeaders(),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Language preference returned ${response.status}.`);
    const payload = await response.json();
    return normalizeLanguage(payload?.language);
  }

  async function saveProfileLanguage(code) {
    const language = normalizeLanguage(code);
    const response = await fetch(profileLanguageUrl(), {
      method: "PUT",
      headers: await profileLanguageHeaders(),
      body: JSON.stringify({ language }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Language preference returned ${response.status}.`);
    const payload = await response.json();
    return normalizeLanguage(payload?.language, language);
  }

  window.PulsI18n = Object.freeze({
    storageKey: STORAGE_KEY,
    registry,
    locales: Object.freeze(locales),
    normalizeLanguage,
    getLanguage,
    setLanguage,
    loadProfileLanguage,
    saveProfileLanguage,
    t
  });
  window.pulsT = t;
})();
