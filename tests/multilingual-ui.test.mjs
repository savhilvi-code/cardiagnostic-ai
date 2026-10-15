import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function localizationContext() {
  const values = new Map();
  const context = vm.createContext({
    console,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) },
    document: { documentElement: { lang: "en" } },
    window: { dispatchEvent() {}, PULS_CONFIG: { API_BASE_URL: "https://example.test" } }
  });
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;
  context.window.CustomEvent = context.CustomEvent;
  for (const path of [
    "assets/js/i18n/registry.js",
    ...["en", "ru", "es", "fr", "de", "pt", "tr", "ka"].map((code) => `assets/js/i18n/locales/${code}.js`),
    "assets/js/i18n/car-page.js",
    "assets/js/i18n/index.js"
  ]) vm.runInContext(await read(path), context, { filename: path });
  return context;
}

test("all eight interface languages share the canonical key set", async () => {
  const { window } = await localizationContext();
  assert.deepEqual(Array.from(window.PulsI18n.registry.codes), ["en", "ru", "es", "fr", "de", "pt", "tr", "ka"]);
  const englishKeys = Object.keys(window.PulsI18n.locales.en).sort();
  for (const code of window.PulsI18n.registry.codes) {
    assert.deepEqual(Object.keys(window.PulsI18n.locales[code]).sort(), englishKeys, `${code} key parity`);
    if (code !== "en") assert.notEqual(window.PulsI18n.t("auth.welcome", {}, code), window.PulsI18n.t("auth.welcome", {}, "en"), `${code} auth localization`);
  }
});

test("My Car page has complete translations in every interface language", async () => {
  const { window } = await localizationContext();
  const keys = Object.keys(window.PulsI18n.locales.en).filter((key) => key.startsWith("car.page."));
  assert.equal(keys.length, 104);
  for (const code of window.PulsI18n.registry.codes) {
    for (const key of keys) assert.notEqual(window.PulsI18n.t(key, {}, code), key, `${code}: ${key}`);
    assert.equal(window.PulsI18n.t("car.page.myCar", {}, code), {
      en: "My Car", ru: "Мой автомобиль", es: "Mi coche", fr: "Mon véhicule",
      de: "Mein Fahrzeug", pt: "O meu veículo", tr: "Aracım", ka: "ჩემი ავტომობილი"
    }[code]);
    if (code !== "en") {
      for (const key of ["car.page.myCar", "car.page.memory", "car.page.noCars", "car.page.emptyHelp", "car.page.add", "car.page.signIn"]) {
        assert.notEqual(window.PulsI18n.t(key, {}, code), window.PulsI18n.t(key, {}, "en"), `${code}: ${key}`);
      }
      for (const key of ["car.photoUpload", "car.formSaved", "car.lookupError"]) {
        assert.notEqual(window.PulsI18n.t(key, {}, code), window.PulsI18n.t(key, {}, "en"), `${code}: ${key}`);
      }
    }
  }
});

test("language changes rerender dynamic My Car states", async () => {
  const source = await read("assets/js/app.js");
  assert.match(source, /function applyLanguage\(\)[\s\S]*?window\.PulsCar\?\.render\(\)/);
});

test("auth and settings use one wheel picker and no native preference selects", async () => {
  const html = await read("index.html");
  assert.equal((html.match(/id="wheelPickerModal"/g) || []).length, 1);
  assert.match(html, /id="authLanguageBtn"/);
  assert.match(html, /id="languagePickerBtn"/);
  assert.match(html, /id="unitsPickerBtn"/);
  assert.match(html, /id="timezonePickerBtn"/);
  assert.doesNotMatch(html, /id="languageSelect"/);
  assert.doesNotMatch(html, /id="unitsSelect"/);
  assert.doesNotMatch(html, /id="timezoneSelect"/);
  assert.equal((html.match(/id="authSubmitBtn"/g) || []).length, 1);
  assert.doesNotMatch(html, /id="loginBtn"|id="registerBtn"/);
});

test("profile language synchronization uses the existing backend endpoint", async () => {
  const source = await read("assets/js/i18n/index.js");
  assert.match(source, /GET|loadProfileLanguage/);
  assert.match(source, /method: "PUT"/);
  assert.match(source, /\/api\/profile\/language/);
  assert.match(source, /Authorization: `Bearer/);
});
