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
    conversations: 0,
    problems: 0,
    events: 0,
    search: 0,
    sources: 0,
    knowledge: 0
  },
  limit: 25
};


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


function inspectorVehicle(row) {
  const vehicle = row?.vehicle;
  if (!vehicle) return row?.vehicle_id ? `Vehicle #${row.vehicle_id}` : "—";
  return [vehicle.brand, vehicle.model, vehicle.generation, vehicle.year]
    .filter(Boolean)
    .join(" ") || `Vehicle #${vehicle.id}`;
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
    conversations: "Conversations", messages: "Messages", problems: "Problems",
    vehicle_events: "Vehicle events", search_episodes: "Search episodes",
    search_runs: "Search runs", sources: "Sources", problem_sources: "Problem sources",
    knowledge_items: "Knowledge items", knowledge_sources: "Knowledge sources",
    fleet_events: "Fleet events"
  };
  adminEl("inspectorStats").innerHTML = Object.entries(labels).map(([key, label]) => `
    <article class="inspector-stat-card"><span>${label}</span><strong>${Number(payload?.counts?.[key] || 0)}</strong></article>`).join("");
  const recent = Array.isArray(payload?.recent_conversations) ? payload.recent_conversations : [];
  if (!recent.length) return renderInspectorEmpty("inspectorRecent", "No conversation activity yet.");
  adminEl("inspectorRecent").innerHTML = recent.map((row) => inspectorRow({
    id: row.id, kind: "recent", primary: row.title || `Conversation #${row.id}`,
    secondary: row.status || "—", meta: [
      { label: "Last message", value: formatAdminDate(row.last_message_at) },
      { label: "Vehicle", value: row.vehicle_id ? `#${row.vehicle_id}` : "—" },
      { label: "Problem", value: row.problem_id ? `#${row.problem_id}` : "—" }
    ], fields: [{ label: "Created", value: row.created_at }]
  })).join("");
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
    id: row.id, kind: "conversation", primary: row.title || `Conversation #${row.id}`,
    secondary: `${inspectorUser(row)} · ${inspectorVehicle(row)}`,
    meta: [
      { label: "Status", value: row.status || "—" },
      { label: "Messages", value: row.message_count ?? 0 },
      { label: "Last message", value: formatAdminDate(row.last_message_at) }
    ],
    fields: [
      { label: "Problem", value: row.problem?.title || row.problem_id },
      { label: "Channel", value: row.channel },
      { label: "Started", value: row.created_at }
    ], body: `<div class="inspector-messages" data-conversation-messages="${escapeAdminHtml(row.id)}"><div class="admin-empty">Expand to load messages.</div></div>`
  })).join("");
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
      return `<article class="inspector-message is-${escapeAdminHtml(role)}"><header>${escapeAdminHtml(role)} · ${escapeAdminHtml(formatAdminDate(row.created_at))}</header><div>${escapeAdminHtml(row.message_text || "")}</div></article>`;
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
    q: adminEl("problemSearch")?.value, problem_class: adminEl("problemClass")?.value
  });
  const payload = await adminFetch(`/admin/knowledge/problems?${query}`);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) renderInspectorEmpty("problemList");
  else adminEl("problemList").innerHTML = items.map((row) => inspectorRow({
    id: row.id, kind: "problem", primary: row.title || `Problem #${row.id}`,
    secondary: `${inspectorUser(row)} · ${inspectorVehicle(row)}`,
    meta: [
      { label: "Class", value: row.problem_class || "—" },
      { label: "Component", value: row.component || "—" },
      { label: "Status", value: row.status || "—" }
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
  renderInspectorPager(kind, payload, "problemPager");
}


function traceGroup(label, rows) {
  const items = Array.isArray(rows) ? rows : [];
  return `<h3>${escapeAdminHtml(label)} (${items.length})</h3>${items.length ? `<pre class="inspector-json">${escapeAdminHtml(JSON.stringify(items, null, 2))}</pre>` : `<div class="admin-status">No linked rows.</div>`}`;
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
      { label: "Type", value: row.event_type || "—" },
      { label: "Source", value: row.source || "—" },
      { label: "Event date", value: formatAdminDate(row.occurred_at) }
    ], fields: [
      { label: "Description", value: row.description }, { label: "Mileage", value: row.mileage },
      { label: "Event data / result", value: row.event_data }, { label: "Created", value: row.created_at }
    ]
  })).join("");
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
    secondary: `${inspectorVehicle(row)} · ${row.reason || "No trigger recorded"}`,
    meta: [
      { label: "Status", value: row.status || "—" },
      { label: "Created", value: formatAdminDate(row.created_at) },
      { label: "Updated", value: formatAdminDate(row.updated_at) }
    ], fields: [{ label: "Trigger / reason", value: row.reason }],
    body: `<div class="inspector-runs" data-episode-runs="${escapeAdminHtml(row.id)}"><div class="admin-empty">Expand to load search stages.</div></div>`
  })).join("");
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
        <div><strong>Query:</strong> ${escapeAdminHtml(run.query || "—")}</div>
        <div><strong>Sufficient:</strong> ${run.sufficient_evidence === true ? "yes" : "no"}</div>
        <div><strong>Summary:</strong> ${escapeAdminHtml(run.result_summary || "—")}</div>
        <div><strong>Sources found:</strong> ${Array.isArray(run.sources_found) ? run.sources_found.length : "—"} · <strong>Relevant:</strong> ${Array.isArray(run.relevant_sources) ? run.relevant_sources.length : "—"}</div>
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
    const url = safeInspectorUrl(row.canonical_url);
    return inspectorRow({
      id: row.id, kind: "source", primary: row.title || row.canonical_url || `Source #${row.id}`,
      secondary: row.canonical_url,
      meta: [
        { label: "Type", value: row.source_type || "—" },
        { label: "Problems", value: row.problem_sources?.length || 0 },
        { label: "Updated", value: formatAdminDate(row.updated_at) }
      ], fields: [
        { label: "URL", value: row.canonical_url }, { label: "Description", value: row.description },
        { label: "Metadata", value: row.metadata }, { label: "Problem relations", value: row.problem_sources }
      ], body: url ? `<p><a class="inspector-link" href="${escapeAdminHtml(url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a></p>` : ""
    });
  }).join("");
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
    secondary: [row.vehicle_make, row.vehicle_model, row.engine].filter(Boolean).join(" ") || row.provenance_type,
    meta: [
      { label: "Confidence", value: row.confidence ?? "—" },
      { label: "Component", value: row.component || "—" },
      { label: "Sources", value: row.knowledge_sources?.length || 0 }
    ], fields: [
      { label: "Summary", value: row.summary }, { label: "Content", value: row.content },
      { label: "Problem class", value: row.problem_class }, { label: "Provenance", value: row.provenance_type },
      { label: "Metadata", value: row.metadata }, { label: "Source relations", value: row.knowledge_sources }
    ]
  })).join("");
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
  renderInspectorPager(kind, {
    offset: knowledge.offset, limit: knowledge.limit,
    total: Math.max(Number(knowledge.total || 0), Number(fleet.total || 0))
  }, "knowledgePager");
}


const inspectorLoaders = {
  overview: loadInspectorOverview,
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


async function selectAdminSection(section) {
  const knowledge = section === "knowledge";
  adminEl("adminUsersSection").hidden = knowledge;
  adminEl("adminKnowledgeSection").hidden = !knowledge;
  document.querySelectorAll("[data-admin-section]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminSection === section);
  });
  if (knowledge) await selectInspectorTab(inspectorState.tab);
  else window.history.replaceState(null, "", "#users");
}


document.addEventListener(
  "DOMContentLoaded",
  () => {
    document.querySelectorAll("[data-admin-section]").forEach((button) => {
      button.addEventListener("click", () => selectAdminSection(button.dataset.adminSection));
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

    document.addEventListener("toggle", (event) => {
      const details = event.target.closest?.("details[data-inspector-kind]");
      if (!details?.open) return;
      if (details.dataset.inspectorKind === "conversation") loadConversationMessages(details);
      if (details.dataset.inspectorKind === "episode") loadEpisodeRuns(details);
    }, true);

    document.addEventListener("click", async (event) => {
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
