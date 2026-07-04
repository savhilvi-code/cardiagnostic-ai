import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const backendBaseUrl = String(process.env.PULS_BACKEND_URL || "https://puls-backend-t3sn.onrender.com").replace(/\/$/, "");

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

async function proxyBackend(path, options = {}) {
  const response = await fetch(`${backendBaseUrl}${path}`, options);
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "application/json";
  return { response, text, contentType };
}

app.use(express.json({ limit: "1mb" }));
app.use("/assets", express.static(join(__dirname, "assets")));
app.use("/pages", express.static(join(__dirname, "pages")));

app.get("/api/health", asyncRoute(async (req, res) => {
  const { response, text, contentType } = await proxyBackend("/health");
  res.status(response.status).type(contentType).send(text);
}));

app.get("/api/history", asyncRoute(async (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  const { response, text, contentType } = await proxyBackend(`/api/history${query ? `?${query}` : ""}`);
  res.status(response.status).type(contentType).send(text);
}));

app.post("/api/chat", asyncRoute(async (req, res) => {
  const { response, text, contentType } = await proxyBackend("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body || {}),
  });
  res.status(response.status).type(contentType).send(text);
}));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Server error" });
});

app.listen(port, () => {
  console.log(`PULS frontend dev server is running on http://localhost:${port}`);
});
