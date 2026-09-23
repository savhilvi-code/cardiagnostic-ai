const ADMIN_API_BASE_URL = (
  window.PULS_CONFIG?.API_BASE_URL ||
  "https://puls-backend-t3sn.onrender.com"
).replace(/\/$/, "");

let adminUsers = [];
let selectedPlanUser = null;
let selectedDeleteUser = null;
const inspectorState = {
  tab: "library",
  systemView: "overview",
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
const KNOWLEDGE_TYPES = ["MANUAL", "MANUFACTURER_DOCUMENT", "TECHNICAL_BULLETIN", "SPECIFICATION", "PROCEDURE", "DIAGNOSTIC_REFERENCE", "VIDEO", "FORUM", "ARTICLE", "SUCCESSFUL_CASE", "GENERAL", "OTHER"];
const KNOWLEDGE_SOURCE_TYPES = ["MANUFACTURER", "MANUAL", "FORUM", "WEBSITE", "YOUTUBE", "SOCIAL", "DOCUMENT", "PULS", "OTHER"];
const KNOWLEDGE_REVIEW_STATUSES = ["PENDING_REVIEW", "VERIFIED", "NEEDS_CLARIFICATION", "REJECTED"];
const knowledgeLibraryState = {
  scope: "vehicles", make: "", model: "", category: "overview", offset: 0,
  limit: 25, counts: {}, catalogLetter: "", items: new Map(), reviewOffset: 0,
  configurationId: "", configurations: [], configurationInspector: null,
  sections: [], sectionRelations: [], selectedSectionId: "",
  reviewCandidates: new Map(),
};
let knowledgeReviewWorkspace = null;
let adminHardDeleteState = null;
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
    ...(options.body && !(options.body instanceof FormData)
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
      const [, requestedTab, requestedSystemView] = hash.split("/");
      if (["library", "general", "successful", "review", "system"].includes(requestedTab)) inspectorState.tab = requestedTab;
      else if (requestedTab && inspectorLoaders[requestedTab]) { inspectorState.tab = "system"; inspectorState.systemView = requestedTab; }
      if (requestedTab === "system" && requestedSystemView && inspectorLoaders[requestedSystemView]) inspectorState.systemView = requestedSystemView;
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


function inspectorRow({ id, kind, primary, secondary, meta = [], fields = [], body = "", actions = "" }) {
  return `
    <details class="inspector-row" data-inspector-kind="${escapeAdminHtml(kind)}" data-inspector-id="${escapeAdminHtml(id)}">
      <summary>
        <div class="inspector-primary"><strong>${escapeAdminHtml(primary || "Untitled")}</strong><span>${escapeAdminHtml(secondary || `#${id}`)}</span></div>
        ${meta.slice(0, 3).map((item) => inspectorMeta(item.label, item.value)).join("")}
      </summary>
      <div class="inspector-detail">
        ${fields.length ? `<div class="inspector-detail-grid">${fields.map((item) => inspectorField(item.label, item.value)).join("")}</div>` : ""}
        ${body}
        ${actions ? `<div class="admin-dialog-actions">${actions}</div>` : ""}
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
    body: `<div class="inspector-specs" data-vehicle-specs="${escapeAdminHtml(row.id)}"><div class="admin-empty">Expand to load ${escapeAdminHtml(row.spec_count ?? "—")} specification rows.</div></div>`,
    actions: `<button class="admin-button admin-button-danger" type="button" data-hard-delete-type="vehicle" data-hard-delete-id="${escapeAdminHtml(row.id)}">Delete Vehicle</button>`
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
  const conversationCard = (row) => inspectorRow({
    id: row.id, kind: "conversation", primary: inspectorConversationTitle(row),
    secondary: inspectorVehicle(row),
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
  });
  if (!items.length) renderInspectorEmpty("conversationList");
  else {
    const byUser = new Map();
    items.forEach((row) => {
      const key = String(row.user_id || "unassigned");
      if (!byUser.has(key)) byUser.set(key, { label: inspectorUser(row), rows: [] });
      byUser.get(key).rows.push(row);
    });
    adminEl("conversationList").innerHTML = [...byUser.values()].map((group) => {
      const byDay = new Map();
      group.rows.forEach((row) => {
        const timestamp = row.last_message_at || row.started_at || row.created_at;
        const day = timestamp ? new Date(timestamp).toLocaleDateString() : "Date not recorded";
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(row);
      });
      return `<details class="inspector-tree-group" open><summary><strong>${escapeAdminHtml(group.label)}</strong><span>${group.rows.length} conversation(s)</span></summary><div>${[...byDay.entries()].map(([day, rows]) => `<details class="inspector-tree-session"><summary><strong>${escapeAdminHtml(day)}</strong><span>${rows.reduce((sum, row) => sum + Number(row.message_count || 0), 0)} messages</span></summary>${rows.map(conversationCard).join("")}</details>`).join("")}</div></details>`;
    }).join("");
  }
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
      const attachmentState = row.metadata?.had_attachments ? (row.metadata?.attachments_deleted ? " · attachment deleted" : " · attachment") : "";
      return `<article class="inspector-message is-${escapeAdminHtml(role)}"><header>${escapeAdminHtml(role)} · ${escapeAdminHtml(formatAdminDate(row.created_at))}${escapeAdminHtml(attachmentState)}</header><div>${escapeAdminHtml(row.content || row.message_text || "")}</div></article>`;
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
  const episodeCard = (row) => inspectorRow({
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
    body: `<div class="inspector-runs" data-episode-runs="${escapeAdminHtml(row.id)}"><div class="admin-empty">Expand to load Runs → Sources → Research Evidence → Evidence Response.</div></div>`
  });
  if (!items.length) renderInspectorEmpty("episodeList");
  else {
    const contexts = new Map();
    items.forEach((row) => {
      const vehicle = inspectorVehicle(row);
      const context = vehicle && vehicle !== "Vehicle unavailable" ? vehicle : "Standalone context";
      if (!contexts.has(context)) contexts.set(context, new Map());
      const problem = row.problem?.title || row.problem_id || "No linked Problem";
      if (!contexts.get(context).has(problem)) contexts.get(context).set(problem, []);
      contexts.get(context).get(problem).push(row);
    });
    adminEl("episodeList").innerHTML = [...contexts.entries()].map(([context, problems]) => `<details class="inspector-tree-group" open><summary><strong>${escapeAdminHtml(context)}</strong><span>${[...problems.values()].reduce((sum, rows) => sum + rows.length, 0)} episode(s)</span></summary><div>${[...problems.entries()].map(([problem, rows]) => `<details class="inspector-tree-session" open><summary><strong>${escapeAdminHtml(problem)}</strong><span>${rows.length} episode(s)</span></summary>${rows.map(episodeCard).join("")}</details>`).join("")}</div></details>`).join("");
  }
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
    target.innerHTML = items.length ? items.map((run) => {
      const result = run.result_data && typeof run.result_data === "object" ? run.result_data : {};
      const sources = result.sources || result.links || [];
      const evidence = result.research_evidence || result.evidence_units || [];
      const response = result.evidence_response || result.final_response || run.result_summary;
      return `
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
        <details><summary>Sources (${sources.length})</summary>${sources.length ? sources.map((source) => `<div class="search-memory-row"><strong>${escapeAdminHtml(source.title || source.url || "Source")}</strong><span>${escapeAdminHtml(source.url || source.source_id || "")}</span></div>`).join("") : '<div class="admin-status">No source list stored in this Run result.</div>'}</details>
        <details><summary>Research Evidence (${evidence.length})</summary>${evidence.length ? evidence.map((unit) => `<div class="search-memory-row"><strong>${escapeAdminHtml(unit.claim || unit.evidence_text || unit.title || "Evidence")}</strong><span>${escapeAdminHtml(unit.source_url || unit.source_id || "")}</span></div>`).join("") : '<div class="admin-status">No evidence units stored in this Run result.</div>'}</details>
        <details><summary>Evidence Response</summary><div class="search-memory-response">${escapeAdminHtml(compactInspectorValue(response || "No response stored"))}</div></details>
        <details><summary>Technical details · debug</summary><pre class="inspector-json">${escapeAdminHtml(inspectorJson(run.result_data))}</pre></details>
      </article>`;
    }).join("") : `<div class="admin-empty">No search runs were persisted for this episode.</div>`;
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


function knowledgeOptions(values, emptyLabel = "") {
  return `${emptyLabel ? `<option value="">${escapeAdminHtml(emptyLabel)}</option>` : ""}${values.map((value) => `<option value="${escapeAdminHtml(value)}">${escapeAdminHtml(value.replaceAll("_", " "))}</option>`).join("")}`;
}


function initializeKnowledgeLibraryControls() {
  if (adminEl("materialType")?.options.length) return;
  adminEl("materialType").innerHTML = knowledgeOptions(KNOWLEDGE_TYPES);
  adminEl("materialSourceType").innerHTML = knowledgeOptions(KNOWLEDGE_SOURCE_TYPES, "Select source type");
  adminEl("materialStatus").innerHTML = knowledgeOptions(KNOWLEDGE_REVIEW_STATUSES);
  adminEl("libraryKnowledgeType").innerHTML = knowledgeOptions(KNOWLEDGE_TYPES, "All knowledge types");
  adminEl("librarySourceType").innerHTML = knowledgeOptions(KNOWLEDGE_SOURCE_TYPES, "All source types");
  adminEl("libraryReviewStatus").innerHTML = knowledgeOptions(KNOWLEDGE_REVIEW_STATUSES, "All review states");
  renderKnowledgeAlphabet();
}


function renderKnowledgeAlphabet() {
  const node = adminEl("knowledgeAlphabet");
  if (!node) return;
  node.innerHTML = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ#"].map((letter) => `<button type="button" class="${knowledgeLibraryState.catalogLetter === letter ? "is-active" : ""}" data-knowledge-letter="${letter}">${letter}</button>`).join("");
  node.hidden = knowledgeLibraryState.scope !== "vehicles";
}


function knowledgeApplicabilityText(value) {
  if (!value) return "General Knowledge";
  const year = value.year_from || value.year_to ? `${value.year_from || "…"}–${value.year_to || "…"}` : "All years";
  return [value.make, value.model, value.generation, year, value.body_type, value.engine_code || "All engines", value.transmission, value.drivetrain, value.market].filter(Boolean).join(" / ");
}


function knowledgeCategoryCount(key) {
  const counts = knowledgeLibraryState.counts || {};
  const groups = {
    manuals: ["MANUAL", "MANUFACTURER_DOCUMENT", "TECHNICAL_BULLETIN"], specifications: ["SPECIFICATION"],
    procedures: ["PROCEDURE", "DIAGNOSTIC_REFERENCE"], videos: ["VIDEO"], forums: ["FORUM"],
    "successful-cases": ["SUCCESSFUL_CASE"], all: ["ALL"], overview: ["ALL"],
  };
  return (groups[key] || []).reduce((total, type) => total + Number(counts[type] || 0), 0);
}


function renderKnowledgeCategories() {
  const categories = knowledgeLibraryState.scope === "vehicles" ? [
    ["overview", "Overview"], ["configuration", "Configuration"], ["technical-data", "Technical Data"],
    ["manuals", "Manuals"], ["specifications", "Specifications"], ["procedures", "Procedures"],
    ["videos", "Videos"], ["problems", "Problems"], ["research-evidence", "Research"],
    ["sources", "Sources"], ["successful-cases", "Successful Cases"],
    ["schema-gaps", "Schema Gaps"],
  ] : [["overview", "Folders & Sections"], ["all", "All Materials"]];
  adminEl("knowledgeCategories").innerHTML = categories.map(([key, label]) => `<button type="button" class="knowledge-category ${knowledgeLibraryState.category === key ? "is-active" : ""}" data-knowledge-category="${key}">${escapeAdminHtml(label)}${key === "problems" ? "" : ` <span>${knowledgeCategoryCount(key)}</span>`}</button>`).join("");
}


function renderKnowledgeCatalog(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  adminEl("knowledgeCatalog").innerHTML = items.length ? items.map((make) => `
    <section class="knowledge-make-group"><h3>${escapeAdminHtml(make.make)}</h3>
      <div>${(make.models || []).map((model) => `<button type="button" class="knowledge-model-button ${knowledgeLibraryState.make === make.make && knowledgeLibraryState.model === model ? "is-active" : ""}" data-knowledge-make="${escapeAdminHtml(make.make)}" data-knowledge-model="${escapeAdminHtml(model)}">${escapeAdminHtml(model)}</button>`).join("")}</div>
    </section>`).join("") : '<div class="admin-empty">No makes or models found in the current catalog.</div>';
}


function configurationLabel(item) {
  const years = item.year_from || item.year_to ? `${item.year_from || "…"}–${item.year_to || "…"}` : "Unknown year";
  return [item.generation, item.body_type || item.chassis_code, years, item.engine || item.engine_code, item.fuel_type, item.transmission, item.drivetrain, item.market].filter(Boolean).join(" · ") || "Incomplete configuration";
}


function configurationDimension(item, key) {
  if (key === "year") return item.year_from || item.year_to ? `${item.year_from || "…"}–${item.year_to || "…"}` : "Year not recorded";
  const aliases = { body: item.body_type || item.chassis_code, engine: item.engine || item.engine_code };
  return aliases[key] || item[key] || `${key.replaceAll("_", " ")} not recorded`;
}


function configurationMatchesFilters(item) {
  const filters = {
    year: adminEl("libraryYear")?.value, generation: adminEl("libraryGeneration")?.value,
    body: adminEl("libraryBody")?.value, engine: adminEl("libraryEngine")?.value,
    fuel_type: adminEl("libraryFuel")?.value, transmission: adminEl("libraryTransmission")?.value,
    drivetrain: adminEl("libraryDrivetrain")?.value,
  };
  return Object.entries(filters).every(([key, raw]) => {
    const wanted = String(raw || "").trim().toLowerCase();
    return !wanted || String(configurationDimension(item, key)).toLowerCase().includes(wanted);
  });
}


function renderConfigurationBranch(items, dimensions, depth = 0) {
  if (!dimensions.length) return items.map((item) => `<button class="knowledge-configuration-option ${String(item.id) === String(knowledgeLibraryState.configurationId) ? "is-active" : ""}" type="button" data-configuration-id="${escapeAdminHtml(item.id)}"><strong>${escapeAdminHtml([configurationDimension(item, "fuel_type"), item.market].filter(Boolean).join(" · ") || "Open configuration")}</strong><small>${escapeAdminHtml(configurationLabel(item))}</small></button>`).join("");
  const hasKnownValue = (item, key) => {
    if (key === "year") return Boolean(item.year_from || item.year_to);
    if (key === "body") return Boolean(item.body_type || item.chassis_code);
    if (key === "engine") return Boolean(item.engine || item.engine_code);
    return Boolean(item[key]);
  };
  if (!dimensions.some((dimension) => items.some((item) => hasKnownValue(item, dimension)))) {
    return items.map((item) => `<button class="knowledge-configuration-option ${String(item.id) === String(knowledgeLibraryState.configurationId) ? "is-active" : ""}" type="button" data-configuration-id="${escapeAdminHtml(item.id)}"><strong>Open configuration</strong><small>${escapeAdminHtml(configurationLabel(item))}</small></button>`).join("");
  }
  const [dimension, ...rest] = dimensions;
  if (!items.some((item) => hasKnownValue(item, dimension))) return renderConfigurationBranch(items, rest, depth);
  const groups = new Map();
  items.forEach((item) => {
    const label = configurationDimension(item, dimension);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  });
  return [...groups.entries()].map(([label, rows]) => `<details class="configuration-tree-level depth-${depth}" ${depth < 2 ? "open" : ""}><summary><span>${escapeAdminHtml(dimension.replaceAll("_", " "))}</span><strong>${escapeAdminHtml(label)}</strong><small>${rows.length}</small></summary><div>${renderConfigurationBranch(rows, rest, depth + 1)}</div></details>`).join("");
}


function renderConfigurationPicker() {
  const node = adminEl("knowledgeConfigurationPicker");
  const items = (knowledgeLibraryState.configurations || []).filter(configurationMatchesFilters);
  node.hidden = knowledgeLibraryState.scope !== "vehicles" || !knowledgeLibraryState.make;
  node.innerHTML = items.length ? renderConfigurationBranch(items, ["generation", "body", "year", "engine", "transmission", "drivetrain"]) : '<div class="admin-empty">No configurations match this model and the current filters.</div>';
  renderKnowledgeAlphabet();
}


async function loadVehicleConfigurations() {
  const params = new URLSearchParams({ make: knowledgeLibraryState.make, model: knowledgeLibraryState.model, limit: "100" });
  const payload = await adminFetch(`/admin/knowledge/library/configurations?${params}`);
  knowledgeLibraryState.configurations = Array.isArray(payload?.items) ? payload.items : [];
  if (!knowledgeLibraryState.configurations.some((item) => String(item.id) === String(knowledgeLibraryState.configurationId))) {
    knowledgeLibraryState.configurationId = String(knowledgeLibraryState.configurations[0]?.id || "");
  }
  renderConfigurationPicker();
}


function sectionOptions(selected = "") {
  return ['<option value="">Unfiled</option>', ...(knowledgeLibraryState.sections || []).map((section) => `<option value="${escapeAdminHtml(section.id)}" ${String(section.id) === String(selected) ? "selected" : ""}>${escapeAdminHtml(`${section.lifecycle_status === "ARCHIVED" ? "[Archived] " : ""}${section.name}`)}</option>`)].join("");
}


function renderKnowledgeSectionTree() {
  const sections = knowledgeLibraryState.sections || [];
  const byParent = new Map();
  sections.forEach((section) => {
    const parent = String(section.parent_id || "");
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(section);
  });
  const branch = (parent = "", depth = 0, seen = new Set()) => (byParent.get(parent) || []).map((section) => {
    if (seen.has(String(section.id))) return "";
    const nextSeen = new Set(seen); nextSeen.add(String(section.id));
    const counts = section.counts || {};
    return `<div class="knowledge-section-node ${section.lifecycle_status === "ARCHIVED" ? "is-archived" : ""}" style="--section-depth:${depth}">
      <button type="button" data-section-select="${escapeAdminHtml(section.id)}"><strong>${escapeAdminHtml(section.name)}</strong><small>${counts.children || 0} folder(s) · ${counts.materials || 0} material(s) · ${counts.sources || 0} source(s)</small></button>
      <span><button class="admin-button" type="button" data-section-edit="${escapeAdminHtml(section.id)}">Edit</button><button class="admin-button" type="button" data-section-state="${section.lifecycle_status === "ARCHIVED" ? "restore" : "archive"}" data-section-id="${escapeAdminHtml(section.id)}">${section.lifecycle_status === "ARCHIVED" ? "Restore" : "Archive"}</button></span>
    </div>${branch(String(section.id), depth + 1, nextSeen)}`;
  }).join("");
  adminEl("knowledgeCatalog").innerHTML = branch() || '<div class="admin-empty">No General Knowledge sections yet.</div>';
  adminEl("generalSectionParent").innerHTML = '<option value="">Root level</option>' + sections.map((section) => `<option value="${escapeAdminHtml(section.id)}">${escapeAdminHtml(section.name)}</option>`).join("");
}


async function loadKnowledgeSections() {
  const payload = await adminFetch("/admin/knowledge/library/sections?include_archived=true");
  knowledgeLibraryState.sections = Array.isArray(payload?.items) ? payload.items : [];
  knowledgeLibraryState.sectionRelations = Array.isArray(payload?.relations) ? payload.relations : [];
  renderKnowledgeSectionTree();
}


async function loadKnowledgeCatalog() {
  const params = new URLSearchParams();
  const query = adminEl("libraryCatalogSearch")?.value.trim();
  if (query) params.set("q", query);
  else if (knowledgeLibraryState.catalogLetter) params.set("letter", knowledgeLibraryState.catalogLetter);
  adminEl("knowledgeCatalog").innerHTML = '<div class="admin-empty">Loading vehicle catalog…</div>';
  renderKnowledgeCatalog(await adminFetch(`/admin/knowledge/library/catalog?${params}`));
  renderKnowledgeAlphabet();
}


function knowledgeSourceLinks(item) {
  return (item.knowledge_sources || []).map((link) => link.source).filter(Boolean).map((source) => {
    const url = safeInspectorUrl(source.url || source.canonical_url);
    return url ? `<a href="${escapeAdminHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeAdminHtml(source.title || source.domain || url)} ↗</a>` : `<span>${escapeAdminHtml(source.title || "Source")}</span>`;
  }).join("");
}


function vehicleInspectorSource(source) {
  if (!source) return "—";
  const url = safeInspectorUrl(source.url || source.canonical_url);
  return url ? `<a class="inspector-link" href="${escapeAdminHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeAdminHtml(source.title || source.domain || url)} ↗</a>` : escapeAdminHtml(source.title || source.id || "Source");
}


function renderVehicleConfigurationInspector(payload) {
  knowledgeLibraryState.configurationInspector = payload;
  knowledgeLibraryState.counts = { ALL: payload?.counts?.materials || 0 };
  renderKnowledgeCategories();
  const category = knowledgeLibraryState.category;
  const list = adminEl("knowledgeLibraryList");
  if (!payload?.configuration) { list.innerHTML = '<div class="admin-empty">Select a concrete vehicle configuration.</div>'; return; }
  if (category === "overview") {
    const labels = { known_fields: "Known fields", missing_fields: "Missing fields", unmapped: "Unmapped", sources: "Sources", research_evidence: "Research Evidence", problems: "Problems / Symptoms", successful_cases: "Successful Cases", materials: "Materials" };
    list.innerHTML = `<div class="vehicle-coverage-grid">${Object.entries(labels).map(([key, label]) => `<article><span>${escapeAdminHtml(label)}</span><strong>${Number(payload.counts?.[key] || 0)}</strong></article>`).join("")}</div>`;
    return;
  }
  if (category === "configuration") {
    list.innerHTML = `<div class="vehicle-identity-grid">${(payload.identity || []).map((field) => `<article class="is-${field.status.toLowerCase()}"><span>${escapeAdminHtml(field.field_key.replaceAll("_", " "))}</span><strong>${escapeAdminHtml(field.status === "KNOWN" ? compactInspectorValue(field.value) : "Missing")}</strong></article>`).join("")}</div><details class="configuration-technical-details"><summary>Technical details</summary><pre class="inspector-json">${escapeAdminHtml(inspectorJson({ configuration_id: payload.configuration.id, metadata: payload.configuration.metadata || {} }))}</pre></details>`;
    return;
  }
  if (category === "technical-data") {
    const groups = new Map();
    (payload.technical_schema || []).forEach((field) => { if (!groups.has(field.category)) groups.set(field.category, []); groups.get(field.category).push(field); });
    list.innerHTML = [...groups.entries()].map(([name, fields]) => `<section class="technical-schema-group"><h3>${escapeAdminHtml(name)}</h3><div>${fields.map((field) => `<article class="technical-schema-row is-${field.status.toLowerCase()}"><div><strong>${escapeAdminHtml(field.field_key)}</strong><small>${escapeAdminHtml(field.provenance_type || field.status)}</small></div><span>${field.status === "KNOWN" ? `${escapeAdminHtml(compactInspectorValue(field.value))}${field.unit ? ` ${escapeAdminHtml(field.unit)}` : ""}` : "Missing"}</span><span>${vehicleInspectorSource(field.source)}</span></article>`).join("")}</div></section>`).join("");
    return;
  }
  if (["manuals", "specifications", "procedures", "videos"].includes(category)) {
    renderKnowledgeMaterials({ items: payload.materials?.[category] || [], total: (payload.materials?.[category] || []).length, limit: 100, offset: 0, counts: {} });
    return;
  }
  if (category === "sources") {
    list.innerHTML = (payload.sources || []).map((source) => `<article class="knowledge-material-card"><header><h3>${vehicleInspectorSource(source)}</h3><span class="knowledge-review-status">${escapeAdminHtml(source.source_type || "SOURCE")}</span></header><p>${escapeAdminHtml(source.description || source.domain || "No description")}</p><pre class="inspector-json">${escapeAdminHtml(inspectorJson(source.metadata || {}))}</pre></article>`).join("") || '<div class="admin-empty">No source provenance for this configuration.</div>';
    return;
  }
  if (category === "research-evidence") {
    list.innerHTML = (payload.research_evidence || []).map((item) => `<article class="knowledge-material-card"><header><h3>Evidence ${escapeAdminHtml(item.id)}</h3><span class="knowledge-review-status">${escapeAdminHtml(item.status || "RAW")}</span></header><p>${escapeAdminHtml(item.evidence_text)}</p><div class="knowledge-card-meta"><span>Run ${escapeAdminHtml(item.origin_search_run_id)}</span><span>${escapeAdminHtml(item.structured_data?.applicability || item.structured_data?.vehicle_applicability || "Applicability not recorded")}</span></div>${vehicleInspectorSource(item.source)}</article>`).join("") || '<div class="admin-empty">No compatible Research Evidence.</div>';
    return;
  }
  if (category === "schema-gaps") {
    list.innerHTML = (payload.schema_gaps || []).map((gap) => `<article class="knowledge-material-card"><header><div><span class="knowledge-origin">Unmapped</span><h3>${escapeAdminHtml(gap.normalized_parameter || gap.raw_parameter)}</h3></div><span class="knowledge-review-status">${escapeAdminHtml(gap.mapping_status)}</span></header><p>${escapeAdminHtml(compactInspectorValue(gap.normalized_value ?? gap.raw_value))}${gap.unit ? ` ${escapeAdminHtml(gap.unit)}` : ""}</p><div class="knowledge-card-meta"><span>Run ${escapeAdminHtml(gap.origin_search_run_id || "—")}</span><span>${vehicleInspectorSource(gap.source)}</span></div><footer><button class="admin-button" type="button" data-gap-review="${escapeAdminHtml(gap.id)}" data-gap-status="REJECTED">Reject</button></footer></article>`).join("") || '<div class="admin-empty">No Schema Gaps for this configuration.</div>';
    return;
  }
  if (category === "problems") {
    list.innerHTML = (payload.problems || []).map((item) => `<article class="knowledge-material-card knowledge-problem-card"><header><h3>${escapeAdminHtml(item.title || `Problem ${item.id}`)}</h3><span class="knowledge-review-status">${escapeAdminHtml(item.status || "—")}</span></header><dl><dt>Class</dt><dd>${escapeAdminHtml(item.problem_class || "—")}</dd><dt>Symptoms</dt><dd>${escapeAdminHtml(compactInspectorValue(item.symptoms))}</dd><dt>Conclusion</dt><dd>${escapeAdminHtml(item.current_conclusion || "Not confirmed")}</dd></dl></article>`).join("") || '<div class="admin-empty">No Problems for this configuration.</div>';
    return;
  }
  if (category === "successful-cases") {
    renderKnowledgeMaterials({ items: payload.successful_cases || [], total: (payload.successful_cases || []).length, limit: 100, offset: 0, counts: {} });
  }
}


async function loadVehicleConfigurationInspector() {
  if (!knowledgeLibraryState.configurationId) { knowledgeLibraryState.configurationInspector = null; renderVehicleConfigurationInspector(null); return; }
  const payload = await adminFetch(`/admin/knowledge/library/configurations/${encodeURIComponent(knowledgeLibraryState.configurationId)}`);
  renderVehicleConfigurationInspector(payload);
}


function renderKnowledgeMaterials(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  knowledgeLibraryState.items = new Map(items.map((item) => [String(item.id), item]));
  knowledgeLibraryState.counts = payload?.counts || {};
  renderKnowledgeCategories();
  adminEl("knowledgeLibraryList").innerHTML = items.length ? items.map((item) => {
    const sourceLinks = knowledgeSourceLinks(item);
    const sectionRelation = (knowledgeLibraryState.sectionRelations || []).find((relation) => String(relation.knowledge_item_id) === String(item.id));
    const folderControl = knowledgeLibraryState.scope === "general" ? `<label class="knowledge-folder-control">Folder <select class="admin-select" data-material-section="${escapeAdminHtml(item.id)}">${sectionOptions(sectionRelation?.section_id || "")}</select><button class="admin-button" type="button" data-move-material="${escapeAdminHtml(item.id)}">Move</button></label>` : "";
    return `<article class="knowledge-material-card" data-knowledge-item="${escapeAdminHtml(item.id)}">
      <header><div><span class="knowledge-origin is-${escapeAdminHtml(String(item.provenance_type || "external").toLowerCase().replaceAll("_", "-"))}">${escapeAdminHtml(String(item.provenance_type || "External Web").replaceAll("_", " "))}</span><h3>${escapeAdminHtml(item.title || `Knowledge #${item.id}`)}</h3></div><span class="knowledge-review-status">${escapeAdminHtml(String(item.validation_status || "—").replaceAll("_", " "))}</span></header>
      <p>${escapeAdminHtml(item.summary || item.metadata?.description || "No summary")}</p>
      <div class="knowledge-applicability-line">${escapeAdminHtml(knowledgeApplicabilityText(item.applicability))}</div>
      <div class="knowledge-card-meta"><span>${escapeAdminHtml(item.knowledge_type || "OTHER")}</span><span>${escapeAdminHtml(item.component || "All components")}</span><span>${item.knowledge_sources?.length || 0} source(s)</span></div>
      ${sourceLinks ? `<div class="knowledge-source-links">${sourceLinks}</div>` : ""}
      <details><summary>View structured knowledge</summary><pre class="inspector-json">${escapeAdminHtml(inspectorJson({ symptoms: item.symptoms, conditions: item.conditions, causes: item.causes, checks: item.checks, solutions: item.solutions, notes: item.metadata?.notes, mechanic_review: item.metadata?.mechanic_review }))}</pre></details>
      <footer>${folderControl}<button class="admin-button" type="button" data-edit-knowledge="${escapeAdminHtml(item.id)}">Edit</button><button class="admin-button admin-danger-button" type="button" data-archive-knowledge="${escapeAdminHtml(item.id)}">Archive</button><button class="admin-button admin-button-danger" type="button" data-hard-delete-type="knowledge" data-hard-delete-id="${escapeAdminHtml(item.id)}">Delete Material</button>${item.metadata?.origin_fleet_event_id ? `<button class="admin-button admin-button-danger" type="button" data-hard-delete-type="case" data-hard-delete-id="${escapeAdminHtml(item.metadata.origin_fleet_event_id)}">Delete Case</button>` : ""}</footer>
    </article>`;
  }).join("") : '<div class="admin-empty">No knowledge materials match these filters.</div>';
  renderKnowledgeLibraryPager(payload);
}


function renderKnowledgeLibraryPager(payload) {
  const total = Number(payload?.total || 0), limit = Number(payload?.limit || knowledgeLibraryState.limit), offset = Number(payload?.offset || 0);
  adminEl("knowledgeLibraryPager").innerHTML = total > limit ? `<button class="admin-button" type="button" data-library-page="${Math.max(0, offset - limit)}" ${offset <= 0 ? "disabled" : ""}>Previous</button><span>${offset + 1}–${Math.min(total, offset + limit)} of ${total}</span><button class="admin-button" type="button" data-library-page="${offset + limit}" ${offset + limit >= total ? "disabled" : ""}>Next</button>` : (total ? `<span>${total} material(s)</span>` : "");
}


async function loadKnowledgeProblems() {
  const params = new URLSearchParams({ limit: String(knowledgeLibraryState.limit), offset: String(knowledgeLibraryState.offset), make: knowledgeLibraryState.make, model: knowledgeLibraryState.model });
  [["year", "libraryYear"], ["generation", "libraryGeneration"], ["body", "libraryBody"], ["engine", "libraryEngine"], ["transmission", "libraryTransmission"]].forEach(([name, id]) => { const value = adminEl(id)?.value.trim(); if (value) params.set(name, value); });
  const payload = await adminFetch(`/admin/knowledge/library/problems?${params}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  adminEl("knowledgeLibraryList").innerHTML = items.length ? items.map((item) => `<article class="knowledge-material-card knowledge-problem-card"><header><div><span class="knowledge-origin is-user-case">Original structured Problem</span><h3>${escapeAdminHtml(item.title || `Problem #${item.id}`)}</h3></div><span class="knowledge-review-status">${escapeAdminHtml(item.status || "—")}</span></header><div class="knowledge-applicability-line">${escapeAdminHtml([item.vehicle?.make, item.vehicle?.model, item.vehicle?.year, item.vehicle?.engine_code, item.vehicle?.transmission].filter(Boolean).join(" / "))}</div><dl><dt>Symptoms</dt><dd>${escapeAdminHtml(compactInspectorValue(item.symptoms))}</dd><dt>Confirmed facts</dt><dd>${escapeAdminHtml(compactInspectorValue(item.confirmed_facts))}</dd><dt>Conclusion</dt><dd>${escapeAdminHtml(item.current_conclusion || "Not confirmed")}</dd><dt>Checks</dt><dd>${escapeAdminHtml(item.checks_summary || "—")}</dd><dt>Actions / result</dt><dd>${escapeAdminHtml(item.actions_summary || "—")}</dd></dl></article>`).join("") : '<div class="admin-empty">No structured Problems found for this model and filters.</div>';
  renderKnowledgeLibraryPager(payload);
}


async function loadKnowledgeMaterials() {
  if (knowledgeLibraryState.scope === "vehicles" && (!knowledgeLibraryState.make || !knowledgeLibraryState.model)) return;
  renderKnowledgeCategories();
  adminEl("knowledgeLibraryList").innerHTML = '<div class="admin-empty">Loading knowledge materials…</div>';
  if (knowledgeLibraryState.scope === "vehicles") { await loadVehicleConfigurationInspector(); return; }
  if (knowledgeLibraryState.category === "problems") { await loadKnowledgeProblems(); return; }
  const params = new URLSearchParams({ limit: String(knowledgeLibraryState.limit), offset: String(knowledgeLibraryState.offset) });
  if (knowledgeLibraryState.scope === "general") params.set("scope", "general");
  else { params.set("make", knowledgeLibraryState.make); params.set("model", knowledgeLibraryState.model); }
  if (!["overview", "all"].includes(knowledgeLibraryState.category)) params.set("category", knowledgeLibraryState.category);
  const values = {
    knowledge_type: adminEl("libraryKnowledgeType")?.value, source_type: adminEl("librarySourceType")?.value,
    review_status: adminEl("libraryReviewStatus")?.value, year: adminEl("libraryYear")?.value,
    generation: adminEl("libraryGeneration")?.value, body: adminEl("libraryBody")?.value,
    engine: adminEl("libraryEngine")?.value, fuel: adminEl("libraryFuel")?.value,
    transmission: adminEl("libraryTransmission")?.value, drivetrain: adminEl("libraryDrivetrain")?.value,
    q: adminEl("libraryItemSearch")?.value,
  };
  Object.entries(values).forEach(([key, value]) => { if (String(value || "").trim()) params.set(key, String(value).trim()); });
  renderKnowledgeMaterials(await adminFetch(`/admin/knowledge/library/items?${params}`));
}


async function applyKnowledgeFilters() {
  knowledgeLibraryState.offset = 0;
  if (knowledgeLibraryState.scope === "vehicles") {
    const visible = (knowledgeLibraryState.configurations || []).filter(configurationMatchesFilters);
    if (!visible.some((item) => String(item.id) === String(knowledgeLibraryState.configurationId))) {
      knowledgeLibraryState.configurationId = String(visible[0]?.id || "");
    }
    renderConfigurationPicker();
  }
  await loadKnowledgeMaterials();
}


async function selectKnowledgeScope(scope) {
  knowledgeLibraryState.scope = scope === "general" ? "general" : "vehicles";
  knowledgeLibraryState.offset = 0; knowledgeLibraryState.category = "overview";
  document.querySelectorAll("[data-knowledge-scope]").forEach((button) => button.classList.toggle("is-active", button.dataset.knowledgeScope === knowledgeLibraryState.scope));
  const vehicleScope = knowledgeLibraryState.scope === "vehicles";
  renderKnowledgeAlphabet();
  adminEl("libraryCatalogSearch").hidden = !vehicleScope; adminEl("librarySearchButton").hidden = !vehicleScope;
  adminEl("generalSectionForm").hidden = true;
  document.querySelectorAll(".general-only-action").forEach((button) => { button.hidden = vehicleScope; });
  adminEl("knowledgeConfigurationPicker").hidden = !vehicleScope || !knowledgeLibraryState.make;
  adminEl("knowledgeModelEyebrow").textContent = vehicleScope ? "Vehicle knowledge" : "General Knowledge";
  adminEl("knowledgeModelTitle").textContent = vehicleScope ? (knowledgeLibraryState.make ? `${knowledgeLibraryState.make} ${knowledgeLibraryState.model}` : "Select a make and model") : "General Knowledge";
  adminEl("knowledgeModelSubtitle").textContent = vehicleScope ? "Applicability is evaluated per vehicle configuration." : "Reusable knowledge without a vehicle binding.";
  if (vehicleScope) await loadKnowledgeCatalog();
  else { await loadKnowledgeSections(); await loadKnowledgeMaterials(); }
}


async function selectKnowledgeModel(make, model) {
  knowledgeLibraryState.make = make; knowledgeLibraryState.model = model; knowledgeLibraryState.offset = 0; knowledgeLibraryState.category = "overview"; knowledgeLibraryState.configurationId = "";
  adminEl("knowledgeModelTitle").textContent = `${make} ${model}`;
  adminEl("knowledgeModelSubtitle").textContent = "General and configuration-specific materials remain visibly distinct.";
  await loadKnowledgeCatalog(); await loadVehicleConfigurations(); await loadKnowledgeMaterials();
}


function resetKnowledgeSectionForm() {
  adminEl("generalSectionForm")?.reset();
  setKnowledgeField("generalSectionId", "");
  setKnowledgeField("generalSectionOrder", "0");
  adminEl("generalSectionCancel").hidden = true;
  adminEl("generalSectionForm").hidden = true;
}


function openKnowledgeSectionForm(sectionType) {
  resetKnowledgeSectionForm();
  setKnowledgeField("generalSectionType", sectionType);
  adminEl("generalSectionForm").hidden = false;
  adminEl("generalSectionName")?.focus();
}


async function saveKnowledgeSection(event) {
  event.preventDefault();
  const id = adminEl("generalSectionId").value;
  const payload = {
    name: adminEl("generalSectionName").value.trim(),
    description: adminEl("generalSectionDescription").value.trim() || null,
    parent_id: adminEl("generalSectionParent").value || null,
    section_type: adminEl("generalSectionType").value,
    sort_order: Number(adminEl("generalSectionOrder").value || 0),
  };
  await adminFetch(id ? `/admin/knowledge/library/sections/${encodeURIComponent(id)}` : "/admin/knowledge/library/sections", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
  resetKnowledgeSectionForm(); await loadKnowledgeSections();
}


function editKnowledgeSection(id) {
  const section = (knowledgeLibraryState.sections || []).find((item) => String(item.id) === String(id));
  if (!section) return;
  setKnowledgeField("generalSectionId", section.id); setKnowledgeField("generalSectionName", section.name);
  setKnowledgeField("generalSectionDescription", section.description); setKnowledgeField("generalSectionParent", section.parent_id);
  setKnowledgeField("generalSectionType", section.section_type); setKnowledgeField("generalSectionOrder", section.sort_order);
  adminEl("generalSectionCancel").hidden = false;
  adminEl("generalSectionForm").hidden = false;
}


async function changeKnowledgeSectionState(id, action) {
  await adminFetch(`/admin/knowledge/library/sections/${encodeURIComponent(id)}/${action}`, { method: "POST" });
  await loadKnowledgeSections();
}


async function moveKnowledgeMaterial(itemId, select) {
  const sectionId = select?.value;
  if (!sectionId) { setInspectorStatus("Select a destination folder.", "error"); return; }
  await adminFetch(`/admin/knowledge/library/sections/${encodeURIComponent(sectionId)}/relations`, { method: "PUT", body: JSON.stringify({ knowledge_item_id: itemId }) });
  await loadKnowledgeSections(); await loadKnowledgeMaterials();
}


function setKnowledgeMaterialMode(mode) {
  document.querySelectorAll("[data-material-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.materialMode === mode));
  document.querySelectorAll("[data-material-url-field]").forEach((field) => { field.hidden = mode !== "url"; });
  document.querySelectorAll("[data-material-file-field]").forEach((field) => { field.hidden = mode !== "file"; });
  adminEl("materialUrl").required = mode === "url";
  adminEl("materialFile").required = mode === "file";
}


function setKnowledgeField(id, value) { if (adminEl(id)) adminEl(id).value = value ?? ""; }


function openKnowledgeMaterialModal(item = null) {
  initializeKnowledgeLibraryControls(); adminEl("knowledgeMaterialForm").reset();
  const application = item?.applicability || {};
  setKnowledgeField("knowledgeEditId", item?.id); setKnowledgeField("materialTitle", item?.title); setKnowledgeField("materialType", item?.knowledge_type || "OTHER");
  setKnowledgeField("materialDescription", item?.summary || item?.metadata?.description); setKnowledgeField("materialStatus", item?.validation_status || "PENDING_REVIEW");
  setKnowledgeField("materialPageReference", item?.metadata?.page_reference); setKnowledgeField("materialNotes", item?.metadata?.notes);
  setKnowledgeField("materialMake", application.make || (knowledgeLibraryState.scope === "vehicles" ? knowledgeLibraryState.make : ""));
  setKnowledgeField("materialModel", application.model || (knowledgeLibraryState.scope === "vehicles" ? knowledgeLibraryState.model : ""));
  [["materialGeneration", "generation"], ["materialYearFrom", "year_from"], ["materialYearTo", "year_to"], ["materialBody", "body_type"], ["materialEngine", "engine_code"], ["materialTransmission", "transmission"], ["materialDrivetrain", "drivetrain"], ["materialMarket", "market"]].forEach(([id, key]) => setKnowledgeField(id, application[key]));
  const source = item?.knowledge_sources?.[0]?.source;
  setKnowledgeField("materialUrl", source?.url); setKnowledgeField("materialSourceType", source?.source_type);
  adminEl("knowledgeMaterialTitle").textContent = item ? "Edit Material" : "Add Material";
  adminEl("knowledgeMaterialContext").textContent = knowledgeLibraryState.scope === "general" ? "General Knowledge · choose a section/folder after saving when needed." : `Vehicle Library · ${[knowledgeLibraryState.make, knowledgeLibraryState.model].filter(Boolean).join(" ") || "vehicle applicability"}`;
  adminEl("knowledgeMaterialStatus").textContent = "";
  adminEl("knowledgeMaterialForm").querySelector(".knowledge-applicability").hidden = knowledgeLibraryState.scope === "general";
  setKnowledgeMaterialMode(source?.url || !item ? "url" : "note");
  adminEl("knowledgeMaterialModal").hidden = false;
}


function closeKnowledgeMaterialModal() { adminEl("knowledgeMaterialModal").hidden = true; }


function linesFromInput(id) { return String(adminEl(id)?.value || "").split("\n").map((line) => line.trim()).filter(Boolean); }


async function saveKnowledgeMaterial(event) {
  event.preventDefault();
  const editId = adminEl("knowledgeEditId").value;
  const mode = document.querySelector("[data-material-mode].is-active")?.dataset.materialMode || "note";
  const general = knowledgeLibraryState.scope === "general";
  const payload = {
    title: adminEl("materialTitle").value.trim(), knowledge_type: adminEl("materialType").value,
    description: adminEl("materialDescription").value.trim(), validation_status: adminEl("materialStatus").value,
    url: adminEl("materialUrl").value.trim() || null, source_type: adminEl("materialSourceType").value || null,
    page_reference: adminEl("materialPageReference").value.trim() || null, notes: adminEl("materialNotes").value.trim() || null,
    applicability: general ? null : {
      make: adminEl("materialMake").value.trim(), model: adminEl("materialModel").value.trim(), generation: adminEl("materialGeneration").value.trim() || null,
      year_from: adminEl("materialYearFrom").value || null, year_to: adminEl("materialYearTo").value || null, body_type: adminEl("materialBody").value.trim() || null,
      engine_code: adminEl("materialEngine").value.trim() || null, transmission: adminEl("materialTransmission").value.trim() || null,
      drivetrain: adminEl("materialDrivetrain").value.trim() || null, market: adminEl("materialMarket").value.trim() || null,
    },
  };
  adminEl("knowledgeMaterialSave").disabled = true; adminEl("knowledgeMaterialStatus").textContent = "Saving…";
  try {
    const saved = await adminFetch(editId ? `/admin/knowledge/library/items/${encodeURIComponent(editId)}` : "/admin/knowledge/library/items", { method: editId ? "PATCH" : "POST", body: JSON.stringify(payload) });
    const itemId = editId || saved.id;
    setKnowledgeField("knowledgeEditId", itemId);
    if (mode === "file") {
      const form = new FormData();
      form.append("file", adminEl("materialFile").files[0]);
      await adminFetch(`/admin/knowledge/library/items/${encodeURIComponent(itemId)}/files`, { method: "POST", body: form });
    }
    closeKnowledgeMaterialModal(); await loadKnowledgeMaterials();
  } catch (error) { adminEl("knowledgeMaterialStatus").textContent = error.message; adminEl("knowledgeMaterialStatus").className = "admin-status knowledge-form-wide error"; }
  finally { adminEl("knowledgeMaterialSave").disabled = false; }
}


async function archiveKnowledgeMaterial(itemId) {
  if (!window.confirm("Archive this material? It will remain recoverable in Supabase.")) return;
  await adminFetch(`/admin/knowledge/library/items/${encodeURIComponent(itemId)}/archive`, { method: "POST" });
  await loadKnowledgeMaterials();
}


function hardDeleteEndpoints(type, id) {
  const encoded = encodeURIComponent(id);
  if (type === "vehicle") return { preview: `/admin/knowledge/library/vehicles/${encoded}/delete-preview`, remove: `/admin/knowledge/library/vehicles/${encoded}` };
  if (type === "case") return { preview: `/admin/knowledge/library/successful-cases/${encoded}/delete-preview`, remove: `/admin/knowledge/library/successful-cases/${encoded}` };
  return { preview: `/admin/knowledge/library/items/${encoded}/delete-preview`, remove: `/admin/knowledge/library/items/${encoded}` };
}


function closeAdminHardDeleteModal() {
  adminEl("adminHardDeleteModal").hidden = true;
  adminHardDeleteState = null;
}


function renderHardDeletePreview(preview) {
  adminEl("adminHardDeleteTitle").textContent = `Delete ${String(preview.target_type || "record").replaceAll("_", " ")}`;
  adminEl("adminHardDeleteSummary").textContent = `${preview.target_label || preview.target_id} — related records were counted immediately before confirmation.`;
  adminEl("adminHardDeleteCounts").innerHTML = Object.entries(preview.counts || {}).map(([name, value]) => `<div class="hard-delete-count"><span>${escapeAdminHtml(name.replaceAll("_", " "))}</span><strong>${escapeAdminHtml(value)}</strong></div>`).join("");
  adminEl("adminHardDeleteEffects").innerHTML = Object.entries(preview.effects || {}).map(([effect, values]) => `<p><strong>${escapeAdminHtml(effect.toUpperCase())}:</strong> ${escapeAdminHtml((values || []).join(", ") || "None")}</p>`).join("");
}


async function openAdminHardDeleteModal(type, id) {
  const endpoints = hardDeleteEndpoints(type, id);
  adminHardDeleteState = { type, id, endpoints, preview: null };
  adminEl("adminHardDeleteModal").hidden = false;
  adminEl("adminHardDeleteTitle").textContent = "Confirm deletion";
  adminEl("adminHardDeleteSummary").textContent = "Loading current related-record counts…";
  adminEl("adminHardDeleteCounts").innerHTML = "";
  adminEl("adminHardDeleteEffects").innerHTML = "";
  adminEl("adminHardDeleteStatus").textContent = "";
  adminEl("adminHardDeleteConfirm").disabled = true;
  try {
    const preview = await adminFetch(endpoints.preview);
    if (!adminHardDeleteState || adminHardDeleteState.id !== id || adminHardDeleteState.type !== type) return;
    adminHardDeleteState.preview = preview;
    renderHardDeletePreview(preview);
    adminEl("adminHardDeleteConfirm").disabled = false;
  } catch (error) {
    adminEl("adminHardDeleteStatus").textContent = error.message;
    adminEl("adminHardDeleteStatus").className = "admin-status error";
  }
}


async function confirmAdminHardDelete() {
  const pending = adminHardDeleteState;
  if (!pending?.preview) return;
  const button = adminEl("adminHardDeleteConfirm");
  button.disabled = true;
  adminEl("adminHardDeleteStatus").textContent = "Deleting and verifying…";
  try {
    await adminFetch(pending.endpoints.remove, { method: "DELETE" });
    closeAdminHardDeleteModal();
    if (pending.type === "vehicle") {
      inspectorState.loaded.delete("vehicles");
      await loadInspectorVehicles();
    } else {
      knowledgeLibraryState.offset = 0;
      knowledgeLibraryState.reviewOffset = 0;
      await Promise.all([loadKnowledgeMaterials(), loadKnowledgeReviewQueue()]);
    }
  } catch (error) {
    adminEl("adminHardDeleteStatus").textContent = error.message;
    adminEl("adminHardDeleteStatus").className = "admin-status error";
    button.disabled = false;
  }
}


function reviewCandidateBody(entry) {
  const item = entry.candidate || {};
  const symptomTitle = Array.isArray(item.symptoms) ? item.symptoms.find(Boolean) : "";
  const original = entry.candidate_type === "SUCCESSFUL_CASE" ? item : (item.metadata?.original_case || {
    applicability: item.applicability, symptoms: item.symptoms, confirmed_facts: item.metadata?.confirmed_facts,
    causes: item.causes, checks: item.checks, action_or_repair: item.solutions,
    related_sources: (item.knowledge_sources || []).map((link) => link.source).filter(Boolean), original_case_reference: item.metadata?.original_case_reference,
  });
  const caseId = entry.candidate_type === "SUCCESSFUL_CASE" ? item.id : item.metadata?.origin_fleet_event_id;
  const caseDelete = caseId ? `<button class="admin-button admin-button-danger" type="button" data-hard-delete-type="case" data-hard-delete-id="${escapeAdminHtml(caseId)}">Delete Case</button>` : "";
  const review = item.metadata?.mechanic_review || {};
  return `<article class="knowledge-review-card"><header><div><span class="knowledge-origin is-${entry.candidate_type === "SUCCESSFUL_CASE" ? "user-case" : "candidate"}">${escapeAdminHtml(entry.candidate_type.replaceAll("_", " "))}</span><h3>${escapeAdminHtml(item.title || symptomTitle || item.cause || "Untitled candidate")}</h3></div><span class="knowledge-review-status">${escapeAdminHtml(item.validation_status || "PENDING REVIEW")}</span></header>${reviewCaseMarkup(entry)}<div class="knowledge-card-meta"><span>Review: ${escapeAdminHtml(review.decision || "Pending")}</span><span>Language: ${escapeAdminHtml(review.review_language || "Original")}</span></div><details><summary>Technical details</summary><pre class="inspector-json">${escapeAdminHtml(inspectorJson({ reference: item.id, source_relations: item.knowledge_sources || [], metadata: item.metadata || {} }))}</pre></details><footer><button class="admin-button admin-button-primary" type="button" data-review-candidate-type="${escapeAdminHtml(entry.candidate_type)}" data-review-candidate-id="${escapeAdminHtml(item.id)}">Open Case</button>${caseDelete}</footer></article>`;
}


function reviewHumanValue(value) {
  if (Array.isArray(value)) return value.filter((part) => part !== null && part !== undefined && part !== "").map(reviewHumanValue).filter(Boolean).join("; ");
  if (value && typeof value === "object") return Object.entries(value).filter(([, part]) => part !== null && part !== undefined && part !== "").map(([key, part]) => `${key.replaceAll("_", " ")}: ${reviewHumanValue(part)}`).join("; ");
  return String(value ?? "").trim();
}


function reviewFirst(...values) {
  return values.find((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
}


function reviewCaseFields(entry) {
  const item = entry?.candidate || {};
  const metadata = item.metadata || {};
  const successful = entry?.candidate_type === "SUCCESSFUL_CASE" || metadata.material_type === "SUCCESSFUL_CASE";
  const original = entry?.candidate_type === "SUCCESSFUL_CASE" ? item : (metadata.original_case || {});
  const originEvent = item.origin_event || metadata.origin_event || original.origin_event || {};
  const problem = item.original_problem || metadata.original_problem || original.original_problem || {};
  const review = metadata.mechanic_review || {};
  const applicability = item.applicability || original.applicability || metadata.applicability;
  return {
    vehicle: applicability ? knowledgeApplicabilityText(applicability) : "",
    original_problem: reviewFirst(problem.user_complaint, problem.title, problem.description, problem.summary, original.user_complaint) || "",
    symptoms: reviewFirst(original.symptoms, item.symptoms, problem.symptoms) || [],
    history_context: [originEvent.event_type, originEvent.title, originEvent.description, originEvent.notes, originEvent.event_date, originEvent.mileage].filter((value) => value !== null && value !== undefined && value !== ""),
    checked: reviewFirst(original.checks, item.checks, metadata.confirmed_facts, originEvent.metadata?.checks, problem.checks) || [],
    hypotheses: reviewFirst(problem.current_conclusion, problem.possible_causes, metadata.hypotheses, !successful ? item.causes : []) || [],
    recommended_checks: reviewFirst(item.checks, original.recommended_checks, problem.next_steps) || [],
    action_repair: reviewFirst(original.action, original.action_or_repair, item.solutions, originEvent.action) || "",
    confirmed_cause: successful ? (reviewFirst(original.cause, item.cause, item.causes) || "") : (review.confirmed_cause || ""),
    outcome: reviewFirst(original.result, metadata.result, originEvent.result) || "",
  };
}


function reviewSourceMarkup(entry) {
  const item = entry?.candidate || {};
  const original = entry?.candidate_type === "SUCCESSFUL_CASE" ? item : (item.metadata?.original_case || {});
  const sourceRows = [
    ...(item.knowledge_sources || []).map((link) => link.source),
    ...(item.related_sources || []).map((link) => link.source || link),
    ...(Array.isArray(original.related_sources) ? original.related_sources.map((link) => link.source || link) : []),
  ].filter(Boolean).filter((source, index, rows) => rows.findIndex((candidate) => String(candidate.id || candidate.url || candidate.canonical_url) === String(source.id || source.url || source.canonical_url)) === index);
  const sourceLinks = sourceRows.map((source) => {
    const url = safeInspectorUrl(source.url || source.canonical_url);
    return url ? `<a class="inspector-link" href="${escapeAdminHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeAdminHtml(source.title || source.domain || url)} ↗</a>` : `<span>${escapeAdminHtml(source.title || source.domain || "Source")}</span>`;
  }).join("");
  return sourceLinks || '<span class="admin-muted">Not recorded</span>';
}


function reviewCaseMarkup(entry, fields = reviewCaseFields(entry)) {
  const labels = {
    vehicle: "Vehicle / applicability", original_problem: "Original problem / user complaint",
    symptoms: "Symptoms", history_context: "Relevant vehicle / history context",
    checked: "Already checked", hypotheses: "PULS diagnosis / hypotheses",
    recommended_checks: "Recommended checks", action_repair: "Actual action / repair",
    confirmed_cause: "Confirmed cause", outcome: "Outcome",
  };
  const rows = Object.entries(labels).map(([key, label]) => `<dt>${escapeAdminHtml(label)}</dt><dd>${escapeAdminHtml(reviewHumanValue(fields[key]) || "Not recorded")}</dd>`).join("");
  return `<section class="case-human-summary"><dl class="human-readable-fields">${rows}</dl><div class="knowledge-source-links"><strong>Evidence / Sources</strong>${reviewSourceMarkup(entry)}</div></section>`;
}


async function loadKnowledgeReviewQueue() {
  const params = new URLSearchParams({ limit: String(knowledgeLibraryState.limit), offset: String(knowledgeLibraryState.reviewOffset), status: adminEl("reviewQueueStatus")?.value || "PENDING_REVIEW" });
  adminEl("reviewQueueList").innerHTML = '<div class="admin-empty">Loading review queue…</div>';
  const payload = await adminFetch(`/admin/knowledge/library/review-queue?${params}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  knowledgeLibraryState.reviewCandidates = new Map(items.map((entry) => [String(entry.candidate?.id || ""), entry]));
  adminEl("reviewQueueList").innerHTML = items.length ? items.map(reviewCandidateBody).join("") : '<div class="admin-empty">No candidates in this review state.</div>';
  const total = Number(payload?.total || 0), offset = Number(payload?.offset || 0), limit = Number(payload?.limit || knowledgeLibraryState.limit);
  adminEl("reviewQueuePager").innerHTML = total > limit ? `<button class="admin-button" type="button" data-review-page="${Math.max(0, offset - limit)}" ${offset <= 0 ? "disabled" : ""}>Previous</button><span>${offset + 1}–${Math.min(total, offset + limit)} of ${total}</span><button class="admin-button" type="button" data-review-page="${offset + limit}" ${offset + limit >= total ? "disabled" : ""}>Next</button>` : "";
}


function reviewCanonicalForm(entry) {
  const review = entry?.candidate?.metadata?.mechanic_review || {};
  return {
    technical_comment: review.technical_comment || "",
    normalized_symptoms: Array.isArray(review.normalized_symptoms) ? review.normalized_symptoms : [],
    confirmed_cause: review.confirmed_cause || "",
    recommended_checks: Array.isArray(review.recommended_checks) ? review.recommended_checks : [],
    verification_note: review.verification_note || "",
  };
}


function setReviewForm(values) {
  setKnowledgeField("reviewComment", values.technical_comment);
  setKnowledgeField("reviewSymptoms", (values.normalized_symptoms || []).join("\n"));
  setKnowledgeField("reviewCause", values.confirmed_cause);
  setKnowledgeField("reviewChecks", (values.recommended_checks || []).join("\n"));
  setKnowledgeField("reviewVerification", values.verification_note);
}


function currentReviewForm() {
  return {
    technical_comment: adminEl("reviewComment").value.trim(),
    normalized_symptoms: linesFromInput("reviewSymptoms"),
    confirmed_cause: adminEl("reviewCause").value.trim(),
    recommended_checks: linesFromInput("reviewChecks"),
    verification_note: adminEl("reviewVerification").value.trim(),
  };
}


async function translateReviewFields(fields, targetLanguage) {
  const payload = await adminFetch("/admin/knowledge/library/review-translation", { method: "POST", body: JSON.stringify({ target_language: targetLanguage, fields }) });
  return payload?.fields || {};
}


function reviewTranslationPayload(caseFields, formFields) {
  return {
    ...caseFields,
    review_technical_comment: formFields.technical_comment,
    review_symptoms: formFields.normalized_symptoms,
    review_confirmed_cause: formFields.confirmed_cause,
    review_recommended_checks: formFields.recommended_checks,
    review_verification_note: formFields.verification_note,
  };
}


function splitReviewTranslation(fields) {
  return {
    caseFields: Object.fromEntries(Object.entries(fields).filter(([key]) => !key.startsWith("review_"))),
    formFields: {
      technical_comment: fields.review_technical_comment || "",
      normalized_symptoms: fields.review_symptoms || [],
      confirmed_cause: fields.review_confirmed_cause || "",
      recommended_checks: fields.review_recommended_checks || [],
      verification_note: fields.review_verification_note || "",
    },
  };
}


async function changeKnowledgeReviewLanguage() {
  if (!knowledgeReviewWorkspace) return;
  const language = adminEl("reviewLanguage")?.value || "";
  const status = adminEl("knowledgeReviewStatus");
  status.className = "admin-status knowledge-form-wide";
  if (!language || language === "en") {
    adminEl("reviewWorkspaceCase").innerHTML = knowledgeReviewWorkspace.canonicalMarkup;
    setReviewForm(knowledgeReviewWorkspace.canonicalForm);
    status.textContent = "";
    return;
  }
  const cached = knowledgeReviewWorkspace.translations.get(language);
  if (cached) {
    adminEl("reviewWorkspaceCase").innerHTML = `${reviewCaseMarkup(knowledgeReviewWorkspace.entry, cached.caseFields)}${knowledgeReviewWorkspace.technicalMarkup}`;
    setReviewForm(cached.formFields);
    status.textContent = "";
    return;
  }
  status.textContent = "Translating Case for review…";
  try {
    const translated = splitReviewTranslation(await translateReviewFields(reviewTranslationPayload(knowledgeReviewWorkspace.canonicalCase, knowledgeReviewWorkspace.canonicalForm), language));
    knowledgeReviewWorkspace.translations.set(language, translated);
    adminEl("reviewWorkspaceCase").innerHTML = `${reviewCaseMarkup(knowledgeReviewWorkspace.entry, translated.caseFields)}${knowledgeReviewWorkspace.technicalMarkup}`;
    setReviewForm(translated.formFields);
    status.textContent = "";
  } catch (error) {
    adminEl("reviewWorkspaceCase").innerHTML = knowledgeReviewWorkspace.canonicalMarkup;
    setReviewForm(knowledgeReviewWorkspace.canonicalForm);
    status.textContent = `Translation failed. Showing canonical Case: ${error.message}`;
    status.className = "admin-status knowledge-form-wide error";
  }
}


function openKnowledgeReviewModal(type, id) {
  adminEl("knowledgeReviewForm").reset(); setKnowledgeField("reviewCandidateType", type); setKnowledgeField("reviewCandidateId", id);
  const entry = knowledgeLibraryState.reviewCandidates.get(String(id));
  const technicalMarkup = entry ? `<details><summary>Technical details</summary><pre class="inspector-json">${escapeAdminHtml(inspectorJson({ candidate_type: entry.candidate_type, id, metadata: entry.candidate?.metadata || {} }))}</pre></details>` : "";
  const canonicalCase = entry ? reviewCaseFields(entry) : {};
  const canonicalForm = reviewCanonicalForm(entry);
  const canonicalMarkup = entry ? `${reviewCaseMarkup(entry, canonicalCase)}${technicalMarkup}` : '<div class="admin-empty">Case context is unavailable. Refresh the review queue.</div>';
  knowledgeReviewWorkspace = { entry, canonicalCase, canonicalForm, canonicalMarkup, technicalMarkup, translations: new Map() };
  adminEl("reviewWorkspaceCase").innerHTML = canonicalMarkup;
  setReviewForm(canonicalForm);
  const savedLanguage = entry?.candidate?.metadata?.mechanic_review?.review_language || "";
  setKnowledgeField("reviewLanguage", savedLanguage);
  adminEl("knowledgeReviewStatus").textContent = ""; adminEl("knowledgeReviewModal").hidden = false;
  if (savedLanguage && savedLanguage !== "en") changeKnowledgeReviewLanguage();
}


async function saveKnowledgeReview(event) {
  event.preventDefault();
  const reviewLanguage = adminEl("reviewLanguage")?.value || "";
  const authored = currentReviewForm();
  const payload = { candidate_type: adminEl("reviewCandidateType").value, candidate_id: adminEl("reviewCandidateId").value, decision: adminEl("reviewDecision").value, review_language: reviewLanguage || null, ...authored };
  try {
    if (reviewLanguage === "ru") {
      adminEl("knowledgeReviewStatus").textContent = "Normalizing review to canonical English…";
      const translated = await translateReviewFields({
        review_technical_comment: authored.technical_comment,
        review_symptoms: authored.normalized_symptoms,
        review_confirmed_cause: authored.confirmed_cause,
        review_recommended_checks: authored.recommended_checks,
        review_verification_note: authored.verification_note,
      }, "en");
      payload.technical_comment = translated.review_technical_comment || null;
      payload.normalized_symptoms = translated.review_symptoms || [];
      payload.confirmed_cause = translated.review_confirmed_cause || null;
      payload.recommended_checks = translated.review_recommended_checks || [];
      payload.verification_note = translated.review_verification_note || null;
      payload.review_language_content = authored;
    }
    await adminFetch("/admin/knowledge/library/reviews", { method: "POST", body: JSON.stringify(payload) }); adminEl("knowledgeReviewModal").hidden = true; knowledgeReviewWorkspace = null; await loadKnowledgeReviewQueue();
  }
  catch (error) { adminEl("knowledgeReviewStatus").textContent = error.message; adminEl("knowledgeReviewStatus").className = "admin-status knowledge-form-wide error"; }
}


async function loadKnowledgeLibrary() {
  initializeKnowledgeLibraryControls(); renderKnowledgeCategories();
  await selectKnowledgeScope(knowledgeLibraryState.scope);
}


async function loadAdminSuccessfulCases() {
  const payload = await adminFetch(`/admin/knowledge/library/items?limit=${knowledgeLibraryState.limit}&offset=0&knowledge_type=SUCCESSFUL_CASE`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  knowledgeLibraryState.items = new Map(items.map((item) => [String(item.id), item]));
  adminEl("successfulCaseList").innerHTML = items.length ? items.map((item) => {
    const original = item.metadata?.original_case || {};
    const vehicle = knowledgeApplicabilityText(item.applicability);
    const sources = knowledgeSourceLinks(item);
    return `<article class="knowledge-material-card successful-case-card"><header><div><span class="knowledge-origin is-successful-user-case">Successful Case</span><h3>${escapeAdminHtml(item.title || "Confirmed repair case")}</h3></div><span class="knowledge-review-status">${escapeAdminHtml(item.validation_status || "Pending review")}</span></header><div class="knowledge-applicability-line">${escapeAdminHtml(vehicle)}</div><dl class="human-readable-fields"><dt>Symptoms</dt><dd>${escapeAdminHtml(compactInspectorValue(item.symptoms || original.symptoms || "Not recorded"))}</dd><dt>Confirmed cause</dt><dd>${escapeAdminHtml(compactInspectorValue(item.causes || original.cause || "Not recorded"))}</dd><dt>Repair / action</dt><dd>${escapeAdminHtml(compactInspectorValue(item.solutions || original.action || "Not recorded"))}</dd><dt>Result</dt><dd>${escapeAdminHtml(compactInspectorValue(item.metadata?.result || original.result || "Not recorded"))}</dd></dl>${sources ? `<div class="knowledge-source-links">${sources}</div>` : ""}<details><summary>Technical provenance · debug</summary><pre class="inspector-json">${escapeAdminHtml(inspectorJson({ id: item.id, origin: item.metadata?.original_case_reference, review: item.metadata?.mechanic_review }))}</pre></details><footer><button class="admin-button" type="button" data-edit-knowledge="${escapeAdminHtml(item.id)}">Edit</button></footer></article>`;
  }).join("") : '<div class="admin-empty">No successful cases are available.</div>';
  const total = Number(payload?.total || items.length);
  adminEl("successfulCasePager").innerHTML = total ? `<span>${total} successful case(s)</span>` : "";
}


async function loadAdminSchemaGaps() {
  const payload = await adminFetch("/admin/knowledge/vehicle-schema/gaps?limit=100&offset=0&status=UNMAPPED");
  const items = Array.isArray(payload?.items) ? payload.items : [];
  adminEl("schemaGapList").innerHTML = items.length ? items.map((gap) => `<article class="knowledge-material-card"><header><div><span class="knowledge-origin">Schema Gap</span><h3>${escapeAdminHtml(gap.normalized_parameter || gap.raw_parameter)}</h3></div><span class="knowledge-review-status">${escapeAdminHtml(gap.mapping_status)}</span></header><p>${escapeAdminHtml(compactInspectorValue(gap.normalized_value ?? gap.raw_value))}${gap.unit ? ` ${escapeAdminHtml(gap.unit)}` : ""}</p><div class="knowledge-applicability-line">${escapeAdminHtml(knowledgeApplicabilityText(gap.vehicle_context || gap.applicability))}</div><div class="knowledge-card-meta"><span>Source ${escapeAdminHtml(gap.source_id || "—")}</span><span>Search Run ${escapeAdminHtml(gap.origin_search_run_id || "—")}</span><span>Created ${escapeAdminHtml(formatAdminDate(gap.created_at))}</span></div><details><summary>Technical details</summary><pre class="inspector-json">${escapeAdminHtml(inspectorJson({ id: gap.id, vehicle_configuration_id: gap.vehicle_configuration_id }))}</pre></details><footer><button class="admin-button" type="button" data-gap-review="${escapeAdminHtml(gap.id)}" data-gap-status="REJECTED">Reject</button></footer></article>`).join("") : '<div class="admin-empty">No unmapped Schema Gaps.</div>';
}


const inspectorLoaders = {
  library: loadKnowledgeLibrary,
  general: () => selectKnowledgeScope("general"),
  materials: loadInspectorKnowledge,
  successful: loadAdminSuccessfulCases,
  review: loadKnowledgeReviewQueue,
  overview: loadInspectorOverview,
  vehicles: loadInspectorVehicles,
  conversations: loadInspectorConversations,
  problems: loadInspectorProblems,
  events: loadInspectorEvents,
  search: loadInspectorSearch,
  sources: loadInspectorSources,
  knowledge: loadInspectorKnowledge,
  "schema-gaps": loadAdminSchemaGaps,
  storage: async () => {},
  system: async () => {}
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
  const primaryTabs = new Set(["library", "general", "successful", "review", "system"]);
  if (!primaryTabs.has(tab) && inspectorLoaders[tab]) {
    inspectorState.systemView = tab;
    tab = "system";
  }
  if (!primaryTabs.has(tab)) tab = "library";
  inspectorState.tab = tab;
  document.querySelectorAll("[data-inspector-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.inspectorTab === tab);
  });
  document.querySelectorAll(".inspector-panel").forEach((panel) => { panel.hidden = true; });
  adminEl("knowledgeSystemNav").hidden = tab !== "system";
  if (tab === "system") { await selectSystemView(inspectorState.systemView); return; }
  const panelAlias = { general: "Library", materials: "Knowledge", "schema-gaps": "SchemaGaps" };
  const panelId = `inspector${panelAlias[tab] || (tab.charAt(0).toUpperCase() + tab.slice(1))}`;
  const panel = adminEl(panelId);
  if (panel) panel.hidden = false;
  window.history.replaceState(null, "", `#knowledge/${tab}`);
  if (tab === "library") { await selectKnowledgeScope("vehicles"); return; }
  if (tab === "general") { await selectKnowledgeScope("general"); return; }
  await loadInspectorTab(tab);
}


async function selectSystemView(view) {
  const allowed = new Set(["overview", "conversations", "search", "sources", "schema-gaps", "storage", "knowledge", "vehicles", "problems", "events"]);
  inspectorState.systemView = allowed.has(view) ? view : "overview";
  document.querySelectorAll(".inspector-panel").forEach((panel) => { panel.hidden = true; });
  document.querySelectorAll("[data-system-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.systemView === inspectorState.systemView));
  const aliases = { "schema-gaps": "SchemaGaps" };
  const name = aliases[inspectorState.systemView] || (inspectorState.systemView.charAt(0).toUpperCase() + inspectorState.systemView.slice(1));
  const panel = adminEl(`inspector${name}`);
  if (panel) panel.hidden = false;
  window.history.replaceState(null, "", `#knowledge/system/${inspectorState.systemView}`);
  await loadInspectorTab(inspectorState.systemView);
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
  speed: 1, streamAbort: null, streamCursor: 0, mode: "trace", copyTimer: null,
  followUsers: new Map(), followVehicles: new Map(), vehicleLookupTimer: null
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
      <span>Vehicle: ${escapeAdminHtml(trace.vehicle_label || trace.vehicle_id || "standalone")}</span>
      <span>${escapeAdminHtml(trace.message_excerpt || "No excerpt")}</span>
      <small>${escapeAdminHtml(trace.started_at || "")} · ${Number(trace.duration_ms || 0)} ms</small>
    </button>`).join("") : '<div class="admin-empty">No traces found.</div>';
}


function shortFlowId(value) {
  const text = String(value || "");
  return text.length > 12 ? `${text.slice(0, 8)}…${text.slice(-4)}` : text;
}


function flowUserLabel(user) {
  const id = String(user.user_id || user.id || "");
  return `${user.email || user.full_name || user.name || "User"} · ${shortFlowId(id)}`;
}


function renderFlowUserOptions() {
  const node = adminEl("flowUserOptions");
  if (!node) return;
  liveFlowState.followUsers = new Map();
  node.innerHTML = adminUsers.map((user) => {
    const id = String(user.user_id || user.id || "");
    const label = flowUserLabel(user);
    if (id) { liveFlowState.followUsers.set(label, id); liveFlowState.followUsers.set(id, id); }
    return id ? `<option value="${escapeAdminHtml(label)}"></option>` : "";
  }).join("");
}


function flowVehicleLabel(vehicle) {
  const identity = [vehicle.make || vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "Vehicle";
  const owner = vehicle.user?.email || vehicle.user?.full_name || vehicle.user?.name || (vehicle.user_id ? `owner ${shortFlowId(vehicle.user_id)}` : "owner unknown");
  return `${identity} · ${shortFlowId(vehicle.id)} · ${owner}`;
}


async function loadFlowVehicleOptions(query = "") {
  const node = adminEl("flowVehicleOptions");
  if (!node) return;
  try {
    const params = new URLSearchParams({ limit: "25", offset: "0" });
    if (query.trim()) params.set("q", query.trim());
    const payload = await adminFetch(`/admin/knowledge/vehicles?${params}`);
    const vehicles = Array.isArray(payload?.items) ? payload.items : [];
    liveFlowState.followVehicles = new Map();
    node.innerHTML = vehicles.map((vehicle) => {
      const id = String(vehicle.id || "");
      const label = flowVehicleLabel(vehicle);
      if (id) { liveFlowState.followVehicles.set(label, id); liveFlowState.followVehicles.set(id, id); }
      return id ? `<option value="${escapeAdminHtml(label)}"></option>` : "";
    }).join("");
  } catch (error) {
    flowSetStatus(`Vehicle lookup failed: ${error.message}`, "error");
  }
}


async function applyFlowFollow(kind) {
  const input = adminEl(kind === "user" ? "flowFollowUser" : "flowFollowVehicle");
  const map = kind === "user" ? liveFlowState.followUsers : liveFlowState.followVehicles;
  const id = map.get(input?.value.trim());
  if (!id) return;
  setKnowledgeField("flowUser", kind === "user" ? id : "");
  setKnowledgeField("flowVehicle", kind === "vehicle" ? id : "");
  setKnowledgeField(kind === "user" ? "flowFollowVehicle" : "flowFollowUser", "");
  flowSetStatus(`Following ${kind} ${shortFlowId(id)}.`);
  await loadFlowTraces();
}


async function clearFlowFollow() {
  ["flowFollowUser", "flowFollowVehicle", "flowUser", "flowVehicle"].forEach((id) => setKnowledgeField(id, ""));
  flowSetStatus("");
  await loadFlowTraces();
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


function flowTraceDataset() {
  return liveFlowState.events.map((event, index) => {
    const source = String(event.from_node || "").trim();
    const target = String(event.to_node || "").trim();
    const missing = [!source ? "from_node" : "", !target ? "to_node" : ""].filter(Boolean);
    return {
      ...event,
      _trace_index: index,
      _trace_source: source,
      _trace_target: target,
      _trace_mapped: missing.length === 0,
      _trace_mapping_gap: missing.length ? `missing ${missing.join(" and ")}` : "",
    };
  });
}


const FLOW_EXPORT_SENSITIVE_KEY = /(^|_|-)(authorization|auth|cookie|password|secret|api_?key|token|access_?token|refresh_?token|jwt|credential|session|signature|sig)s?($|_|-)/i;


function flowSanitizedExportData(value, key = "", seen = new WeakSet()) {
  if (FLOW_EXPORT_SENSITIVE_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [redacted]")
      .replace(/\b(?:sk|sb_secret)_[A-Za-z0-9_-]{12,}\b/gi, "[redacted]");
  }
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => flowSanitizedExportData(item, key, seen));
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
    childKey,
    flowSanitizedExportData(childValue, childKey, seen),
  ]));
}


function flowExportJson(value) {
  return JSON.stringify(flowSanitizedExportData(value), null, 2);
}


function flowExportTraceInfo() {
  const detail = liveFlowState.trace || {};
  const summary = liveFlowState.traces.find((item) => item.id === detail.id) || {};
  return { ...summary, ...detail };
}


function flowCollectSourceUrls(value, urls = new Set(), key = "") {
  if (value === null || value === undefined) return urls;
  if (typeof value === "string") {
    if ((/url|href/i.test(key) || /^https?:\/\//i.test(value)) && /^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (url.username) url.username = "redacted";
        if (url.password) url.password = "redacted";
        [...url.searchParams.keys()].forEach((name) => {
          if (FLOW_EXPORT_SENSITIVE_KEY.test(name)) url.searchParams.set(name, "[redacted]");
        });
        urls.add(url.toString());
      } catch { /* Ignore malformed saved URLs. */ }
    }
    return urls;
  }
  if (Array.isArray(value)) value.forEach((item) => flowCollectSourceUrls(item, urls, key));
  else if (typeof value === "object") Object.entries(value).forEach(([childKey, childValue]) => flowCollectSourceUrls(childValue, urls, childKey));
  return urls;
}


function buildFlowTraceExport() {
  const trace = flowExportTraceInfo();
  const events = flowTraceDataset();
  const requestId = trace.request_id || trace.id || "—";
  const metadata = [
    ["Request ID", requestId],
    ["Date/time", trace.started_at || trace.created_at],
    ["User", trace.user_label || trace.user_id],
    ["Vehicle ID", trace.vehicle_id],
    ["Conversation ID", trace.conversation_id],
    ["Problem ID", trace.problem_id],
    ["Intent", trace.intent],
    ["Status", trace.status],
    ["Duration", trace.duration_ms === null || trace.duration_ms === undefined ? null : `${trace.duration_ms} ms`],
    ["Event count", events.length],
  ];
  const lines = ["PULS REQUEST TRACE", ""];
  metadata.forEach(([label, value]) => lines.push(`${label}: ${value === null || value === undefined || value === "" ? "—" : value}`));
  lines.push("", "EVENTS", "");
  const technicalFields = ["module", "operation", "table_name", "record_id", "affected_rows", "stage_number", "source_group", "provider", "model", "duration_ms"];
  events.forEach((event, index) => {
    const number = String(event.sequence ?? index + 1).padStart(2, "0");
    const from = event._trace_source || "—";
    const to = event._trace_target || "—";
    lines.push(`${number} | +${Number(event.offset_ms || 0)} ms | ${from} → ${flowEventLabel(event)} → ${to} | ${event.status || "UNKNOWN"}${event._trace_mapped ? "" : " | UNMAPPED"}`);
    technicalFields.forEach((field) => {
      const value = event[field];
      if (value !== null && value !== undefined && value !== "") lines.push(`  ${field}: ${flowValue(flowSanitizedExportData(value, field))}`);
    });
    if (!event._trace_mapped) lines.push(`  visualization_mapping: UNMAPPED (${event._trace_mapping_gap})`);
    lines.push("");
  });
  const urls = new Set();
  events.forEach((event) => {
    flowCollectSourceUrls(event.input_data, urls);
    flowCollectSourceUrls(event.output_data, urls);
    flowCollectSourceUrls(event.telemetry, urls);
  });
  lines.push("SOURCES", "");
  if (urls.size) [...urls].forEach((url) => lines.push(`- ${url}`));
  else lines.push("No saved source URLs.");
  lines.push("", "TRACE DATA", "");
  let hasTraceData = false;
  events.forEach((event, index) => {
    const fields = ["input_data", "output_data", "telemetry", "related_ids"].filter((field) => {
      const value = event[field];
      return value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length) && (typeof value !== "object" || Array.isArray(value) || Object.keys(value).length);
    });
    if (!fields.length) return;
    hasTraceData = true;
    lines.push(`Event ${String(event.sequence ?? index + 1).padStart(2, "0")}`);
    fields.forEach((field) => lines.push(`  ${field}: ${flowExportJson(event[field]).replace(/\n/g, "\n  ")}`));
    lines.push("");
  });
  if (!hasTraceData) lines.push("No saved trace data.");
  return `${lines.join("\n").trimEnd()}\n`;
}


async function copyFlowTrace() {
  if (!liveFlowState.trace || !liveFlowState.events.length) return;
  const text = buildFlowTraceExport();
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(text);
  } catch {
    const field = document.createElement("textarea");
    field.value = text; field.style.position = "fixed"; field.style.opacity = "0";
    document.body.append(field); field.select(); document.execCommand("copy"); field.remove();
  }
  const button = adminEl("flowCopyTrace");
  if (!button) return;
  button.textContent = "Copied ✓";
  clearTimeout(liveFlowState.copyTimer);
  liveFlowState.copyTimer = setTimeout(() => { button.textContent = "Copy Trace"; }, 1500);
}


function exportFlowTrace() {
  if (!liveFlowState.trace || !liveFlowState.events.length) return;
  const trace = flowExportTraceInfo();
  const date = String(trace.started_at || trace.created_at || new Date().toISOString()).slice(0, 10);
  const requestId = String(trace.request_id || trace.id || "request").replace(/[^A-Za-z0-9._-]+/g, "-");
  const url = URL.createObjectURL(new Blob([buildFlowTraceExport()], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = `puls-trace-${date}-${requestId}.txt`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}


function selectFlowEvent(index) {
  const maximum = liveFlowState.events.length - 1;
  liveFlowState.index = Math.max(-1, Math.min(Number(index), maximum));
  if (adminEl("flowScrubber")) adminEl("flowScrubber").value = String(Math.max(0, liveFlowState.index));
  if (adminEl("flowClock")) adminEl("flowClock").textContent = `${Math.max(0, liveFlowState.index + 1)} / ${liveFlowState.events.length}`;
  renderFlowVisualization();
  renderFlowTimeline();
  const event = liveFlowState.events[liveFlowState.index];
  if (event) adminEl("flowInspector").textContent = JSON.stringify(event, null, 2);
}


function renderFlowTrace() {
  const graph = adminEl("flowGraph");
  if (!graph) return;
  const applied = flowTraceDataset().slice(0, liveFlowState.index + 1);
  if (!applied.length) { graph.innerHTML = '<div class="admin-empty">No events at this point in time.</div>'; return; }
  const nodes = [];
  const seen = new Set();
  applied.forEach((event) => [event._trace_source, event._trace_target].filter(Boolean).forEach((name) => {
    if (!seen.has(name)) { seen.add(name); nodes.push(name); }
  }));
  const active = applied[applied.length - 1];
  graph.innerHTML = `<div class="flow-node-grid">${nodes.map((name) => {
    const isDb = applied.some((event) => event.table_name === name);
    const isActive = active && (active._trace_source === name || active._trace_target === name);
    return `<button type="button" class="flow-node ${isDb ? "is-db" : ""} ${isActive ? "is-active" : ""}" data-flow-node="${escapeAdminHtml(name)}">${isDb ? "▰ " : ""}${escapeAdminHtml(name)}</button>`;
  }).join("")}</div><div class="flow-edge-list">${applied.map((event, index) => `<button type="button" class="flow-edge ${index === applied.length - 1 ? "is-active" : ""} ${event._trace_mapped ? "" : "is-unmapped"}" data-flow-event="${event._trace_index}"><span>${escapeAdminHtml(event._trace_source || "—")}</span><i><b></b>${escapeAdminHtml(flowEventLabel(event))}</i><span>${escapeAdminHtml(event._trace_target || "—")}</span>${event._trace_mapped ? "" : `<small>UNMAPPED · ${escapeAdminHtml(event._trace_mapping_gap)}</small>`}</button>`).join("")}</div>`;
}


function flowGraphNodeType(name, events) {
  if (events.some((event) => event.table_name === name)) return "db";
  if (/^stage\s+\d+/i.test(name)) return "stage";
  if (events.some((event) => event.source_group === name)) return "source-group";
  if (events.some((event) => event.provider === name || event.model === name)) return "provider";
  if (/knowledge/i.test(name)) return "knowledge";
  if (/classifier/i.test(name)) return "classifier";
  if (/context|vehicle fact|conversation|problem/i.test(name)) return "context";
  if (/user/i.test(name)) return "user";
  if (/answer/i.test(name)) return "answer";
  return "process";
}


function flowGraphStatusClass(status = "") {
  const value = String(status).toUpperCase();
  if (value === "FAILED") return "is-failed";
  if (value === "WARNING") return "is-warning";
  if (value === "SKIPPED") return "is-skipped";
  return "";
}


function renderFlowArchitectureGraph() {
  const graph = adminEl("flowGraph");
  if (!graph) return;
  const events = flowTraceDataset();
  if (!events.length) { graph.innerHTML = '<div class="admin-empty">Select a request.</div>'; return; }

  const nodeNames = [];
  const nodeSeen = new Set();
  events.forEach((event) => {
    [event._trace_source, event._trace_target].filter(Boolean).forEach((name) => {
      if (!nodeSeen.has(name)) { nodeSeen.add(name); nodeNames.push(name); }
    });
  });
  const lanes = { user: 90, process: 250, context: 410, classifier: 250, knowledge: 410, stage: 410, "source-group": 570, provider: 730, db: 730, answer: 250 };
  const laneRows = new Map();
  const positions = new Map();
  nodeNames.forEach((name) => {
    const type = flowGraphNodeType(name, events);
    const x = lanes[type] ?? lanes.process;
    const row = laneRows.get(x) || 0;
    laneRows.set(x, row + 1);
    positions.set(name, { x, y: 70 + row * 106, type });
  });
  const height = Math.max(460, ...[...positions.values()].map((position) => position.y + 80));
  const activeEvent = events[liveFlowState.index];
  const edges = events.filter((event) => event._trace_mapped).map((event) => ({
    event, index: event._trace_index, from: event._trace_source, to: event._trace_target,
  })).filter((edge) => positions.has(edge.from) && positions.has(edge.to));

  const edgeLayers = edges.map(({ event, index, from, to }) => {
    const a = positions.get(from), b = positions.get(to);
    const sameLane = Math.abs(a.x - b.x) < 10;
    let path, labelX, labelY;
    if (sameLane) {
      const downward = b.y >= a.y;
      const startY = downward ? a.y + 54 : a.y - 2;
      const endY = downward ? b.y - 2 : b.y + 54;
      const outsideX = a.x + (a.x >= 730 ? -80 : 80) - ((index % 3) - 1) * 10;
      path = `M ${a.x} ${startY} C ${outsideX} ${startY}, ${outsideX} ${endY}, ${b.x} ${endY}`;
      labelX = outsideX;
      labelY = (startY + endY) / 2;
    } else {
      const direction = b.x > a.x ? 1 : -1;
      const startX = a.x + direction * 69;
      const endX = b.x - direction * 69;
      const startY = a.y + 26;
      const endY = b.y + 26;
      const corridorX = (startX + endX) / 2 + ((index % 3) - 1) * 10;
      path = `M ${startX} ${startY} C ${corridorX} ${startY}, ${corridorX} ${endY}, ${endX} ${endY}`;
      labelX = corridorX;
      labelY = Math.abs(startY - endY) < 42 ? Math.min(startY, endY) - 38 : (startY + endY) / 2;
    }
    const phase = index === liveFlowState.index ? "is-active" : index < liveFlowState.index ? "is-passed" : "is-future";
    const statusClass = index <= liveFlowState.index ? flowGraphStatusClass(event.status) : "";
    const label = flowEventLabel(event);
    const labelWidth = Math.min(190, Math.max(46, String(label).length * 6.2 + 18));
    return {
      line: `<g class="architecture-edge ${phase} ${statusClass}" data-flow-event="${index}" role="button" tabindex="0">
      <path id="flowGraphEdge${index}" class="architecture-edge-path" d="${path}" marker-end="url(#flowArrow)"></path>
      <path class="architecture-edge-hit" d="${path}"></path>
      </g>`,
      label: `<g class="architecture-edge-label ${phase} ${statusClass}" data-flow-event="${index}" role="button" tabindex="0">
        <rect x="${labelX - labelWidth / 2}" y="${labelY - 13}" width="${labelWidth}" height="22" rx="7"></rect>
        <text x="${labelX}" y="${labelY + 2}">${escapeAdminHtml(label)}</text>
      </g>`,
      pulse: index === liveFlowState.index ? `<circle class="architecture-pulse" r="6"><animateMotion dur="1.1s" repeatCount="indefinite"><mpath href="#flowGraphEdge${index}"></mpath></animateMotion></circle>` : "",
    };
  });

  const nodeMarkup = nodeNames.map((name) => {
    const position = positions.get(name);
    const related = events.map((event) => ({ event, index: event._trace_index })).filter(({ event }) => event._trace_source === name || event._trace_target === name);
    const passed = related.filter(({ index }) => index <= liveFlowState.index);
    const nodeEvent = passed.at(-1)?.event;
    const active = activeEvent && (activeEvent._trace_source === name || activeEvent._trace_target === name);
    const phase = active ? "is-active" : passed.length ? "is-passed" : "is-future";
    const statusClass = nodeEvent ? flowGraphStatusClass(nodeEvent.status) : "";
    const label = String(name).length > 23 ? `${String(name).slice(0, 21)}…` : String(name);
    return `<g class="architecture-node is-${position.type} ${phase} ${statusClass}" transform="translate(${position.x - 66} ${position.y})" data-flow-node="${escapeAdminHtml(name)}" role="button" tabindex="0">
      <rect width="132" height="52" rx="${position.type === "db" ? 22 : 12}"></rect>
      <text x="66" y="31">${position.type === "db" ? "▰ " : ""}${escapeAdminHtml(label)}</text>
      ${related.length > 1 ? `<text class="architecture-node-count" x="122" y="12">${related.length}</text>` : ""}
    </g>`;
  }).join("");

  const unmappedMarkup = events.filter((event) => !event._trace_mapped).map((event) => `<button type="button" class="flow-unmapped-event ${event._trace_index === liveFlowState.index ? "is-active" : ""}" data-flow-event="${event._trace_index}"><b>${escapeAdminHtml(event.sequence)}</b><span>${escapeAdminHtml(flowEventLabel(event))}</span><small>UNMAPPED · ${escapeAdminHtml(event._trace_mapping_gap)}</small></button>`).join("");
  graph.innerHTML = `<svg class="architecture-graph" viewBox="0 0 820 ${height}" role="img" aria-label="Dynamic request architecture graph">
    <defs><marker id="flowArrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#496578"></path></marker></defs>
    <g class="architecture-lines-layer">${edgeLayers.map((edge) => edge.line).join("")}</g>
    <g class="architecture-nodes-layer">${nodeMarkup}</g>
    <g class="architecture-labels-layer">${edgeLayers.map((edge) => edge.label).join("")}</g>
    <g class="architecture-pulse-layer">${edgeLayers.map((edge) => edge.pulse).join("")}</g>
  </svg>${unmappedMarkup ? `<div class="flow-unmapped-list"><strong>Unmapped trace events</strong>${unmappedMarkup}</div>` : ""}`;
}


function renderFlowVisualization() {
  if (liveFlowState.mode === "graph") renderFlowArchitectureGraph();
  else renderFlowTrace();
}


function setFlowMode(mode) {
  liveFlowState.mode = mode === "graph" ? "graph" : "trace";
  document.querySelectorAll("[data-flow-mode]").forEach((button) => {
    const selected = button.dataset.flowMode === liveFlowState.mode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  renderFlowVisualization();
}


function renderFlowTimeline() {
  const node = adminEl("flowTimeline");
  if (!node) return;
  node.innerHTML = flowTraceDataset().map((event) => `<button type="button" class="flow-timeline-event ${event._trace_index === liveFlowState.index ? "is-active" : ""} ${event._trace_mapped ? "" : "is-unmapped"}" data-flow-event="${event._trace_index}"><b>${event.sequence}</b><span>${escapeAdminHtml(flowEventLabel(event))}</span><small>+${Number(event.offset_ms || 0)} ms${event._trace_mapped ? "" : ` · UNMAPPED (${escapeAdminHtml(event._trace_mapping_gap)})`}</small></button>`).join("");
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
  adminEl("flowCopyTrace").disabled = !liveFlowState.events.length;
  adminEl("flowExportTrace").disabled = !liveFlowState.events.length;
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
  else if (flow) { window.history.replaceState(null, "", "#live-flow"); renderFlowUserOptions(); await loadFlowVehicleOptions(); await loadFlowTraces(); }
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

    document.querySelectorAll("[data-system-view]").forEach((button) => {
      button.addEventListener("click", () => selectSystemView(button.dataset.systemView));
    });

    document.querySelectorAll("[data-inspector-load]").forEach((button) => {
      button.addEventListener("click", async () => {
        const tab = button.dataset.inspectorLoad;
        inspectorState.offsets[tab] = 0;
        await loadInspectorTab(tab, true);
      });
    });

    adminEl("inspectorRefreshBtn")?.addEventListener("click", () => loadInspectorTab(inspectorState.tab === "system" ? inspectorState.systemView : inspectorState.tab, true));
    adminEl("knowledgeAddMaterial")?.addEventListener("click", () => openKnowledgeMaterialModal());
    adminEl("knowledgeNewSection")?.addEventListener("click", () => openKnowledgeSectionForm("SECTION"));
    adminEl("knowledgeNewFolder")?.addEventListener("click", () => openKnowledgeSectionForm("FOLDER"));
    adminEl("librarySearchButton")?.addEventListener("click", () => { knowledgeLibraryState.catalogLetter = ""; loadKnowledgeCatalog(); });
    adminEl("libraryCatalogSearch")?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); knowledgeLibraryState.catalogLetter = ""; loadKnowledgeCatalog(); } });
    adminEl("libraryApplyFilters")?.addEventListener("click", applyKnowledgeFilters);
    adminEl("reviewQueueRefresh")?.addEventListener("click", () => { knowledgeLibraryState.reviewOffset = 0; loadKnowledgeReviewQueue(); });
    adminEl("knowledgeMaterialForm")?.addEventListener("submit", saveKnowledgeMaterial);
    adminEl("knowledgeReviewForm")?.addEventListener("submit", saveKnowledgeReview);
    adminEl("reviewLanguage")?.addEventListener("change", changeKnowledgeReviewLanguage);
    adminEl("generalSectionForm")?.addEventListener("submit", saveKnowledgeSection);
    adminEl("generalSectionCancel")?.addEventListener("click", resetKnowledgeSectionForm);
    adminEl("schemaGapRefresh")?.addEventListener("click", loadAdminSchemaGaps);
    adminEl("adminHardDeleteConfirm")?.addEventListener("click", confirmAdminHardDelete);
    adminEl("flowRefreshBtn")?.addEventListener("click", loadFlowTraces);
    adminEl("flowCopyTrace")?.addEventListener("click", copyFlowTrace);
    adminEl("flowExportTrace")?.addEventListener("click", exportFlowTrace);
    adminEl("flowStatus")?.addEventListener("change", loadFlowTraces);
    adminEl("flowSearch")?.addEventListener("click", () => {
      setKnowledgeField("flowFollowUser", ""); setKnowledgeField("flowFollowVehicle", ""); loadFlowTraces();
    });
    adminEl("flowFollowUser")?.addEventListener("change", () => applyFlowFollow("user"));
    adminEl("flowFollowVehicle")?.addEventListener("change", () => applyFlowFollow("vehicle"));
    adminEl("flowFollowVehicle")?.addEventListener("focus", () => loadFlowVehicleOptions(adminEl("flowFollowVehicle")?.value || ""));
    adminEl("flowFollowVehicle")?.addEventListener("input", (event) => {
      clearTimeout(liveFlowState.vehicleLookupTimer);
      liveFlowState.vehicleLookupTimer = setTimeout(() => loadFlowVehicleOptions(event.target.value), 250);
    });
    adminEl("flowFollowClear")?.addEventListener("click", clearFlowFollow);
    [adminEl("flowUser"), adminEl("flowVehicle")].forEach((input) => input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); loadFlowTraces(); }
    }));
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
      const closeKnowledge = event.target.closest?.("[data-close-knowledge-modal]");
      if (closeKnowledge) { closeKnowledgeMaterialModal(); return; }
      const closeReview = event.target.closest?.("[data-close-review-modal]");
      if (closeReview) { adminEl("knowledgeReviewModal").hidden = true; return; }
      const closeHardDelete = event.target.closest?.("[data-close-hard-delete]");
      if (closeHardDelete) { closeAdminHardDeleteModal(); return; }
      const hardDelete = event.target.closest?.("[data-hard-delete-type]");
      if (hardDelete) { await openAdminHardDeleteModal(hardDelete.dataset.hardDeleteType, hardDelete.dataset.hardDeleteId); return; }
      const materialMode = event.target.closest?.("[data-material-mode]");
      if (materialMode && !materialMode.disabled) { setKnowledgeMaterialMode(materialMode.dataset.materialMode); return; }
      const knowledgeScope = event.target.closest?.("[data-knowledge-scope]");
      if (knowledgeScope) { await selectKnowledgeScope(knowledgeScope.dataset.knowledgeScope); return; }
      const knowledgeLetter = event.target.closest?.("[data-knowledge-letter]");
      if (knowledgeLetter) { knowledgeLibraryState.catalogLetter = knowledgeLetter.dataset.knowledgeLetter; adminEl("libraryCatalogSearch").value = ""; document.querySelectorAll("[data-knowledge-letter]").forEach((button) => button.classList.toggle("is-active", button === knowledgeLetter)); await loadKnowledgeCatalog(); return; }
      const knowledgeModel = event.target.closest?.("[data-knowledge-model]");
      if (knowledgeModel) { await selectKnowledgeModel(knowledgeModel.dataset.knowledgeMake, knowledgeModel.dataset.knowledgeModel); return; }
      const configuration = event.target.closest?.("[data-configuration-id]");
      if (configuration) { knowledgeLibraryState.configurationId = configuration.dataset.configurationId; renderConfigurationPicker(); await loadKnowledgeMaterials(); return; }
      const knowledgeCategory = event.target.closest?.("[data-knowledge-category]");
      if (knowledgeCategory) { knowledgeLibraryState.category = knowledgeCategory.dataset.knowledgeCategory; knowledgeLibraryState.offset = 0; await loadKnowledgeMaterials(); return; }
      const sectionEdit = event.target.closest?.("[data-section-edit]");
      if (sectionEdit) { editKnowledgeSection(sectionEdit.dataset.sectionEdit); return; }
      const sectionState = event.target.closest?.("[data-section-state]");
      if (sectionState) { await changeKnowledgeSectionState(sectionState.dataset.sectionId, sectionState.dataset.sectionState); return; }
      const moveMaterial = event.target.closest?.("[data-move-material]");
      if (moveMaterial) { await moveKnowledgeMaterial(moveMaterial.dataset.moveMaterial, moveMaterial.closest("footer")?.querySelector("[data-material-section]")); return; }
      const gapReview = event.target.closest?.("[data-gap-review]");
      if (gapReview) { await adminFetch(`/admin/knowledge/vehicle-schema/gaps/${encodeURIComponent(gapReview.dataset.gapReview)}`, { method: "PATCH", body: JSON.stringify({ mapping_status: gapReview.dataset.gapStatus }) }); if (inspectorState.tab === "schema-gaps") await loadAdminSchemaGaps(); else await loadKnowledgeMaterials(); return; }
      const editKnowledge = event.target.closest?.("[data-edit-knowledge]");
      if (editKnowledge) { openKnowledgeMaterialModal(knowledgeLibraryState.items.get(String(editKnowledge.dataset.editKnowledge))); return; }
      const archiveKnowledge = event.target.closest?.("[data-archive-knowledge]");
      if (archiveKnowledge) { await archiveKnowledgeMaterial(archiveKnowledge.dataset.archiveKnowledge); return; }
      const libraryPage = event.target.closest?.("[data-library-page]");
      if (libraryPage && !libraryPage.disabled) { knowledgeLibraryState.offset = Number(libraryPage.dataset.libraryPage); await loadKnowledgeMaterials(); return; }
      const reviewPage = event.target.closest?.("[data-review-page]");
      if (reviewPage && !reviewPage.disabled) { knowledgeLibraryState.reviewOffset = Number(reviewPage.dataset.reviewPage); await loadKnowledgeReviewQueue(); return; }
      const reviewCandidate = event.target.closest?.("[data-review-candidate-id]");
      if (reviewCandidate) { openKnowledgeReviewModal(reviewCandidate.dataset.reviewCandidateType, reviewCandidate.dataset.reviewCandidateId); return; }
      const flowMode = event.target.closest?.("[data-flow-mode]");
      if (flowMode) { setFlowMode(flowMode.dataset.flowMode); return; }
      const flowTrace = event.target.closest?.("[data-flow-trace]");
      if (flowTrace) { await selectFlowTrace(flowTrace.dataset.flowTrace); return; }
      const flowEvent = event.target.closest?.("[data-flow-event]");
      if (flowEvent) { stopFlowPlayback(); selectFlowEvent(Number(flowEvent.dataset.flowEvent)); return; }
      const flowNode = event.target.closest?.("[data-flow-node]");
      if (flowNode) {
        const name = flowNode.dataset.flowNode;
        const related = flowTraceDataset().map((item) => ({ item, index: item._trace_index })).filter(({ item }) => item._trace_source === name || item._trace_target === name);
        const atOrBefore = related.filter(({ index }) => index <= liveFlowState.index);
        const selected = (atOrBefore.at(-1) || related[0]);
        if (selected) {
          selectFlowEvent(selected.index);
          adminEl("flowInspector").textContent = JSON.stringify({
            node: name,
            selected_sequence: selected.item.sequence,
            related_events: related.map(({ index }) => liveFlowState.events[index]),
          }, null, 2);
        }
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
