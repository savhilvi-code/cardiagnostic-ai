const AUTH_STATUS_READY = "Введите email и пароль.";
const AUTH_STATUS_CONFIG = "Добавьте Supabase URL и anon key в assets/js/supabaseClient.js.";

function authText(key, fallback) {
  return window.pulsT ? window.pulsT(key) : fallback;
}

function getAuthElements() {
  return {
    modal: document.getElementById("authModal"),
    status: document.getElementById("authStatus"),
    email: document.getElementById("authEmail"),
    password: document.getElementById("authPassword"),
    name: document.getElementById("profileName"),
    profileEmail: document.getElementById("profileEmail"),
    authBtn: document.getElementById("authBtn"),
    logoutBtn: document.getElementById("logoutBtn")
  };
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
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  setAuthStatus(
    window.supabaseClient
      ? authText("auth.statusReady", AUTH_STATUS_READY)
      : authText("auth.statusConfig", AUTH_STATUS_CONFIG),
    !window.supabaseClient
  );
  setTimeout(() => email?.focus(), 0);
}

function closeAuthModal() {
  const { modal } = getAuthElements();
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

async function updateProfileBlock() {
  const { name, profileEmail, authBtn, logoutBtn } = getAuthElements();
  if (!name || !profileEmail || !authBtn || !logoutBtn) return;

  if (!window.supabaseClient) {
    name.textContent = authText("profile.guest", "Гость");
    profileEmail.textContent = authText("profile.supabaseMissing", "Supabase не настроен");
    authBtn.style.display = "inline-flex";
    logoutBtn.style.display = "none";
    return;
  }

  const { data, error } = await window.supabaseClient.auth.getUser();
  const user = error ? null : data.user;

  if (!user) {
    name.textContent = authText("profile.guest", "Гость");
    profileEmail.textContent = authText("profile.signIn", "Войдите в аккаунт");
    authBtn.style.display = "inline-flex";
    logoutBtn.style.display = "none";
    return;
  }

  name.textContent = user.user_metadata?.full_name || authText("profile.user", "Пользователь PULS");
  profileEmail.textContent = user.email || authText("profile.emailMissing", "Email не указан");
  authBtn.style.display = "none";
  logoutBtn.style.display = "inline-flex";
  await syncAuthUserProfile(user);
}

async function syncAuthUserProfile(user) {
  if (!window.supabaseClient || !user?.id) return;

  const payload = {
    auth_user_id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || authText("profile.user", "Пользователь PULS"),
    last_login: new Date().toISOString()
  };

  const { error } = await window.supabaseClient
    .from("users")
    .upsert(payload, { onConflict: "auth_user_id" });

  if (!error) return;

  const duplicateEmail = error.code === "23505" && user.email;
  if (duplicateEmail) {
    const { error: updateError } = await window.supabaseClient
      .from("users")
      .update(payload)
      .eq("email", user.email);

    if (!updateError) return;
  }

  console.warn("Не удалось синхронизировать профиль users.auth_user_id:", error.message);
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
    password
  });

  if (error) {
    setAuthStatus(error.message, true);
    return;
  }

  if (data.user) await syncAuthUserProfile(data.user);
  setAuthStatus(authText("auth.registerSuccess", "Регистрация успешна. Проверьте почту для подтверждения."));
  await updateProfileBlock();
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

  if (data.user) await syncAuthUserProfile(data.user);
  closeAuthModal();
  await updateProfileBlock();
}

async function logoutUser() {
  if (!window.supabaseClient) return;
  await window.supabaseClient.auth.signOut();
  await updateProfileBlock();
}

window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.updateProfileBlock = updateProfileBlock;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;

document.addEventListener("DOMContentLoaded", () => {
  updateProfileBlock();

  document.getElementById("authBtn")?.addEventListener("click", openAuthModal);
  document.getElementById("authCloseBtn")?.addEventListener("click", closeAuthModal);
  document.getElementById("logoutBtn")?.addEventListener("click", logoutUser);

  document.getElementById("authModal")?.addEventListener("click", (event) => {
    if (event.target.id === "authModal") closeAuthModal();
  });

  document.getElementById("authForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const { email, password } = readAuthCredentials();
    loginUser(email, password);
  });

  document.getElementById("loginBtn")?.addEventListener("click", () => {
    const { email, password } = readAuthCredentials();
    loginUser(email, password);
  });

  document.getElementById("registerBtn")?.addEventListener("click", () => {
    const { email, password } = readAuthCredentials();
    registerUser(email, password);
  });

  window.supabaseClient?.auth.onAuthStateChange(() => {
    updateProfileBlock();
  });
});
