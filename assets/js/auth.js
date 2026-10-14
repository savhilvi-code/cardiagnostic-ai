const AUTH_STATUS_CONFIG = "Добавьте Supabase URL и anon key в assets/js/supabaseClient.js.";
const MODE_SELECTION_COMPLETED_KEY = "puls_mode_selection_completed";
window.pulsAuthReady = Promise.resolve(null);
let authMode = "login";
let authLanguageExplicitlySelected = false;

function authText(key, fallback) {
  return window.pulsT ? window.pulsT(key) : fallback;
}

function getAuthElements() {
  return {
    modal: document.getElementById("authModal"),
    status: document.getElementById("authStatus"),
    email: document.getElementById("authEmail"),
    password: document.getElementById("authPassword"),
    title: document.getElementById("authTitle"),
    submit: document.getElementById("authSubmitBtn"),
    forgot: document.getElementById("authForgotBtn"),
    passwordToggle: document.getElementById("authPasswordToggle"),
    languageValue: document.getElementById("authLanguageValue"),
    languageFlag: document.getElementById("authLanguageFlag"),
    name: document.getElementById("profileName"),
    profileEmail: document.getElementById("profileEmail"),
    authBtn: document.getElementById("authBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    deleteProfileBtn: document.getElementById("deleteProfileBtn")
  };
}

function translateAuthModal() {
  const elements = getAuthElements();
  const isRegister = authMode === "register";
  const language = window.PulsI18n.registry.get(window.PulsI18n.getLanguage());
  if (elements.title) elements.title.textContent = authText(isRegister ? "auth.createAccount" : "auth.welcome", isRegister ? "Create your PULS account" : "Welcome to PULS");
  if (elements.submit) elements.submit.textContent = authText(isRegister ? "auth.primaryRegister" : "auth.primaryLogin", isRegister ? "Create account" : "Sign in");
  if (elements.forgot) elements.forgot.hidden = isRegister;
  if (elements.password) elements.password.autocomplete = isRegister ? "new-password" : "current-password";
  if (elements.languageValue) elements.languageValue.textContent = language.name;
  if (elements.languageFlag) elements.languageFlag.textContent = language.country;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.authMode === authMode));
  });
}

function setAuthMode(mode) {
  authMode = mode === "register" ? "register" : "login";
  setAuthStatus("");
  translateAuthModal();
}

function openAuthLanguagePicker() {
  const trigger = document.getElementById("authLanguageBtn");
  window.PulsWheelPicker?.open({
    title: authText("picker.languageTitle", "App language"),
    confirmLabel: authText("picker.apply", "Apply"),
    trigger,
    value: window.PulsI18n.getLanguage(),
    options: window.PulsI18n.registry.languages.map(({ code, name }) => ({ value: code, label: name })),
    onConfirm(language) {
      authLanguageExplicitlySelected = true;
      window.PulsI18n.setLanguage(language, { announce: false });
      window.applyPulsLanguage?.();
      translateAuthModal();
      window.dispatchEvent(new CustomEvent("puls-language-change", { detail: { language } }));
    }
  });
}

function toggleAuthPassword() {
  const { password, passwordToggle } = getAuthElements();
  if (!password || !passwordToggle) return;
  const reveal = password.type === "password";
  password.type = reveal ? "text" : "password";
  passwordToggle.setAttribute("aria-label", authText(reveal ? "auth.hidePassword" : "auth.showPassword", reveal ? "Hide password" : "Show password"));
}

function publishAuthState(user, appUser = null) {
  window.pulsCurrentUser = user || null;
  window.pulsAppUser = appUser || null;
  window.dispatchEvent(new CustomEvent("puls-auth-change", {
    detail: {
      user: window.pulsCurrentUser,
      appUser: window.pulsAppUser
    }
  }));
}

function setAuthStatus(message, isError = false) {
  const { status } = getAuthElements();
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("error", Boolean(isError));
}

function openAuthModal() {
  const { modal, email } = getAuthElements();
  if (!modal) return;
  translateAuthModal();
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  setAuthStatus(window.supabaseClient ? "" : authText("auth.statusConfig", AUTH_STATUS_CONFIG), !window.supabaseClient);
  setTimeout(() => email?.focus(), 0);
}

function closeAuthModal() {
  const { modal, password, passwordToggle } = getAuthElements();
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  if (password) password.type = "password";
  passwordToggle?.setAttribute("aria-label", authText("auth.showPassword", "Show password"));
}

function handleModeSelectionAuthEvent(event, session) {
  if (event === "SIGNED_OUT") {
    window.PulsModeSelection?.hide();
  }
}

function modeSelectionStorageKey(userId = window.pulsCurrentUser?.id) {
  return userId ? `${MODE_SELECTION_COMPLETED_KEY}:${userId}` : "";
}

function persistModeSelectionComplete(user = window.pulsCurrentUser) {
  if (!window.supabaseClient || !user?.id || user.user_metadata?.puls_mode_selection_completed === true) return;
  user.user_metadata = {
    ...(user.user_metadata || {}),
    puls_mode_selection_completed: true,
    puls_mode_selection_required: false
  };
  void (async () => {
    const { error } = await window.supabaseClient.auth.updateUser({
      data: {
        puls_mode_selection_completed: true,
        puls_mode_selection_required: false
      }
    });
    if (error) console.warn("Could not persist mode onboarding:", error.message);
  })();
}

function isModeSelectionComplete(userId = window.pulsCurrentUser?.id) {
  const user = window.pulsCurrentUser;
  if (user?.id === userId) {
    if (user.user_metadata?.puls_mode_selection_completed === true) return true;
  }
  const key = modeSelectionStorageKey(userId);
  if (!key) return false;
  try {
    if (window.localStorage.getItem(key) === "1") {
      persistModeSelectionComplete(user);
      return true;
    }
  } catch { /* Continue with durable account state. */ }
  if (user?.id === userId && user.user_metadata?.puls_mode_selection_required !== true) {
    persistModeSelectionComplete(user);
    return true;
  }
  return false;
}

function completeModeSelection(userId = window.pulsCurrentUser?.id) {
  const key = modeSelectionStorageKey(userId);
  if (!key) return;
  try { window.localStorage.setItem(key, "1"); }
  catch { /* Storage restrictions must not block mode selection. */ }
  if (window.pulsCurrentUser?.id === userId) persistModeSelectionComplete(window.pulsCurrentUser);
}

function showModeSelectionForNewUser(user) {
  if (!user?.id || isModeSelectionComplete(user.id)) return;
  closeAuthModal();
  window.PulsModeSelection?.show();
}

async function updateProfileBlock() {
  const { name, profileEmail, authBtn, logoutBtn, deleteProfileBtn } = getAuthElements();
  if (!name || !profileEmail || !authBtn || !logoutBtn) return;

  if (!window.supabaseClient) {
    publishAuthState(null);
    name.textContent = authText("profile.guest", "Гость");
    profileEmail.textContent = authText("profile.supabaseMissing", "Supabase не настроен");
    authBtn.style.display = "inline-flex";
    logoutBtn.style.display = "none";
    if (deleteProfileBtn) deleteProfileBtn.style.display = "none";
    return;
  }

  const { data, error } = await window.supabaseClient.auth.getUser();
  const user = error ? null : data.user;

  if (!user) {
    publishAuthState(null);
    name.textContent = authText("profile.guest", "Гость");
    profileEmail.textContent = authText("profile.signIn", "Войдите в аккаунт");
    authBtn.style.display = "inline-flex";
    logoutBtn.style.display = "none";
    if (deleteProfileBtn) deleteProfileBtn.style.display = "none";
    return;
  }

  const appUser = await syncAuthUserProfile(user);
  if (!authLanguageExplicitlySelected) {
    await restoreAuthenticatedLanguage(appUser?.language);
  }
  publishAuthState(user, appUser);
  name.textContent = appUser?.name || user.user_metadata?.full_name || authText("profile.user", "Пользователь PULS");
  profileEmail.textContent = user.email || authText("profile.emailMissing", "Email не указан");
  authBtn.style.display = "none";
  logoutBtn.style.display = "inline-flex";
  if (deleteProfileBtn) deleteProfileBtn.style.display = "inline-flex";
  showModeSelectionForNewUser(user);
}

async function syncAuthUserProfile(user) {
  if (!window.supabaseClient || !user?.id) return null;

  const normalizedEmail = user.email?.trim().toLowerCase() || null;
  const payload = {
    id: user.id,
    email: normalizedEmail,
    last_login: new Date().toISOString()
  };
  const authName = user.user_metadata?.full_name;
  if (authName) payload.name = authName;

  const selectColumns = "id,email,name,language,country,city,last_login,source,created_at,last_seen_at";

  const { data: byAuth, error: byAuthError } = await window.supabaseClient
    .from("users")
    .select(selectColumns)
    .eq("id", user.id)
    .maybeSingle();

  if (byAuthError) {
    console.warn("Could not find profile by id:", byAuthError.message);
  }

  if (byAuth) {
    const { data, error } = await window.supabaseClient
      .from("users")
      .update(payload)
      .eq("id", user.id)
      .select(selectColumns)
      .single();

    if (!error) return data;
    console.warn("Could not update profile by id:", error.message);
    return byAuth;
  }

  payload.language = window.PulsI18n.normalizeLanguage(user.user_metadata?.language || window.PulsI18n.getLanguage());

  const { data, error } = await window.supabaseClient
    .from("users")
    .insert(payload)
    .select(selectColumns)
    .single();

  if (!error) return data;

  console.warn("Не удалось создать профиль users:", error.message);
  return null;
}

async function restoreAuthenticatedLanguage(profileLanguage) {
  let language = profileLanguage;
  try {
    language = await window.PulsI18n.loadProfileLanguage();
  } catch (error) {
    console.warn("Could not load profile language:", error.message);
  }
  if (!language) return;
  const normalized = window.PulsI18n.normalizeLanguage(language);
  if (normalized === window.PulsI18n.getLanguage()) return;
  window.PulsI18n.setLanguage(normalized);
  window.applyPulsLanguage?.();
}

async function persistExplicitAuthLanguage() {
  if (!authLanguageExplicitlySelected) return;
  await window.PulsI18n.saveProfileLanguage(window.PulsI18n.getLanguage());
  authLanguageExplicitlySelected = false;
}

function readAuthCredentials() {
  const { email, password } = getAuthElements();
  return {
    email: email?.value.trim() || "",
    password: password?.value || ""
  };
}

function validateAuthCredentials(email, password) {
  if (!email) {
    setAuthStatus(authText("auth.enterEmail", "Введите email."), true);
    return false;
  }

  if (!password) {
    setAuthStatus(authText("auth.enterPassword", "Введите пароль."), true);
    return false;
  }

  if (password.length < 6) {
    setAuthStatus(authText("auth.shortPassword", "Пароль должен быть минимум 6 символов."), true);
    return false;
  }

  return true;
}

async function registerUser(email, password) {
  if (!window.supabaseClient) {
    setAuthStatus(authText("auth.statusConfig", AUTH_STATUS_CONFIG), true);
    return;
  }

  if (!validateAuthCredentials(email, password)) return;

  const { data, error } = await window.supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        puls_mode_selection_required: true,
        language: window.PulsI18n.getLanguage()
      }
    }
  });

  if (error) {
    setAuthStatus(error.message, true);
    return;
  }

  if (data.user) publishAuthState(data.user, await syncAuthUserProfile(data.user));
  if (data.session) {
    try { await persistExplicitAuthLanguage(); }
    catch (languageError) { console.warn("Could not save registration language:", languageError.message); }
  }
  setAuthStatus(authText("auth.registerSuccess", "Регистрация успешна. Проверьте почту для подтверждения."));
  await updateProfileBlock();
  if (data.session?.user) showModeSelectionForNewUser(data.session.user);
}

async function loginUser(email, password) {
  if (!window.supabaseClient) {
    setAuthStatus(authText("auth.statusConfig", AUTH_STATUS_CONFIG), true);
    return;
  }

  if (!validateAuthCredentials(email, password)) return;

  const { data, error } = await window.supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setAuthStatus(error.message, true);
    return;
  }

  if (data.user) publishAuthState(data.user, await syncAuthUserProfile(data.user));
  try {
    if (authLanguageExplicitlySelected) await persistExplicitAuthLanguage();
    else await restoreAuthenticatedLanguage();
  } catch (languageError) {
    authLanguageExplicitlySelected = false;
    await restoreAuthenticatedLanguage();
    setAuthStatus(authText("language.saveError", "Could not save the language. The previous language was restored."), true);
    return;
  }
  closeAuthModal();
  await updateProfileBlock();
  showModeSelectionForNewUser(data.user);
}

async function resetAuthPassword() {
  if (!window.supabaseClient) {
    setAuthStatus(authText("auth.statusConfig", AUTH_STATUS_CONFIG), true);
    return;
  }
  const { email } = readAuthCredentials();
  if (!email) {
    setAuthStatus(authText("auth.enterEmail", "Enter email."), true);
    return;
  }
  const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  setAuthStatus(
    authText(error ? "auth.resetError" : "auth.resetSent", error ? "Could not send password reset instructions." : "Password reset instructions were sent to your email."),
    Boolean(error)
  );
}

async function logoutUser() {
  if (!window.supabaseClient) return;
  await window.supabaseClient.auth.signOut();
  publishAuthState(null);
  await updateProfileBlock();
}

async function deleteProfileUser() {
  if (!window.supabaseClient) return;

  const { data, error } = await window.supabaseClient.auth.getUser();
  const user = error ? null : data.user;
  if (!user?.email) {
    setAuthStatus(authText("auth.signInToDelete", "Sign in before deleting profile."), true);
    window.alert(authText("auth.signInToDelete", "Sign in before deleting profile."));
    return;
  }

  const confirmation = window.prompt(authText("auth.deleteConfirmPrompt", "Type your email to confirm profile deletion."));
  if (confirmation !== user.email) {
    setAuthStatus(authText("auth.deleteCancelled", "Profile deletion cancelled."), true);
    if (confirmation !== null) window.alert(authText("auth.deleteCancelled", "Profile deletion cancelled."));
    return;
  }

  await window.supabaseClient.auth.updateUser({
    data: {
      deletion_requested: true,
      deletion_requested_at: new Date().toISOString()
    }
  });

  setAuthStatus(authText("auth.deleteRequested", "Profile deletion request saved. Check your email if confirmation is required."));
  window.alert(authText("auth.deleteRequested", "Profile deletion request saved. Check your email if confirmation is required."));
  await window.supabaseClient.auth.signOut();
  publishAuthState(null);
  await updateProfileBlock();
}

window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.deleteProfileUser = deleteProfileUser;
window.updateProfileBlock = updateProfileBlock;
window.syncAuthUserProfile = syncAuthUserProfile;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.isPulsModeOnboardingComplete = isModeSelectionComplete;
window.completePulsModeOnboarding = completeModeSelection;
window.PulsAuth = Object.freeze({ translate: translateAuthModal, setMode: setAuthMode });

document.addEventListener("DOMContentLoaded", () => {
  window.pulsAuthReady = updateProfileBlock().catch((error) => {
    console.warn("Could not restore authentication state:", error);
    publishAuthState(null);
    return null;
  });

  document.getElementById("authBtn")?.addEventListener("click", openAuthModal);
  document.getElementById("authCloseBtn")?.addEventListener("click", closeAuthModal);
  document.getElementById("authLanguageBtn")?.addEventListener("click", openAuthLanguagePicker);
  document.getElementById("authModeLogin")?.addEventListener("click", () => setAuthMode("login"));
  document.getElementById("authModeRegister")?.addEventListener("click", () => setAuthMode("register"));
  document.getElementById("authPasswordToggle")?.addEventListener("click", toggleAuthPassword);
  document.getElementById("authForgotBtn")?.addEventListener("click", () => void resetAuthPassword());
  document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);
  document.getElementById("deleteProfileBtn")?.addEventListener("click", deleteProfileUser);

  document.getElementById("authModal")?.addEventListener("click", (event) => {
    if (event.target.id === "authModal") closeAuthModal();
  });

  document.getElementById("authForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const { email, password } = readAuthCredentials();
    void (authMode === "register" ? registerUser(email, password) : loginUser(email, password));
  });

  window.addEventListener("puls-language-change", translateAuthModal);
  translateAuthModal();

  window.supabaseClient?.auth.onAuthStateChange((event, session) => {
    updateProfileBlock()
      .catch((error) => console.warn("Could not update authentication profile:", error))
      .finally(() => handleModeSelectionAuthEvent(event, session));
  });
});
