const isLocalPreviewHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const localPreviewBaseUrl = window.location.origin.replace(/\/$/, "");
const remoteBackendBaseUrl = "https://puls-backend-t3sn.onrender.com";

window.PULS_CONFIG = {
  API_BASE_URL: isLocalPreviewHost ? localPreviewBaseUrl : remoteBackendBaseUrl,
  CHAT_API_URL: isLocalPreviewHost ? `${localPreviewBaseUrl}/api/chat` : `${remoteBackendBaseUrl}/chat`,
  SPLINE_SCENE_URL: "https://my.spline.design/starterscenecopy-RDKY0gQFbXbkko9LN657PtBA/"
};
