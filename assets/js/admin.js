const ADMIN_API_BASE_URL = (
  window.PULS_CONFIG?.API_BASE_URL ||
  "https://puls-backend-t3sn.onrender.com"
).replace(/\/$/, "");

let adminUsers = [];
let selectedPlanUser = null;
let selectedDeleteUser = null;
const inspectorState = {
  tab: "overview",
  loaded: new Set(),
  offsets: {
    vehicles: 0,
    conversations: 0,
    problems: 0,
    events: 0,
    search: 0,
    sources: 0,
    knowledge: 0
  },
  limit: 25
};
const SIDEBAR_STORAGE_KEY = "puls-admin-sidebar-collapsed";


function adminEl(id) {
  return document.getElementById(id);
}


function setAdminStatus(message = "", type = "") {
  const node = adminEl("adminStatus");
  if (!node) return;

  node.textContent = message;
  node.classList.remove("error", "success");

  if (type) {
    node.classList.add(type);
  }
}


async function getAdminSession() {
  if (!window.supabaseClient) {
    return null;
  }

  const { data, error } =
    await window.supabaseClient.auth.getSession();

  if (error) {
    console.error(
      "Could not read Supabase session:",
      error
    );
    return null;
  }

  return data.session || null;
}


async function adminFetch(path, options = {}) {
  const session = await getAdminSession();

  if (!session?.access_token) {
    throw new Error("AUTH_REQUIRED");
  }

  const headers = {
    ...(options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers || {}),
    Authorization: `Bearer ${session.access_token}`
  };

  const response = await fetch(
    `${ADMIN_API_BASE_URL}${path}`,
    {
      ...options,
      headers
    }
  );

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload?.detail ||
      payload?.message ||
      `Backend returned ${response.status}`;

    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return payload;
}


function normalizeAdminUsers(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.users)) {
    return payload.users;
  }

  return [];
}


function escapeAdminHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function formatAdminDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "2-digit"
    }
  );
}


function getUserPlan(user) {
  return String(
    user?.plan || "free"
  ).toLowerCase();
}


function getQuotaLimit(user) {
  const value = Number(
    user?.quota_limit
  );

  if (Number.isFinite(value)) {
    return value;
  }

  return getUserPlan(user) === "paid"
    ? 100
    : 5;
}


function getQuotaUsed(user) {
  const value = Number(
    user?.quota_used
  );

  return Number.isFinite(value)
    ? value
    : 0;
}


function renderAdminSummary(users) {
  const free = users.filter(
    (user) =>
      getUserPlan(user) === "free"
  ).length;

  const paid = users.filter(
    (user) =>
      getUserPlan(user) === "paid"
  ).length;

  const vehicles = users.reduce(
    (sum, user) => {
      const count = Number(
        user?.vehicles_count
      );

      return (
        sum +
        (Number.isFinite(count)
          ? count
          : 0)
      );
    },
    0
  );

  adminEl("adminUsersCount").textContent =
    String(users.length);

  adminEl("adminFreeCount").textContent =
    String(free);

  adminEl("adminPaidCount").textContent =
    String(paid);

  adminEl("adminVehiclesCount").textContent =
    String(vehicles);
}


function renderAdminUsers(users) {
  const body = adminEl(
    "adminUsersBody"
  );

  if (!body) return;

  if (!users.length) {
    body.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="admin-empty"
        >
          No users found.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = users
    .map((user) => {
      const userId = escapeAdminHtml(
        user.user_id ||
        user.id ||
        ""
      );

      const email = escapeAdminHtml(
        user.email ||
        "No email"
      );

      const name = escapeAdminHtml(
        user.name ||
        "PULS user"
      );

      const plan =
        getUserPlan(user);

      const planLabel =
        plan === "paid"
          ? "Paid"
          : "Free";

      const planClass =
        plan === "paid"
          ? "admin-badge-paid"
          : "admin-badge-free";

      const used =
        getQuotaUsed(user);

      const limit =
        getQuotaLimit(user);

      const vehicles = Number(
        user.vehicles_count
      );

      const vehiclesCount =
        Number.isFinite(vehicles)
          ? vehicles
          : 0;

      const isBlocked =
        user.blocked === true;

      const blockStatus =
        isBlocked
          ? `
              <span
                class="admin-badge admin-badge-blocked"
              >
                🔒 Blocked
              </span>
            `
          : "";

      const blockButton =
        isBlocked
          ? `
              <button
                class="admin-button"
                type="button"
                data-admin-action="unblock"
                data-user-id="${userId}"
              >
                Unblock
              </button>
            `
          : `
              <button
                class="admin-button"
                type="button"
                data-admin-action="block"
                data-user-id="${userId}"
              >
                Block
              </button>
            `;

      return `
        <tr
          data-admin-user-id="${userId}"
        >
          <td>
            <div
              class="admin-user-name"
            >
              ${name}
              ${blockStatus}
            </div>

            <div
              class="admin-user-email"
            >
              ${email}
            </div>
          </td>

          <td>
            <span
              class="admin-badge ${planClass}"
            >
              ${planLabel}
            </span>
          </td>

          <td>
            ${used} / ${limit}
          </td>

          <td>
            ${vehiclesCount}
          </td>

          <td>
            ${escapeAdminHtml(
              formatAdminDate(
                user.created_at
              )
            )}
          </td>

          <td>
            <div
              class="admin-actions"
            >
              <button
                class="admin-button"
                type="button"
                data-admin-action="reset-quota"
                data-user-id="${userId}"
              >
                Reset quota
              </button>

              <button
                class="admin-button"
                type="button"
                data-admin-action="change-plan"
                data-user-id="${userId}"
              >
                Change plan
              </button>

              ${blockButton}

              <button
                class="admin-button"
                type="button"
                data-admin-action="clear-history"
                data-user-id="${userId}"
              >
                Clear history
              </button>

              <button
                class="admin-button admin-button-danger"
                type="button"
                data-admin-action="delete"
                data-user-id="${userId}"
              >
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}


function filterAdminUsers() {
  const query = String(
    adminEl(
      "adminSearchInput"
    )?.value || ""
  )
    .trim()
    .toLowerCase();

  if (!query) {
    renderAdminUsers(
      adminUsers
    );
    return;
  }

  const filtered =
    adminUsers.filter((user) => {
      const email = String(
        user.email || ""
      ).toLowerCase();

      const name = String(
        user.name || ""
      ).toLowerCase();

      return (
        email.includes(query) ||
        name.includes(query)
      );
    });

  renderAdminUsers(filtered);
}


function findAdminUser(userId) {
  return (
    adminUsers.find((user) => {
      return String(
        user.user_id ||
        user.id ||
        ""
      ) === String(userId);
    }) || null
  );
}


async function loadAdminUsers() {
  setAdminStatus(
    "Loading users..."
  );

  try {
    const payload =
      await adminFetch(
        "/admin/users"
      );

    adminUsers =
      normalizeAdminUsers(
        payload
      );

    renderAdminSummary(
      adminUsers
    );

    filterAdminUsers();

    setAdminStatus("");
  } catch (error) {
    console.error(
      "Could not load admin users:",
      error
    );

    if (
      error.message ===
        "AUTH_REQUIRED" ||
      error.status === 401
    ) {
      showAdminAccessError(
        "Authentication required. Sign in to PULS first, then open the admin page again."
      );
      return;
    }

    if (error.status === 403) {
      showAdminAccessError(
        "Access denied. This PULS account is not an administrator."
      );
      return;
    }

    setAdminStatus(
      `Could not load users: ${error.message}`,
      "error"
    );
  }
}


function showAdminContent(session) {
  const access = adminEl(
    "adminAccessState"
  );

  const content = adminEl(
    "adminContent"
  );

  const identity = adminEl(
    "adminIdentity"
  );

  if (access) {
    access.hidden = true;
  }

  if (content) {
    content.hidden = false;
  }

  if (identity) {
    identity.textContent =
      session?.user?.email ||
      "PULS administrator";
  }
}


function showAdminAccessError(
  message
) {
  const access = adminEl(
    "adminAccessState"
  );

  const content = adminEl(
    "adminContent"
  );

  const messageNode = adminEl(
    "adminAccessMessage"
  );

  if (content) {
    content.hidden = true;
  }

  if (access) {
    access.hidden = false;
  }

  if (messageNode) {
    messageNode.textContent =
      message;
  }
}


async function initializeAdmin() {
  if (!window.supabaseClient) {
    showAdminAccessError(
      "Supabase client is not available."
    );
    return;
  }

  const session =
    await getAdminSession();

  if (!session) {
    showAdminAccessError(
      "Authentication required. Sign in to PULS first, then return to this page."
    );
    return;
  }

  const identity = adminEl(
    "adminIdentity"
  );

  if (identity) {
    identity.textContent =
      session.user?.email ||
      "Checking access...";
  }

  try {
    const payload =
      await adminFetch(
        "/admin/users"
      );

    adminUsers =
      normalizeAdminUsers(
        payload
      );

    showAdminContent(session);

    renderAdminSummary(
      adminUsers
    );

    renderAdminUsers(
      adminUsers
    );

    setAdminStatus("");

    const hash = String(window.location.hash || "").replace(/^#/, "");
    if (hash.startsWith("knowledge")) {
      const requestedTab = hash.split("/")[1];
      if (requestedTab && inspectorLoaders[requestedTab]) inspectorState.tab = requestedTab;
      await selectAdminSection("knowledge");
    } else if (hash.startsWith("live-flow")) {
      await selectAdminSection("live-flow");
    }
  } catch (error) {
    console.error(
      "Admin initialization failed:",
      error
    );

    if (
      error.message ===
        "AUTH_REQUIRED" ||
      error.status === 401
    ) {
      showAdminAccessError(
        "Authentication required. Sign in to PULS first."
      );
      return;
    }

    if (error.status === 403) {
      showAdminAccessError(
        "Access denied. This PULS account is not an administrator."
      );
      return;
    }

    showAdminAccessError(
      `Could not open PULS Admin: ${error.message}`
    );
  }
}


async function resetAdminQuota(
  user
) {
  const userId =
    user?.user_id ||
    user?.id;

  if (!userId) return;

  const confirmed =
    window.confirm(
      `Reset search quota for ${user.email || "this user"}?`
    );

  if (!confirmed) return;

  setAdminStatus(
    `Resetting quota for ${user.email || "user"}...`
  );

  try {
    await adminFetch(
      `/admin/users/${encodeURIComponent(userId)}/reset-quota`,
      {
        method: "POST"
      }
    );

    setAdminStatus(
      "Quota reset successfully.",
      "success"
    );

    await loadAdminUsers();
  } catch (error) {
    setAdminStatus(
      `Could not reset quota: ${error.message}`,
      "error"
    );
  }
}


function openPlanModal(user) {
  selectedPlanUser = user;

  const modal =
    adminEl("planModal");

  const userLabel =
    adminEl("planModalUser");

  const select =
    adminEl("planSelect");

  if (userLabel) {
    userLabel.textContent =
      user.email ||
      user.name ||
      "PULS user";
  }

  if (select) {
    select.value =
      getUserPlan(user) ===
      "paid"
        ? "paid"
        : "free";
  }

  modal?.classList.add(
    "show"
  );

  modal?.setAttribute(
    "aria-hidden",
    "false"
  );
}


function closePlanModal() {
  selectedPlanUser = null;

  const modal =
    adminEl("planModal");

  modal?.classList.remove(
    "show"
  );

  modal?.setAttribute(
    "aria-hidden",
    "true"
  );
}


async function saveAdminPlan() {
  if (!selectedPlanUser) {
    return;
  }

  const userId =
    selectedPlanUser.user_id ||
    selectedPlanUser.id;

  const plan = String(
    adminEl(
      "planSelect"
    )?.value || ""
  ).toLowerCase();

  if (
    !["free", "paid"].includes(
      plan
    )
  ) {
    setAdminStatus(
      "Invalid plan.",
      "error"
    );
    return;
  }

  const email =
    selectedPlanUser.email ||
    "user";

  closePlanModal();

  setAdminStatus(
    `Changing plan for ${email}...`
  );

  try {
    await adminFetch(
      `/admin/users/${encodeURIComponent(userId)}/plan`,
      {
        method: "PATCH",
        body: JSON.stringify({
          plan
        })
      }
    );

    setAdminStatus(
      "Plan changed successfully.",
      "success"
    );

    await loadAdminUsers();
  } catch (error) {
    setAdminStatus(
      `Could not change plan: ${error.message}`,
      "error"
    );
  }
}


async function blockAdminUser(
  user
) {
  const userId =
    user?.user_id ||
    user?.id;

  if (!userId) return;

  const confirmed =
    window.confirm(
      `Block ${user.email || "this user"} from signing in to PULS?`
    );

  if (!confirmed) return;

  setAdminStatus(
    `Blocking ${user.email || "user"}...`
  );

  try {
    await adminFetch(
      `/admin/users/${encodeURIComponent(userId)}/block`,
      {
        method: "POST"
      }
    );

    setAdminStatus(
      "User blocked successfully.",
      "success"
    );

    await loadAdminUsers();
  } catch (error) {
    setAdminStatus(
      `Could not block user: ${error.message}`,
      "error"
    );
  }
}


async function unblockAdminUser(
  user
) {
  const userId =
    user?.user_id ||
    user?.id;

  if (!userId) return;

  const confirmed =
    window.confirm(
      `Unblock ${user.email || "this user"} and allow sign in to PULS?`
    );

  if (!confirmed) return;

  setAdminStatus(
    `Unblocking ${user.email || "user"}...`
  );

  try {
    await adminFetch(
      `/admin/users/${encodeURIComponent(userId)}/unblock`,
      {
        method: "POST"
      }
    );

    setAdminStatus(
      "User unblocked successfully.",
      "success"
    );

    await loadAdminUsers();
  } catch (error) {
    setAdminStatus(
      `Could not unblock user: ${error.message}`,
      "error"
    );
  }
}


async function clearAdminUserHistory(
  user
) {
  const userId =
    user?.user_id ||
    user?.id;

  if (!userId) return;

  const email =
    user.email ||
    "this user";

  const confirmed =
    window.confirm(
      `Clear all PULS conversations and diagnostic history for ${email}?\n\nThe account, subscription and vehicles will be preserved.`
    );

  if (!confirmed) return;

  const finalConfirmation =
    window.confirm(
      `Are you sure?\n\nThis will permanently delete the PULS history for ${email}. This cannot be undone.`
    );

  if (!finalConfirmation) {
    return;
  }

  setAdminStatus(
    `Clearing history for ${email}...`
  );

  try {
    await adminFetch(
      `/admin/users/${encodeURIComponent(userId)}/clear-history`,
      {
        method: "POST"
      }
    );

    setAdminStatus(
      "User history cleared successfully.",
      "success"
    );

    await loadAdminUsers();
  } catch (error) {
    setAdminStatus(
      `Could not clear history: ${error.message}`,
      "error"
    );
  }
}


function openDeleteModal(user) {
  selectedDeleteUser = user;

  const modal =
    adminEl("deleteModal");

  const label =
    adminEl("deleteModalUser");

  const input =
    adminEl(
      "deleteConfirmInput"
    );

  const button =
    adminEl(
      "deleteModalConfirm"
    );

  if (label) {
    label.textContent =
      user.email ||
      user.name ||
      "PULS user";
  }

  if (input) {
    input.value = "";
  }

  if (button) {
    button.disabled = true;
  }

  modal?.classList.add(
    "show"
  );

  modal?.setAttribute(
    "aria-hidden",
    "false"
  );

  setTimeout(
    () => input?.focus(),
    0
  );
}


function closeDeleteModal() {
  selectedDeleteUser = null;

  const modal =
    adminEl("deleteModal");

  const input =
    adminEl(
      "deleteConfirmInput"
    );

  const button =
    adminEl(
      "deleteModalConfirm"
    );

  if (input) {
    input.value = "";
  }

  if (button) {
    button.disabled = true;
  }

  modal?.classList.remove(
    "show"
  );

  modal?.setAttribute(
    "aria-hidden",
    "true"
  );
}


function updateDeleteConfirmation() {
  const input =
    adminEl(
      "deleteConfirmInput"
    );

  const button =
    adminEl(
      "deleteModalConfirm"
    );

  if (
    !input ||
    !button ||
    !selectedDeleteUser
  ) {
    return;
  }

  const expected = String(
    selectedDeleteUser.email ||
    ""
  ).trim();

  const actual = String(
    input.value ||
    ""
  ).trim();

  button.disabled =
    !expected ||
    actual !== expected;
}


async function permanentlyDeleteAdminUser() {
  if (!selectedDeleteUser) {
    return;
  }

  const user =
    selectedDeleteUser;

  const userId =
    user.user_id ||
    user.id;

  const email =
    user.email ||
    "user";

  const inputValue = String(
    adminEl(
      "deleteConfirmInput"
    )?.value || ""
  ).trim();

  if (
    !user.email ||
    inputValue !== user.email
  ) {
    return;
  }

  const finalConfirmation =
    window.confirm(
      `PERMANENTLY delete ${email} and personal PULS data? This cannot be undone.`
    );

  if (!finalConfirmation) {
    return;
  }

  closeDeleteModal();

  setAdminStatus(
    `Deleting ${email}...`
  );

  try {
    await adminFetch(
      `/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "DELETE"
      }
    );

    setAdminStatus(
      "User deleted permanently.",
      "success"
    );

    await loadAdminUsers();
  } catch (error) {
    setAdminStatus(
      `Delete failed: ${error.message}`,
      "error"
    );
  }
}


async function handleAdminAction(
  button
) {
  const action =
    button.dataset.adminAction;

  const userId =
    button.dataset.userId;

  const user =
    findAdminUser(userId);

  if (!user) {
    setAdminStatus(
      "User not found.",
      "error"
    );
    return;
  }

  if (
    action ===
    "reset-quota"
  ) {
    await resetAdminQuota(
      user
    );
    return;
  }

  if (
    action ===
    "change-plan"
  ) {
    openPlanModal(user);
    return;
  }

  if (
    action ===
    "block"
  ) {
    await blockAdminUser(
      user
    );
    return;
  }

  if (
    action ===
    "unblock"
  ) {
    await unblockAdminUser(
      user
    );
    return;
  }

  if (
    action ===
    "clear-history"
  ) {
    await clearAdminUserHistory(
      user
    );
    return;
  }

  if (
    action ===
    "delete"
  ) {
    openDeleteModal(user);
  }
}


function setInspectorStatus(message = "", type = "") {
  const node = adminEl("inspectorStatus");
  if (!node) return;
  node.textContent = message;
  node.classList.remove("error", "success");
  if (type) node.classList.add(type);
}


function inspectorJson(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}


const INSPECTOR_RU_ENUM_LABELS = {
  TRANSMISSION: "ТРАНСМИССИЯ",
  OTHER: "ДРУГОЕ",
  ENGINE: "ДВИГАТЕЛЬ",
  ELECTRICAL: "ЭЛЕКТРИКА",
  BRAKES: "ТОРМОЗА",
  SUSPENSION: "ПОДВЕСКА",
  STEERING: "РУЛЕВОЕ УПРАВЛЕНИЕ",
  COOLING: "ОХЛАЖДЕНИЕ",
  FUEL: "ТОПЛИВНАЯ СИСТЕМА",
  EXHAUST: "ВЫХЛОПНАЯ СИСТЕМА",
  HVAC: "КЛИМАТ-КОНТРОЛЬ",
  BODY: "КУЗОВ",
  SYMPTOM: "СИМПТОМ",
  DTC: "КОД НЕИСПРАВНОСТИ",
  CHECK: "ПРОВЕРКА",
  REPAIR: "РЕМОНТ",
  SERVICE: "ОБСЛУЖИВАНИЕ",
  REPLACEMENT: "ЗАМЕНА",
  RESULT: "РЕЗУЛЬТАТ",
  MILEAGE: "ПРОБЕГ",
  NOTE: "ЗАМЕТКА",
  OPEN: "ОТКРЫТА",
  IN_PROGRESS: "В РАБОТЕ",
  AWAITING_CONFIRMATION: "ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ",
  SOLVED: "РЕШЕНА",
  CLOSED: "ЗАКРЫТА",
  ACTIVE: "АКТИВЕН",
  TRASHED: "В КОРЗИНЕ",
  RUNNING: "ВЫПОЛНЯЕТСЯ",
  COMPLETED: "ЗАВЕРШЕН",
  FAILED: "ОШИБКА"
};


function inspectorEnumLabel(value) {
  const canonical = String(value || "").trim().toUpperCase();
  if (!canonical) return "—";
  const isRussian = String(navigator.language || "").toLowerCase().startsWith("ru");
  return (isRussian ? INSPECTOR_RU_ENUM_LABELS[canonical] : "") || canonical.replaceAll("_", " ");
}


function inspectorVehicle(row) {
  const vehicle = row?.vehicle;
  if (!vehicle) return row?.vehicle_id ? `Vehicle #${row.vehicle_id}` : "—";
  return [vehicle.make || vehicle.brand, vehicle.model, vehicle.generation, vehicle.year]
    .filter(Boolean)
    .join(" ") || `Vehicle #${vehicle.id}`;
}


function inspectorConversationTitle(row) {
  return row?.title || row?.context?.initial_text || `Conversation #${row?.id || "—"}`;
}


function inspectorTimestamp(row) {
  return row?.last_message_at || row?.last_updated_at || row?.updated_at ||
    row?.event_date || row?.completed_at || row?.started_at ||
    row?.first_seen_at || row?.created_at || null;
}


function compactInspectorValue(value, maxLength = 180) {
  const text = inspectorJson(value).replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}


function inspectorUser(row) {
  const user = row?.user;
  return user?.email || user?.full_name || user?.name ||
    (row?.user_id ? `User #${row.user_id}` : "—");
}


function inspectorProblem(row) {
  return row?.problem?.title || row?.title ||
    (row?.problem_id ? `Problem #${row.problem_id}` : "—");
}


function safeInspectorUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}


function inspectorField(label, value) {
  return `<div class="inspector-field"><span>${escapeAdminHtml(label)}</span><div>${escapeAdminHtml(inspectorJson(value))}</div></div>`;
}


function inspectorMeta(label, value) {
  return `<div class="inspector-meta"><strong>${escapeAdminHtml(value ?? "—")}</strong><span>${escapeAdminHtml(label)}</span></div>`;
}


function inspectorRow({ id, kind, primary, secondary, meta = [], fields = [], body = "" }) {
  return `
    <details class="inspector-row" data-inspector-kind="${escapeAdminHtml(kind)}" data-inspector-id="${escapeAdminHtml(id)}">
      <summary>
        <div class="inspector-primary"><strong>${escapeAdminHtml(primary || "Untitled")}</strong><span>${escapeAdminHtml(secondary || `#${id}`)}</span></div>
        ${meta.slice(0, 3).map((item) => inspectorMeta(item.label, item.value)).join("")}
      </summary>
      <div class="inspector-detail">
        ${fields.length ? `<div class="inspector-detail-grid">${fields.map((item) => inspectorField(item.label, item.value)).join("")}</div>` : ""}
        ${body}
      </div>
    </details>`;
}


function renderInspectorLoading(targetId, label = "Loading real data…") {
  const node = adminEl(targetId);
  if (node) node.innerHTML = `<div class="admin-empty">${escapeAdminHtml(label)}</div>`;
}


function renderInspectorEmpty(targetId, label = "No canonical rows found.") {
  const node = adminEl(targetId);
  if (node) node.innerHTML = `<div class="admin-empty">${escapeAdminHtml(label)}</div>`;
}


function inspectorWarnings(payload) {
  const warnings = Array.isArray(payload?.warnings) ? payload.warnings.filter(Boolean) : [];
  return warnings.length
    ? `<div class="inspector-warning-list">${warnings.map((item) => `<div>${escapeAdminHtml(item)}</div>`).join("")}</div>`
    : "";
}


function inspectorCount(value) {
  return value === null || value === undefined ? "ERROR" : Number(value).toLocaleString();
}


function distributionRows(values, tab, filter = "", tabMap = {}) {
  const entries = Object.entries(values || {});
  if (!entries.length) return `<div class="admin-empty">No canonical values found.</div>`;
  const available = entries.map(([, value]) => Number(value)).filter(Number.isFinite);
  const max = Math.max(1, ...available);
  return entries.map(([label, value]) => {
    const unavailable = value === null || value === undefined;
    const width = unavailable ? 0 : Math.max(1, Math.round((Number(value) / max) * 100));
    const targetTab = tabMap[label] || tab;
    return `<button class="distribution-row" type="button" data-dashboard-tab="${escapeAdminHtml(targetTab)}" ${filter ? `data-dashboard-filter="${escapeAdminHtml(filter)}" data-dashboard-value="${escapeAdminHtml(label)}"` : ""}>
      <span class="distribution-label"><span title="${escapeAdminHtml(label)}">${escapeAdminHtml(inspectorEnumLabel(label))}</span><strong class="${unavailable ? "data-unavailable" : ""}">${inspectorCount(value)}</strong></span>
      <span class="distribution-track"><span class="distribution-fill" style="width:${width}%"></span></span>
    </button>`;
  }).join("");
}


function dataFlowNode(label, value, tab) {
  const unavailable = value === null || value === undefined;
  return `<button class="data-flow-node" type="button" data-dashboard-tab="${escapeAdminHtml(tab)}"><span>${escapeAdminHtml(label)}</span><strong class="${unavailable ? "data-unavailable" : ""}">${inspectorCount(value)}</strong></button>`;
}


function recentLabel(kind, row) {
  if (kind === "conversations") return inspectorConversationTitle(row);
  if (kind === "search_episodes") return row?.problem?.title || `Search Episode #${row?.id || "—"}`;
  return row?.title || row?.summary || row?.symptom_summary || `${kind.replaceAll("_", " ")} #${row?.id || "—"}`;
}


function renderRecentGroups(recent, errors) {
  const specs = [
    ["conversations", "Recent conversations", "conversations"],
    ["problems", "Recent problems", "problems"],
    ["search_episodes", "Recent searches", "search"],
    ["knowledge_items", "Recent knowledge", "knowledge"]
  ];
  return specs.map(([key, label, tab]) => {
    const items = recent?.[key];
    const error = errors?.[`recent.${key}`];
    let content = `<div class="admin-status">No recent rows.</div>`;
    if (error) content = `<div class="admin-status inspector-error">Unavailable</div>`;
    else if (Array.isArray(items) && items.length) content = items.map((row) => `
      <button class="recent-item distribution-row" type="button" data-dashboard-tab="${tab}">
        <strong>${escapeAdminHtml(recentLabel(key, row))}</strong>
        <span>${escapeAdminHtml(inspectorEnumLabel(row.status || row.problem_class || row.provenance_type))} · ${escapeAdminHtml(formatAdminDate(inspectorTimestamp(row)))}</span>
      </button>`).join("");
    return `<section class="recent-group"><h3>${label}</h3>${content}</section>`;
  }).join("");
}


function inspectorQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, value);
    }
  });
  return query.toString();
}


function renderInspectorPager(kind, payload, targetId) {
  const node = adminEl(targetId);
  if (!node) return;
  const offset = Number(payload?.offset || 0);
  const limit = Number(payload?.limit || inspectorState.limit);
  const total = Number(payload?.total || 0);
  const start = total ? offset + 1 : 0;
  const end = Math.min(offset + limit, total);
  node.innerHTML = `
    <span>${start}–${end} of ${total}</span>
    <button class="admin-button" type="button" data-inspector-page="${kind}" data-delta="-${limit}" ${offset <= 0 ? "disabled" : ""}>Previous</button>
    <button class="admin-button" type="button" data-inspector-page="${kind}" data-delta="${limit}" ${offset + limit >= total ? "disabled" : ""}>Next</button>`;
}


async function loadInspectorOverview() {
  renderInspectorLoading("inspectorStats");
  renderInspectorLoading("inspectorRecent");
  const payload = await adminFetch("/admin/knowledge/overview");
  const labels = {
    users: ["Users", "users"], vehicles: ["Vehicles", "vehicles"],
    conversations: ["Conversations", "conversations"], messages: ["Messages", "conversations"],
    active_problems: ["Active problems", "problems"], vehicle_events: ["Vehicle events", "events"],
    search_episodes: ["Search episodes", "search"], search_runs: ["Search runs", "search"],
    sources: ["Sources", "sources"], knowledge_items: ["Knowledge items", "knowledge"]
  };
  adminEl("inspectorStats").innerHTML = Object.entries(labels).map(([key, [label, tab]]) => {
    const value = payload?.metrics?.[key];
    const target = tab === "users" ? `data-admin-jump="users"` : `data-dashboard-tab="${tab}"`;
    return `<button class="inspector-stat-card" type="button" ${target}><span>${label}</span><strong class="${value === null || value === undefined ? "data-unavailable" : ""}">${inspectorCount(value)}</strong></button>`;
  }).join("");

  const counts = payload?.counts || {};
  adminEl("inspectorDataFlow").innerHTML = `
    <div class="data-flow-label">Raw conversation layer</div>
    <div class="data-flow-lane">${dataFlowNode("Conversations", counts.conversations, "conversations")}<span class="data-flow-arrow">→</span>${dataFlowNode("Messages", counts.messages, "conversations")}<span class="data-flow-arrow">→</span>${dataFlowNode("Problems", counts.problems, "problems")}</div>
    <div class="data-flow-lane"><span class="data-flow-arrow">↙</span>${dataFlowNode("Vehicle Events", counts.vehicle_events, "events")}<span class="data-flow-arrow">↘</span>${dataFlowNode("Search Episodes", counts.search_episodes, "search")}<span class="data-flow-arrow">→</span>${dataFlowNode("Search Runs", counts.search_runs, "search")}<span class="data-flow-arrow">→</span>${dataFlowNode("Sources", counts.sources, "sources")}<span class="data-flow-arrow">→</span>${dataFlowNode("Problem Sources", counts.problem_sources, "sources")}</div>
    <div class="data-flow-divider"></div><div class="data-flow-label">Reusable knowledge layer — no direct Problem relationship</div>
    <div class="data-flow-lane">${dataFlowNode("Sources", counts.sources, "sources")}<span class="data-flow-arrow">↔</span>${dataFlowNode("Knowledge Sources", counts.knowledge_sources, "knowledge")}<span class="data-flow-arrow">↔</span>${dataFlowNode("Knowledge Items", counts.knowledge_items, "knowledge")}</div>`;

  adminEl("inspectorDataVolume").innerHTML = distributionRows(
    payload?.distributions?.data_volume, "overview", "", {
      messages: "conversations", problems: "problems", vehicle_events: "events",
      search_runs: "search", sources: "sources", knowledge_items: "knowledge"
    }
  );
  adminEl("inspectorProblemStatus").innerHTML = distributionRows(payload?.distributions?.problem_status, "problems", "problemStatus");
  adminEl("inspectorEventTypes").innerHTML = distributionRows(payload?.distributions?.vehicle_event_type, "events", "eventType");
  adminEl("inspectorSourceTypes").innerHTML = distributionRows(payload?.distributions?.source_type, "sources", "sourceType");

  const pipeline = [
    ["Search Episodes", counts.search_episodes, "search"], ["Search Runs", counts.search_runs, "search"],
    ["Sources", counts.sources, "sources"], ["Problem Sources", counts.problem_sources, "sources"]
  ];
  adminEl("inspectorSearchPipeline").innerHTML = pipeline.map(([label, value, tab], index) => {
    const previous = index ? Number(pipeline[index - 1][1]) : 0;
    const gap = value !== null && value !== undefined && previous > 0 && Number(value) === 0;
    return `<button class="pipeline-node ${gap ? "is-gap" : ""}" type="button" data-dashboard-tab="${tab}"><span>${label}</span><strong class="${value === null || value === undefined ? "data-unavailable" : ""}">${inspectorCount(value)}</strong></button>`;
  }).join("");

  adminEl("inspectorRecent").innerHTML = renderRecentGroups(payload?.recent, payload?.errors);
  const failures = Object.keys(payload?.errors || {}).length;
  adminEl("inspectorOverviewErrors").innerHTML = failures
    ? `<div class="inspector-warning-list">${failures} dashboard metric${failures === 1 ? " is" : "s are"} unavailable; affected values are marked ERROR.</div>`
    : "";
}


async function loadInspectorVehicles() {
  const kind = "vehicles";
  renderInspectorLoading("vehicleList");
  const query = inspectorQuery({
    limit: inspectorState.limit, offset: inspectorState.offsets[kind],
    q: adminEl("vehicleSearch")?.value,
    lifecycle_status: adminEl("vehicleLifecycleStatus")?.value
  });
  const payload = await adminFetch(`/admin/knowledge/vehicles?${query}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) renderInspectorEmpty("vehicleList");
  else adminEl("vehicleList").innerHTML = items.map((row) => inspectorRow({
    id: row.id, kind: "vehicle",
    primary: [row.make || row.brand, row.model, row.generation, row.year].filter(Boolean).join(" ") || `Vehicle #${row.id}`,
    secondary: inspectorUser(row),
    meta: [
      { label: "Lifecycle", value: inspectorEnumLabel(row.lifecycle_status || "ACTIVE") },
      { label: "Problems", value: row.problem_count ?? "ERROR" },
      { label: "Events", value: row.event_count ?? "ERROR" }
    ],
    fields: [
      { label: "VIN / chassis", value: row.vin || row.chassis_number },
      { label: "Engine", value: row.engine_code || row.engine },
      { label: "Transmission", value: row.transmission },
      { label: "Fuel", value: row.fuel_type || row.fuel },
      { label: "Drivetrain", value: row.drivetrain || row.drive },
      { label: "Mileage", value: [row.mileage, row.mileage_unit].filter((value) => value !== null && value !== undefined && value !== "").join(" ") },
      { label: "Created", value: row.created_at },
      { label: "Updated", value: row.updated_at }
    ],
    body: `<div class="inspector-specs" data-vehicle-specs="${escapeAdminHtml(row.id)}"><div class="admin-empty">Expand to load ${escapeAdminHtml(row.spec_count ?? "—")} specification rows.</div></div>`
  })).join("");
  if (payload?.warnings?.length) adminEl("vehicleList").insertAdjacentHTML("afterbegin", inspectorWarnings(payload));
  renderInspectorPager(kind, payload, "vehiclePager");
}


async function loadVehicleSpecs(details) {
  const id = details.dataset.inspectorId;
  const target = details.querySelector(`[data-vehicle-specs="${CSS.escape(id)}"]`);
  if (!target || target.dataset.loaded === "true") return;
  target.innerHTML = `<div class="admin-empty">Loading vehicle specifications…</div>`;
  try {
    const payload = await adminFetch(`/admin/knowledge/vehicles/${encodeURIComponent(id)}/specs?limit=100`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    target.dataset.loaded = "true";
    target.innerHTML = items.length ? items.map((row) => inspectorRow({
      id: row.id, kind: "vehicle-spec",
      primary: row.parameter_name || row.parameter_key || `Specification #${row.id}`,
      secondary: row.category || "general",
      meta: [
        { label: "Actual", value: [row.actual_value, row.actual_unit].filter(Boolean).join(" ") || "—" },
        { label: "Recommended", value: [row.recommended_value, row.recommended_unit].filter(Boolean).join(" ") || "—" },
        { label: "Source", value: row.source_type || "—" }
      ],
      fields: Object.entries(row).map(([label, value]) => ({ label, value }))
    })).join("") : `<div class="admin-empty">No specification rows for this vehicle.</div>`;
    if (Number(payload?.total || 0) > items.length) {
      target.insertAdjacentHTML("beforeend", `<div class="admin-status">Showing first ${items.length} of ${payload.total} specifications.</div>`);
    }
  } catch (error) {
    target.innerHTML = `<div class="admin-empty inspector-error">${escapeAdminHtml(error.message)}</div>`;
  }
}


async function loadInspectorConversations() {
  const kind = "conversations";
  renderInspectorLoading("conversationList");
  const query = inspectorQuery({
    limit: inspectorState.limit, offset: inspectorState.offsets[kind],
    q: adminEl("conversationSearch")?.value, status: adminEl("conversationStatus")?.value
  });
  const payload = await adminFetch(`/admin/knowledge/conversations?${query}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) renderInspectorEmpty("conversationList");
  else adminEl("conversationList").innerHTML = items.map((row) => inspectorRow({
    id: row.id, kind: "conversation", primary: inspectorConversationTitle(row),
    secondary: `${inspectorUser(row)} · ${inspectorVehicle(row)}`,
    meta: [
      { label: "Status", value: inspectorEnumLabel(row.status) },
      { label: "Messages", value: row.message_count ?? 0 },
      { label: "Last message", value: formatAdminDate(row.last_message_at) }
    ],
    fields: [
      { label: "Problem", value: row.problem?.title || row.problem_id },
      { label: "Type", value: row.conversation_type },
      { label: "Started", value: row.started_at },
      { label: "Context", value: row.context }
    ], body: `<div class="inspector-messages" data-conversation-messages="${escapeAdminHtml(row.id)}"><div class="admin-empty">Expand to load messages.</div></div>`
  })).join("");
  if (payload?.warnings?.length) adminEl("conversationList").insertAdjacentHTML("afterbegin", inspectorWarnings(payload));
  renderInspectorPager(kind, payload, "conversationPager");
}


async function loadConversationMessages(details) {
  const id = details.dataset.inspectorId;
  const target = details.querySelector(`[data-conversation-messages="${CSS.escape(id)}"]`);
  if (!target || target.dataset.loaded === "true") return;
  target.innerHTML = `<div class="admin-empty">Loading messages…</div>`;
  try {
    const payload = await adminFetch(`/admin/knowledge/conversations/${encodeURIComponent(id)}/messages?limit=100`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    target.dataset.loaded = "true";
    target.innerHTML = items.length ? items.map((row) => {
      const role = String(row.role || "unknown").toLowerCase();
      return `<article class="inspector-message is-${escapeAdminHtml(role)}"><header>${escapeAdminHtml(role)} · ${escapeAdminHtml(formatAdminDate(row.created_at))}</header><div>${escapeAdminHtml(row.content || row.message_text || "")}</div></article>`;
    }).join("") : `<div class="admin-empty">No messages in this conversation.</div>`;
    if (Number(payload?.total || 0) > items.length) {
      target.insertAdjacentHTML("beforeend", `<div class="admin-status">Showing first ${items.length} of ${payload.total} messages.</div>`);
    }
  } catch (error) {
    target.innerHTML = `<div class="admin-empty inspector-error">${escapeAdminHtml(error.message)}</div>`;
  }
}


async function loadInspectorProblems() {
  const kind = "problems";
  renderInspectorLoading("problemList");
  const query = inspectorQuery({
    limit: inspectorState.limit, offset: inspectorState.offsets[kind],
    q: adminEl("problemSearch")?.value, problem_class: adminEl("problemClass")?.value,
    status: adminEl("problemStatus")?.value
  });
  const payload = await adminFetch(`/admin/knowledge/problems?${query}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) renderInspectorEmpty("problemList");
  else adminEl("problemList").innerHTML = items.map((row) => inspectorRow({
    id: row.id, kind: "problem", primary: row.title || `Problem #${row.id}`,
    secondary: `${inspectorUser(row)} · ${inspectorVehicle(row)}`,
    meta: [
      { label: "Class", value: inspectorEnumLabel(row.problem_class) },
      { label: "Component", value: row.component || "—" },
      { label: "Status", value: inspectorEnumLabel(row.status) }
    ],
    fields: [
      { label: "Symptoms", value: row.symptoms }, { label: "Conditions", value: row.conditions },
      { label: "Confirmed facts", value: row.confirmed_facts }, { label: "Hypotheses", value: row.hypotheses },
      { label: "Checks summary", value: row.checks_summary }, { label: "Actions summary", value: row.actions_summary },
      { label: "Current conclusion", value: row.current_conclusion }, { label: "Next step", value: row.next_step },
      { label: "First seen", value: row.first_seen_at }, { label: "Last updated", value: row.updated_at },
      { label: "Confirmation", value: row.confirmation }
    ], body: `<div class="inspector-trace"><button class="admin-button" type="button" data-load-trace="${escapeAdminHtml(row.id)}">Load Problem Trace</button><div data-problem-trace="${escapeAdminHtml(row.id)}"></div></div>`
  })).join("");
  if (payload?.warnings?.length) adminEl("problemList").insertAdjacentHTML("afterbegin", inspectorWarnings(payload));
  renderInspectorPager(kind, payload, "problemPager");
}


function traceRowSummary(label, row) {
  if (label === "Conversations") return inspectorConversationTitle(row);
  if (label === "Relevant messages") return `${row.role || "MESSAGE"}: ${compactInspectorValue(row.content || row.message_text || "")}`;
  if (label === "Vehicle events") return `${row.event_type || "EVENT"}: ${row.title || compactInspectorValue(row.details)}`;
  if (label === "Search episodes") return `Episode ${row.id} · ${row.status || "—"} · ${compactInspectorValue(row.search_context?.reason || row.search_context)}`;
  if (label === "Search runs") return `Stage ${row.stage_number || "—"} · ${row.status || "—"} · ${compactInspectorValue(row.result_summary || row.query)}`;
  if (label === "Problem sources") return `${row.relation_type || "SOURCE"} · relevance ${row.relevance_score ?? "—"} · ${compactInspectorValue(row.extracted_evidence)}`;
  if (label === "Sources") return `${row.title || row.url || "Source"} · ${row.source_type || "—"}`;
  if (label === "Fleet events") return row.symptom_summary || row.confirmed_cause || `Fleet event ${row.id}`;
  if (label === "Vehicle") return inspectorVehicle({ vehicle: row });
  return row.title || row.summary || `${label} #${row.id || "—"}`;
}


function traceGroup(label, rows) {
  const items = Array.isArray(rows) ? rows : [];
  return `<section class="trace-group"><h3>${escapeAdminHtml(label)} (${items.length})</h3>${items.length ? items.map((row) => `
    <details class="trace-item"><summary><strong>${escapeAdminHtml(traceRowSummary(label, row))}</strong><span>${escapeAdminHtml(formatAdminDate(inspectorTimestamp(row)))}</span></summary><pre class="inspector-json">${escapeAdminHtml(JSON.stringify(row, null, 2))}</pre></details>`).join("") : `<div class="admin-status">No linked rows.</div>`}</section>`;
}


async function loadProblemTrace(problemId) {
  const target = document.querySelector(`[data-problem-trace="${CSS.escape(String(problemId))}"]`);
  if (!target || target.dataset.loaded === "true") return;
  target.innerHTML = `<div class="admin-status">Resolving canonical relations…</div>`;
  try {
    const trace = await adminFetch(`/admin/knowledge/problems/${encodeURIComponent(problemId)}/trace`);
    target.dataset.loaded = "true";
    target.innerHTML = [
      traceGroup("Vehicle", trace.vehicle ? [trace.vehicle] : []),
      traceGroup("Conversations", trace.conversations), traceGroup("Relevant messages", trace.messages),
      traceGroup("Vehicle events", trace.vehicle_events), traceGroup("Search episodes", trace.search_episodes),
      traceGroup("Search runs", trace.search_runs), traceGroup("Problem sources", trace.problem_sources),
      traceGroup("Sources", trace.sources), traceGroup("Fleet events", trace.fleet_events),
      traceGroup("Knowledge items", trace.knowledge_items),
      inspectorWarnings(trace),
      (trace.limitations || []).map((item) => `<div class="admin-status">Limitation: ${escapeAdminHtml(item)}</div>`).join("")
    ].join("");
  } catch (error) {
    target.innerHTML = `<div class="admin-status inspector-error">${escapeAdminHtml(error.message)}</div>`;
  }
}


async function loadInspectorEvents() {
  const kind = "events";
  renderInspectorLoading("eventList");
  const query = inspectorQuery({
    limit: inspectorState.limit, offset: inspectorState.offsets[kind],
    q: adminEl("eventSearch")?.value, event_type: adminEl("eventType")?.value
  });
  const payload = await adminFetch(`/admin/knowledge/vehicle-events?${query}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) renderInspectorEmpty("eventList");
  else adminEl("eventList").innerHTML = items.map((row) => inspectorRow({
    id: row.id, kind: "event", primary: row.title || row.event_type || `Event #${row.id}`,
    secondary: `${inspectorVehicle(row)} · ${inspectorProblem(row)}`,
    meta: [
      { label: "Type", value: inspectorEnumLabel(row.event_type) },
      { label: "Source", value: row.source_kind || row.source || "—" },
      { label: "Event date", value: formatAdminDate(row.event_date || row.occurred_at) }
    ], fields: [
      { label: "Details", value: row.details || row.description }, { label: "Mileage", value: row.mileage },
      { label: "Result", value: row.result }, { label: "Created", value: row.created_at }
    ]
  })).join("");
  if (payload?.warnings?.length) adminEl("eventList").insertAdjacentHTML("afterbegin", inspectorWarnings(payload));
  renderInspectorPager(kind, payload, "eventPager");
}


async function loadInspectorSearch() {
  const kind = "search";
  renderInspectorLoading("episodeList");
  const query = inspectorQuery({
    limit: inspectorState.limit, offset: inspectorState.offsets[kind],
    status: adminEl("episodeStatus")?.value
  });
  const payload = await adminFetch(`/admin/knowledge/search-episodes?${query}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) renderInspectorEmpty("episodeList");
  else adminEl("episodeList").innerHTML = items.map((row) => inspectorRow({
    id: row.id, kind: "episode", primary: row.problem?.title || `Search Episode #${row.id}`,
    secondary: `${inspectorVehicle(row)} · ${compactInspectorValue(row.search_context?.reason || row.search_context || "No trigger recorded")}`,
    meta: [
      { label: "Status", value: row.status || "—" },
      { label: "Started", value: formatAdminDate(row.started_at) },
      { label: "Updated", value: formatAdminDate(row.updated_at) }
    ], fields: [
      { label: "Episode id", value: row.id },
      { label: "Linked problem", value: row.problem?.title || row.problem_id },
      { label: "Trigger / reason", value: row.search_context?.reason || row.search_context },
      { label: "Current stage", value: row.current_stage },
      { label: "Completed", value: row.completed_at },
      { label: "Final summary", value: row.final_summary }
    ],
    body: `<div class="inspector-runs" data-episode-runs="${escapeAdminHtml(row.id)}"><div class="admin-empty">Expand to load search stages.</div></div>`
  })).join("");
  if (payload?.warnings?.length) adminEl("episodeList").insertAdjacentHTML("afterbegin", inspectorWarnings(payload));
  renderInspectorPager(kind, payload, "episodePager");
}


async function loadEpisodeRuns(details) {
  const id = details.dataset.inspectorId;
  const target = details.querySelector(`[data-episode-runs="${CSS.escape(id)}"]`);
  if (!target || target.dataset.loaded === "true") return;
  target.innerHTML = `<div class="admin-empty">Loading stages…</div>`;
  try {
    const payload = await adminFetch(`/admin/knowledge/search-episodes/${encodeURIComponent(id)}/runs?limit=50`);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    target.dataset.loaded = "true";
    target.innerHTML = items.length ? items.map((run) => `
      <article class="inspector-run">
        <header>Stage ${escapeAdminHtml(run.stage_number)} · ${escapeAdminHtml(run.status || "—")} · ${escapeAdminHtml(run.provider || "provider —")} / ${escapeAdminHtml(run.model || "model —")}</header>
        <div><strong>Mode:</strong> ${escapeAdminHtml(run.run_type || "—")}</div>
        <div><strong>Started:</strong> ${escapeAdminHtml(formatAdminDate(run.started_at))} · <strong>Completed:</strong> ${escapeAdminHtml(formatAdminDate(run.completed_at))}</div>
        <div><strong>Query:</strong> ${escapeAdminHtml(compactInspectorValue(run.query))}</div>
        <div><strong>Input:</strong> ${escapeAdminHtml(compactInspectorValue(run.input_context))}</div>
        <div><strong>Sufficient:</strong> ${run.sufficient_evidence === true ? "yes" : "no"}</div>
        <div><strong>Summary:</strong> ${escapeAdminHtml(compactInspectorValue(run.result_summary))}</div>
        <div><strong>Sources found:</strong> ${escapeAdminHtml(run.sources_found ?? "—")} · <strong>Relevant:</strong> ${escapeAdminHtml(run.relevant_sources ?? "—")}</div>
        ${run.next_stage_reason ? `<div><strong>Next stage:</strong> ${escapeAdminHtml(compactInspectorValue(run.next_stage_reason))}</div>` : ""}
        ${run.error_message ? `<div class="inspector-error"><strong>Error:</strong> ${escapeAdminHtml(run.error_message)}</div>` : ""}
        <details><summary>Raw persisted result</summary><pre class="inspector-json">${escapeAdminHtml(inspectorJson(run.result_data))}</pre></details>
      </article>`).join("") : `<div class="admin-empty">No search runs were persisted for this episode.</div>`;
  } catch (error) {
    target.innerHTML = `<div class="admin-empty inspector-error">${escapeAdminHtml(error.message)}</div>`;
  }
}


async function loadInspectorSources() {
  const kind = "sources";
  renderInspectorLoading("sourceList");
  const query = inspectorQuery({
    limit: inspectorState.limit, offset: inspectorState.offsets[kind],
    q: adminEl("sourceSearch")?.value, source_type: adminEl("sourceType")?.value
  });
  const payload = await adminFetch(`/admin/knowledge/sources?${query}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) renderInspectorEmpty("sourceList");
  else adminEl("sourceList").innerHTML = items.map((row) => {
    const url = safeInspectorUrl(row.url || row.canonical_url);
    return inspectorRow({
      id: row.id, kind: "source", primary: row.title || row.url || row.canonical_url || `Source #${row.id}`,
      secondary: row.domain || row.url || row.canonical_url,
      meta: [
        { label: "Type", value: row.source_type || "—" },
        { label: "Problems", value: row.problem_sources?.length || 0 },
        { label: "Updated", value: formatAdminDate(row.updated_at) }
      ], fields: [
        { label: "URL", value: row.url || row.canonical_url }, { label: "Domain", value: row.domain },
        { label: "Language", value: row.language }, { label: "Trust", value: row.trust_level },
        { label: "Status", value: row.status }, { label: "Description", value: row.description || row.metadata?.description },
        { label: "Metadata", value: row.metadata }, { label: "Problem relations", value: row.problem_sources }
      ], body: url ? `<p><a class="inspector-link" href="${escapeAdminHtml(url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a></p>` : ""
    });
  }).join("");
  if (payload?.warnings?.length) adminEl("sourceList").insertAdjacentHTML("afterbegin", inspectorWarnings(payload));
  renderInspectorPager(kind, payload, "sourcePager");
}


async function loadInspectorKnowledge() {
  const kind = "knowledge";
  renderInspectorLoading("knowledgeList");
  renderInspectorLoading("fleetList");
  const query = inspectorQuery({
    limit: inspectorState.limit, offset: inspectorState.offsets[kind],
    q: adminEl("knowledgeSearch")?.value
  });
  const [knowledge, fleet] = await Promise.all([
    adminFetch(`/admin/knowledge/items?${query}`),
    adminFetch(`/admin/knowledge/fleet-events?${query}`)
  ]);
  const items = Array.isArray(knowledge?.items) ? knowledge.items : [];
  const fleetItems = Array.isArray(fleet?.items) ? fleet.items : [];
  if (!items.length) renderInspectorEmpty("knowledgeList");
  else adminEl("knowledgeList").innerHTML = items.map((row) => inspectorRow({
    id: row.id, kind: "knowledge", primary: row.title || `Knowledge #${row.id}`,
    secondary: row.vehicle_configuration_id ? `Vehicle configuration #${row.vehicle_configuration_id}` : (row.provenance_type || "Reusable knowledge"),
    meta: [
      { label: "Confidence", value: row.confidence ?? "—" },
      { label: "Component", value: row.component || "—" },
      { label: "Sources", value: row.knowledge_sources?.length || 0 }
    ], fields: [
      { label: "Summary", value: row.summary }, { label: "Content", value: row.content },
      { label: "Vehicle configuration", value: row.vehicle_configuration_id },
      { label: "Problem class", value: row.problem_class }, { label: "Provenance", value: row.provenance_type },
      { label: "Metadata", value: row.metadata }, { label: "Source relations", value: row.knowledge_sources }
    ]
  })).join("");
  if (knowledge?.warnings?.length) adminEl("knowledgeList").insertAdjacentHTML("afterbegin", inspectorWarnings(knowledge));
  if (!fleetItems.length) renderInspectorEmpty("fleetList");
  else adminEl("fleetList").innerHTML = fleetItems.map((row) => inspectorRow({
    id: row.id, kind: "fleet", primary: row.symptom_summary || `Fleet Event #${row.id}`,
    secondary: `${row.problem_class || "—"} · ${row.component || "—"}`,
    meta: [
      { label: "Confidence", value: row.confidence ?? "—" },
      { label: "Problem", value: row.source_problem_id ? `#${row.source_problem_id}` : "—" },
      { label: "Created", value: formatAdminDate(row.created_at) }
    ], fields: [
      { label: "Vehicle signature", value: row.vehicle_signature }, { label: "Confirmed cause", value: row.confirmed_cause },
      { label: "Confirmed solution", value: row.confirmed_solution }, { label: "Confirmation data", value: row.confirmation_data }
    ]
  })).join("");
  if (fleet?.warnings?.length) adminEl("fleetList").insertAdjacentHTML("afterbegin", inspectorWarnings(fleet));
  renderInspectorPager(kind, {
    offset: knowledge.offset, limit: knowledge.limit,
    total: Math.max(Number(knowledge.total || 0), Number(fleet.total || 0))
  }, "knowledgePager");
}


const inspectorLoaders = {
  overview: loadInspectorOverview,
  vehicles: loadInspectorVehicles,
  conversations: loadInspectorConversations,
  problems: loadInspectorProblems,
  events: loadInspectorEvents,
  search: loadInspectorSearch,
  sources: loadInspectorSources,
  knowledge: loadInspectorKnowledge
};


async function loadInspectorTab(tab, force = false) {
  const loader = inspectorLoaders[tab];
  if (!loader || (!force && inspectorState.loaded.has(tab))) return;
  setInspectorStatus(`Loading ${tab}…`);
  try {
    await loader();
    inspectorState.loaded.add(tab);
    setInspectorStatus("");
  } catch (error) {
    console.error(`Could not load inspector ${tab}:`, error);
    setInspectorStatus(`Could not load ${tab}: ${error.message}`, "error");
  }
}


async function selectInspectorTab(tab) {
  if (!inspectorLoaders[tab]) tab = "overview";
  inspectorState.tab = tab;
  document.querySelectorAll("[data-inspector-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.inspectorTab === tab);
  });
  document.querySelectorAll(".inspector-panel").forEach((panel) => { panel.hidden = true; });
  const panelId = `inspector${tab.charAt(0).toUpperCase()}${tab.slice(1)}`;
  const panel = adminEl(panelId);
  if (panel) panel.hidden = false;
  window.history.replaceState(null, "", `#knowledge/${tab}`);
  await loadInspectorTab(tab);
}


function setSidebarCollapsed(collapsed, persist = true) {
  const shell = document.querySelector(".admin-shell");
  const toggle = adminEl("adminSidebarToggle");
  if (!shell || window.matchMedia("(max-width: 900px)").matches) return;
  shell.classList.toggle("is-sidebar-collapsed", collapsed);
  shell.classList.remove("is-sidebar-peek");
  toggle?.setAttribute("aria-expanded", String(!collapsed));
  toggle?.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
  if (persist) localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
}


function initializeSidebar() {
  const shell = document.querySelector(".admin-shell");
  const sidebar = document.querySelector(".admin-sidebar");
  if (!shell || !sidebar) return;
  setSidebarCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1", false);
  sidebar.addEventListener("mouseenter", () => {
    if (shell.classList.contains("is-sidebar-collapsed")) shell.classList.add("is-sidebar-peek");
  });
  sidebar.addEventListener("mouseleave", () => shell.classList.remove("is-sidebar-peek"));
}


const liveFlowState = {
  traces: [], trace: null, events: [], index: -1, timer: null,
  speed: 1, streamAbort: null, streamCursor: 0
};


function flowSetStatus(message = "", type = "") {
  const node = adminEl("flowStatusMessage");
  if (!node) return;
  node.textContent = message;
  node.className = `admin-status ${type}`.trim();
}


function flowValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}


function renderFlowTraces() {
  const node = adminEl("flowTraceList");
  if (!node) return;
  node.innerHTML = liveFlowState.traces.length ? liveFlowState.traces.map((trace) => `
    <button class="flow-trace ${liveFlowState.trace?.id === trace.id ? "is-selected" : ""}" type="button" data-flow-trace="${escapeAdminHtml(trace.id)}">
      <span><strong>${escapeAdminHtml(trace.status === "RUNNING" ? "LIVE" : "REPLAY")}</strong> ${escapeAdminHtml(trace.intent || "REQUEST")}</span>
      <span>${escapeAdminHtml(trace.user_label || trace.user_id || "unknown user")}</span>
      <span>${escapeAdminHtml(trace.message_excerpt || "No excerpt")}</span>
      <small>${escapeAdminHtml(trace.started_at || "")} · ${Number(trace.duration_ms || 0)} ms</small>
    </button>`).join("") : '<div class="admin-empty">No traces found.</div>';
}


async function loadFlowTraces() {
  const params = new URLSearchParams({ limit: "50" });
  const status = adminEl("flowStatus")?.value;
  const user = adminEl("flowUser")?.value.trim();
  const vehicle = adminEl("flowVehicle")?.value.trim();
  if (status) params.set("status", status);
  if (user) params.set("user_id", user);
  if (vehicle) params.set("vehicle_id", vehicle);
  const payload = await adminFetch(`/admin/knowledge/live-flow/traces?${params}`);
  liveFlowState.traces = Array.isArray(payload?.items) ? payload.items : [];
  renderFlowTraces();
}


function flowEventLabel(event) {
  return event.edge_label || event.operation || event.event_type || `Event ${event.sequence}`;
}


function selectFlowEvent(index) {
  const maximum = liveFlowState.events.length - 1;
  liveFlowState.index = Math.max(-1, Math.min(Number(index), maximum));
  if (adminEl("flowScrubber")) adminEl("flowScrubber").value = String(Math.max(0, liveFlowState.index));
  if (adminEl("flowClock")) adminEl("flowClock").textContent = `${Math.max(0, liveFlowState.index + 1)} / ${liveFlowState.events.length}`;
  renderFlowGraph();
  renderFlowTimeline();
  const event = liveFlowState.events[liveFlowState.index];
  if (event) adminEl("flowInspector").textContent = JSON.stringify(event, null, 2);
}


function renderFlowGraph() {
  const graph = adminEl("flowGraph");
  if (!graph) return;
  const applied = liveFlowState.events.slice(0, liveFlowState.index + 1);
  if (!applied.length) { graph.innerHTML = '<div class="admin-empty">No events at this point in time.</div>'; return; }
  const nodes = [];
  const seen = new Set();
  applied.forEach((event) => [event.from_node, event.to_node, event.table_name].filter(Boolean).forEach((name) => {
    if (!seen.has(name)) { seen.add(name); nodes.push(name); }
  }));
  const active = applied[applied.length - 1];
  graph.innerHTML = `<div class="flow-node-grid">${nodes.map((name) => {
    const isDb = applied.some((event) => event.table_name === name);
    const isActive = active && (active.from_node === name || active.to_node === name);
    return `<button type="button" class="flow-node ${isDb ? "is-db" : ""} ${isActive ? "is-active" : ""}" data-flow-node="${escapeAdminHtml(name)}">${isDb ? "▰ " : ""}${escapeAdminHtml(name)}</button>`;
  }).join("")}</div><div class="flow-edge-list">${applied.map((event, index) => `<button type="button" class="flow-edge ${index === applied.length - 1 ? "is-active" : ""}" data-flow-event="${index}"><span>${escapeAdminHtml(event.from_node || "Event")}</span><i><b></b>${escapeAdminHtml(flowEventLabel(event))}</i><span>${escapeAdminHtml(event.to_node || event.table_name || "Result")}</span></button>`).join("")}</div>`;
}


function renderFlowTimeline() {
  const node = adminEl("flowTimeline");
  if (!node) return;
  node.innerHTML = liveFlowState.events.map((event, index) => `<button type="button" class="flow-timeline-event ${index === liveFlowState.index ? "is-active" : ""}" data-flow-event="${index}"><b>${event.sequence}</b><span>${escapeAdminHtml(flowEventLabel(event))}</span><small>+${Number(event.offset_ms || 0)} ms</small></button>`).join("");
}


function renderFlowMedia() {
  const media = adminEl("flowMedia");
  if (!media) return;
  const events = liveFlowState.events.filter((event) => ["SOURCE", "IMAGE"].includes(event.event_type));
  media.innerHTML = events.length ? events.map((event, index) => `<button type="button" class="flow-media-item" data-flow-event="${liveFlowState.events.indexOf(event)}"><strong>${escapeAdminHtml(event.event_type)} · ${escapeAdminHtml(event.status)}</strong><span>${escapeAdminHtml(event.output_data?.title || event.output_data?.url || flowEventLabel(event))}</span><small>${escapeAdminHtml(event.output_data?.reason || event.output_data?.state || "retained")}</small></button>`).join("") : '<div class="admin-empty">No source or image events.</div>';
}


function stopFlowPlayback() {
  if (liveFlowState.timer) clearTimeout(liveFlowState.timer);
  liveFlowState.timer = null;
}


function playFlowReplay() {
  stopFlowPlayback();
  if (!liveFlowState.events.length) return;
  if (liveFlowState.index >= liveFlowState.events.length - 1) liveFlowState.index = -1;
  const step = () => {
    if (liveFlowState.index >= liveFlowState.events.length - 1) { stopFlowPlayback(); return; }
    const current = liveFlowState.events[Math.max(0, liveFlowState.index)];
    const next = liveFlowState.events[liveFlowState.index + 1];
    selectFlowEvent(liveFlowState.index + 1);
    const delta = Math.max(80, Math.min(1800, Number(next?.offset_ms || 0) - Number(current?.offset_ms || 0))) / liveFlowState.speed;
    liveFlowState.timer = setTimeout(step, delta);
  };
  step();
}


async function streamFlowTrace(traceId) {
  liveFlowState.streamAbort?.abort();
  const controller = new AbortController();
  liveFlowState.streamAbort = controller;
  const session = await getAdminSession();
  if (!session?.access_token) return;
  try {
    const response = await fetch(`${ADMIN_API_BASE_URL}/admin/knowledge/live-flow/stream?trace_id=${encodeURIComponent(traceId)}&after_sequence=${liveFlowState.streamCursor}`, { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`SSE ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n"); buffer = blocks.pop() || "";
      blocks.forEach((block) => {
        const data = block.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
        const type = block.split("\n").find((line) => line.startsWith("event: "))?.slice(7);
        if (!data || type !== "trace") return;
        const event = JSON.parse(data);
        if (!liveFlowState.events.some((item) => item.sequence === event.sequence)) liveFlowState.events.push(event);
        liveFlowState.events.sort((a, b) => a.sequence - b.sequence);
        liveFlowState.streamCursor = Math.max(liveFlowState.streamCursor, Number(event.sequence || 0));
        adminEl("flowScrubber").max = String(Math.max(0, liveFlowState.events.length - 1));
        renderFlowMedia(); selectFlowEvent(liveFlowState.events.length - 1);
      });
    }
  } catch (error) {
    if (error.name !== "AbortError") flowSetStatus(`Live stream interrupted: ${error.message}`, "error");
  }
}


async function selectFlowTrace(traceId) {
  stopFlowPlayback(); liveFlowState.streamAbort?.abort();
  const trace = await adminFetch(`/admin/knowledge/live-flow/traces/${encodeURIComponent(traceId)}`);
  liveFlowState.trace = trace; liveFlowState.events = Array.isArray(trace.events) ? trace.events.sort((a, b) => a.sequence - b.sequence) : [];
  liveFlowState.streamCursor = liveFlowState.events.reduce((max, event) => Math.max(max, Number(event.sequence || 0)), 0);
  adminEl("flowModeBadge").textContent = trace.status === "RUNNING" ? "LIVE" : "REPLAY · $0";
  adminEl("flowScrubber").max = String(Math.max(0, liveFlowState.events.length - 1));
  renderFlowTraces(); renderFlowMedia(); selectFlowEvent(trace.status === "RUNNING" ? liveFlowState.events.length - 1 : 0);
  if (trace.status === "RUNNING") streamFlowTrace(traceId);
}


async function selectAdminSection(section) {
  const knowledge = section === "knowledge";
  const flow = section === "live-flow";
  adminEl("adminUsersSection").hidden = knowledge || flow;
  adminEl("adminKnowledgeSection").hidden = !knowledge;
  adminEl("adminLiveFlowSection").hidden = !flow;
  document.querySelectorAll("[data-admin-section]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminSection === section);
  });
  if (knowledge) await selectInspectorTab(inspectorState.tab);
  else if (flow) { window.history.replaceState(null, "", "#live-flow"); await loadFlowTraces(); }
  else window.history.replaceState(null, "", "#users");
}


document.addEventListener(
  "DOMContentLoaded",
  () => {
    initializeSidebar();

    adminEl("adminSidebarToggle")?.addEventListener("click", () => {
      const shell = document.querySelector(".admin-shell");
      setSidebarCollapsed(!shell?.classList.contains("is-sidebar-collapsed"));
    });

    document.querySelectorAll("[data-admin-section]").forEach((button) => {
      button.addEventListener("click", async () => {
        await selectAdminSection(button.dataset.adminSection);
        setSidebarCollapsed(true);
      });
    });

    document.querySelectorAll("[data-inspector-tab]").forEach((button) => {
      button.addEventListener("click", () => selectInspectorTab(button.dataset.inspectorTab));
    });

    document.querySelectorAll("[data-inspector-load]").forEach((button) => {
      button.addEventListener("click", async () => {
        const tab = button.dataset.inspectorLoad;
        inspectorState.offsets[tab] = 0;
        await loadInspectorTab(tab, true);
      });
    });

    adminEl("inspectorRefreshBtn")?.addEventListener("click", () => loadInspectorTab(inspectorState.tab, true));
    adminEl("flowRefreshBtn")?.addEventListener("click", loadFlowTraces);
    adminEl("flowStatus")?.addEventListener("change", loadFlowTraces);
    adminEl("flowUser")?.addEventListener("change", loadFlowTraces);
    adminEl("flowVehicle")?.addEventListener("change", loadFlowTraces);
    adminEl("flowPlay")?.addEventListener("click", playFlowReplay);
    adminEl("flowPause")?.addEventListener("click", stopFlowPlayback);
    adminEl("flowRestart")?.addEventListener("click", () => { stopFlowPlayback(); selectFlowEvent(0); });
    adminEl("flowSpeed")?.addEventListener("change", (event) => { liveFlowState.speed = Number(event.target.value || 1); });
    adminEl("flowScrubber")?.addEventListener("input", (event) => { stopFlowPlayback(); selectFlowEvent(Number(event.target.value)); });

    document.addEventListener("toggle", (event) => {
      const details = event.target.closest?.("details[data-inspector-kind]");
      if (!details?.open) return;
      if (details.dataset.inspectorKind === "vehicle") loadVehicleSpecs(details);
      if (details.dataset.inspectorKind === "conversation") loadConversationMessages(details);
      if (details.dataset.inspectorKind === "episode") loadEpisodeRuns(details);
    }, true);

    document.addEventListener("click", async (event) => {
      const flowTrace = event.target.closest?.("[data-flow-trace]");
      if (flowTrace) { await selectFlowTrace(flowTrace.dataset.flowTrace); return; }
      const flowEvent = event.target.closest?.("[data-flow-event]");
      if (flowEvent) { stopFlowPlayback(); selectFlowEvent(Number(flowEvent.dataset.flowEvent)); return; }
      const flowNode = event.target.closest?.("[data-flow-node]");
      if (flowNode) {
        const name = flowNode.dataset.flowNode;
        const index = liveFlowState.events.findLastIndex((item) => item.from_node === name || item.to_node === name || item.table_name === name);
        if (index >= 0) selectFlowEvent(index);
        return;
      }
      const adminJump = event.target.closest?.("[data-admin-jump]");
      if (adminJump) {
        await selectAdminSection(adminJump.dataset.adminJump);
        return;
      }

      const dashboardButton = event.target.closest?.("[data-dashboard-tab]");
      if (dashboardButton) {
        const filterId = dashboardButton.dataset.dashboardFilter;
        if (filterId && adminEl(filterId)) adminEl(filterId).value = dashboardButton.dataset.dashboardValue || "";
        const tab = dashboardButton.dataset.dashboardTab;
        await selectInspectorTab(tab);
        if (tab !== "overview") await loadInspectorTab(tab, true);
      }

      const traceButton = event.target.closest?.("[data-load-trace]");
      if (traceButton) await loadProblemTrace(traceButton.dataset.loadTrace);

      const pageButton = event.target.closest?.("[data-inspector-page]");
      if (pageButton && !pageButton.disabled) {
        const kind = pageButton.dataset.inspectorPage;
        inspectorState.offsets[kind] = Math.max(0,
          Number(inspectorState.offsets[kind] || 0) + Number(pageButton.dataset.delta || 0));
        await loadInspectorTab(kind, true);
      }
    });

    adminEl(
      "adminRefreshBtn"
    )?.addEventListener(
      "click",
      loadAdminUsers
    );

    adminEl(
      "adminSearchInput"
    )?.addEventListener(
      "input",
      filterAdminUsers
    );

    adminEl(
      "planModalClose"
    )?.addEventListener(
      "click",
      closePlanModal
    );

    adminEl(
      "planModalCancel"
    )?.addEventListener(
      "click",
      closePlanModal
    );

    adminEl(
      "planModalSave"
    )?.addEventListener(
      "click",
      saveAdminPlan
    );

    adminEl(
      "deleteModalClose"
    )?.addEventListener(
      "click",
      closeDeleteModal
    );

    adminEl(
      "deleteModalCancel"
    )?.addEventListener(
      "click",
      closeDeleteModal
    );

    adminEl(
      "deleteConfirmInput"
    )?.addEventListener(
      "input",
      updateDeleteConfirmation
    );

    adminEl(
      "deleteModalConfirm"
    )?.addEventListener(
      "click",
      permanentlyDeleteAdminUser
    );

    adminEl(
      "planModal"
    )?.addEventListener(
      "click",
      (event) => {
        if (
          event.target.id ===
          "planModal"
        ) {
          closePlanModal();
        }
      }
    );

    adminEl(
      "deleteModal"
    )?.addEventListener(
      "click",
      (event) => {
        if (
          event.target.id ===
          "deleteModal"
        ) {
          closeDeleteModal();
        }
      }
    );

    document.addEventListener(
      "click",
      async (event) => {
        const button =
          event.target.closest(
            "[data-admin-action]"
          );

        if (!button) return;

        await handleAdminAction(
          button
        );
      }
    );

    initializeAdmin();
  }
);
