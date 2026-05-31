
﻿const API_BASE_URL = "";
    const SPLINE_SCENE_URL = "";
import { SPLINE_SCENE_URL } from "./config.js";
import { loadHistoryFromApi, saveHistoryToApi, sendChatMessage } from "./api.js";

      try {
        const res = await fetch(`${API_BASE_URL}/api/history?userId=${encodeURIComponent(getWebUserId())}`);
        if (!res.ok) throw new Error("history api error");
        const data = await res.json();
        return Array.isArray(data.items) ? data.items : [];
        return await loadHistoryFromApi(getWebUserId());
      } catch (error) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: getWebUserId(),
            question,
            answer,
            type: item.type,
            vehicle: {
              model: "",
              year: "",
              engine: "",
              drive: "",
              fuel: ""
            }
          })
        await saveHistoryToApi({
          userId: getWebUserId(),
          question,
          answer,
          type: item.type,
          vehicle: {
            model: "",
            year: "",
            engine: "",
            drive: "",
            fuel: ""
          }
        });
        if (!res.ok) throw new Error("save history api error");
      } catch (error) {
      input.value = "";

      const loading = appendMessage("PULS анализирует запрос...", false);
      try {
        const res = await fetch(`${API_BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            userId: getWebUserId(),
            vehicle: {
              model: "",
              year: "",
              engine: "",
              drive: "",
              fuel: ""
            }
          })

      const loading = appendMessage("PULS анализирует запрос...", false);
      try {
        const data = await sendChatMessage({
          prompt,
          userId: getWebUserId(),
          vehicle: {
            model: "",
            year: "",
            engine: "",
            drive: "",
            fuel: ""
          }
        });
        if (!res.ok) throw new Error("api chat вернул ошибку");
        const data = await res.json();
        const answer = data.answer || data.reply || data.message || data.output || JSON.stringify(data, null, 2);
