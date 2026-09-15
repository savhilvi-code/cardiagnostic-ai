const API_BASE_URL = (window.PULS_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");

async function getBackendAccessToken() {
  if (!window.supabaseClient) return "";
  const { data, error } = await window.supabaseClient.auth.getSession();
  return error ? "" : (data.session?.access_token || "");
}

async function backendJsonHeaders() {
  const token = await getBackendAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function backendAuthHeaders() {
  const token = await getBackendAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loadHistoryFromApi(userId) {
  const res = await fetch(`${API_BASE_URL}/api/history`, { headers: await backendAuthHeaders() });
  if (!res.ok) throw new Error("history api error");
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function saveHistoryToApi({ userId, question, answer, type, vehicle }) {
  return {
    skipped: true,
    reason: "history_is_saved_by_backend_chat",
    userId,
    question,
    answer,
    type,
    vehicle
  };
}

export async function sendChatMessage({ prompt, username = "web_user", firstName = "Web", language = "ru", carInfo = "" }) {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: await backendJsonHeaders(),
    body: JSON.stringify({
      message: prompt,
      source: "web",
      username,
      first_name: firstName,
      language,
      car_info: carInfo
    })
  });

  if (!res.ok) throw new Error("api chat вернул ошибку");
  return res.json();
}
