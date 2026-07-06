import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const port = Number(process.env.PORT || 4173);
const backendBaseUrl = String(process.env.PULS_BACKEND_URL || "https://puls-backend-t3sn.onrender.com").replace(/\/$/, "");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

async function proxyBackend(path, options = {}) {
  const response = await fetch(`${backendBaseUrl}${path}`, options);
  const body = Buffer.from(await response.arrayBuffer());
  return {
    body,
    contentType: response.headers.get("content-type") || "application/json; charset=utf-8",
    status: response.status,
  };
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    const proxied = await proxyBackend("/health");
    res.writeHead(proxied.status, { "content-type": proxied.contentType });
    res.end(proxied.body);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/history") {
    const proxied = await proxyBackend(`/api/history${url.search}`);
    res.writeHead(proxied.status, { "content-type": proxied.contentType });
    res.end(proxied.body);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const proxied = await proxyBackend("/chat", {
      method: "POST",
      headers: { "Content-Type": req.headers["content-type"] || "application/json" },
      body: Buffer.concat(chunks),
    });
    res.writeHead(proxied.status, { "content-type": proxied.contentType });
    res.end(proxied.body);
    return;
  }

  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(root, requested));

  if (!filePath.startsWith(normalize(root))) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": types[extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(port, () => {
  console.log(`CarDiagnostic AI preview: http://localhost:${port}`);
});
