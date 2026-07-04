const API_BASE_URL = (window.PULS_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");

export async function loadHistoryFromApi(userId) {
  const res = await fetch(`${API_BASE_URL}/api/history?user_id=${encodeURIComponent(userId)}`);
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

export async function sendChatMessage({ prompt, authUserId, email = "", username = "web_user", firstName = "Web", language = "ru", carInfo = "" }) {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: prompt,
      source: "web",
      auth_user_id: authUserId,
      email,
      username,
      first_name: firstName,
      language,
      car_info: carInfo
    })
  });

  if (!res.ok) throw new Error("api chat вернул ошибку");
  return res.json();
}
