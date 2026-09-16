const ADMIN_API_BASE_URL = (
  window.PULS_CONFIG?.API_BASE_URL ||
  "https://puls-backend-t3sn.onrender.com"
).replace(/\/$/, "");

let adminUsers = [];
let selectedPlanUser = null;
let selectedDeleteUser = null;


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


document.addEventListener(
  "DOMContentLoaded",
  () => {
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
