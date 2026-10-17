(function () {
  "use strict";

  const screenSelector = "[data-settings-screen]";
  const stack = [];
  let current = "home";

  const element = (id) => document.getElementById(id);
  const screens = () => Array.from(document.querySelectorAll(screenSelector));
  const text = (key) => window.PulsI18n?.t?.(key) || key;

  function screen(name) {
    return document.querySelector(`${screenSelector}[data-settings-screen="${name}"]`);
  }

  function updateHeader(target) {
    const title = element("settingsPageTitle");
    const subtitle = element("settingsPageSubtitle");
    const back = element("settingsBackBtn");
    if (title) title.textContent = text(target?.dataset.settingsTitle || "settings.title");
    if (subtitle) subtitle.textContent = text(target?.dataset.settingsSubtitle || "settings.subtitle");
    if (back) back.hidden = current === "home";
  }

  function show(name, { push = true, focus = true } = {}) {
    const target = screen(name);
    if (!target || name === current) return;
    if (push) stack.push(current);
    current = name;
    screens().forEach((item) => {
      const active = item === target;
      item.hidden = !active;
      item.classList.toggle("is-active", active);
    });
    updateHeader(target);
    const settingsView = element("settings");
    if (settingsView) settingsView.scrollTop = 0;
    if (focus) element("settingsPageTitle")?.focus?.({ preventScroll: true });
  }

  function back() {
    const previous = stack.pop() || "home";
    show(previous, { push: false });
  }

  function openHome({ focus = false } = {}) {
    stack.length = 0;
    if (current === "home") {
      updateHeader(screen("home"));
      return;
    }
    show("home", { push: false, focus });
  }

  function notify(key) {
    window.PulsToast?.(text(key));
  }

  function initialize() {
    if (!element("settings")) return;
    element("settingsBackBtn")?.addEventListener("click", back);
    document.querySelectorAll("[data-settings-target]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled || button.classList.contains("locked")) return;
        show(button.dataset.settingsTarget);
      });
    });
    document.querySelectorAll("[data-settings-notice]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled || button.classList.contains("locked")) return;
        notify(button.dataset.settingsNotice);
      });
    });
    element("settingsPasswordResetBtn")?.addEventListener("click", async () => {
      if (!window.pulsCurrentUser?.email) return;
      const sent = await window.requestPulsPasswordReset?.(window.pulsCurrentUser.email);
      notify(sent ? "auth.resetSent" : "auth.resetError");
    });
    element("settingsMeetPulsBtn")?.addEventListener("click", () => {
      window.PulsVoiceMode?.open?.({ source: "settings" });
    });
    const version = element("settingsAppVersion");
    if (version) version.textContent = String(window.PULS_CONFIG?.APP_VERSION || "—");
    window.addEventListener("puls-language-change", () => updateHeader(screen(current)));
    updateHeader(screen("home"));
  }

  document.addEventListener("DOMContentLoaded", initialize);
  window.PulsSettings = Object.freeze({ show, back, openHome, current: () => current });
})();
