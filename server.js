import "dotenv/config";
import express from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const webhookUrl = process.env.N8N_WEBHOOK_URL || "";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined
});
const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

app.use(express.json({ limit: "1mb" }));
app.use("/assets", express.static(join(__dirname, "assets")));

function requireDatabaseConfig() {
  if (!process.env.DATABASE_URL) {
    const error = new Error("DATABASE_URL is not configured");
    error.status = 500;
    throw error;
  }
}

async function initializeDatabase() {
  requireDatabaseConfig();
  const schema = await readFile(join(__dirname, "db", "schema.sql"), "utf8");
  await pool.query(schema);
}

function formatHistoryRow(row) {
  const createdAt = new Date(row.created_at);
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    date: createdAt.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) + ", " +
      createdAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    vehicle: row.vehicle || "Укажите машину • Укажите мотор • Укажите привод",
    type: row.request_type || "Текстовый запрос",
    status: row.status || "Сохранено",
    createdAt: row.created_at
  };
}

async function upsertUser(client, userId) {
  await client.query(
    `insert into app_users (id, source, username, first_name, updated_at)
     values ($1, 'web', 'web_user', 'Web', now())
     on conflict (id) do update set updated_at = excluded.updated_at`,
    [userId]
  );
}

async function saveDiagnosticRequest({ userId, question, answer, vehicle = {}, requestType = "Текстовый запрос" }) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await upsertUser(client, userId);

    let vehicleId = null;
    const hasVehicle = Object.values(vehicle || {}).some(Boolean);
    if (hasVehicle) {
      const result = await client.query(
        `insert into vehicles (user_id, model, year, engine, drive, fuel, transmission, vin)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning id`,
        [
          userId,
          vehicle.model || null,
          vehicle.year ? Number(vehicle.year) : null,
          vehicle.engine || null,
          vehicle.drive || null,
          vehicle.fuel || null,
          vehicle.transmission || null,
          vehicle.vin || null
        ]
      );
      vehicleId = result.rows[0].id;
    }

    const saved = await client.query(
      `insert into diagnostic_requests (user_id, vehicle_id, question, answer, request_type)
       values ($1, $2, $3, $4, $5)
       returning id, question, answer, request_type, status, created_at`,
      [userId, vehicleId, question, answer, requestType]
    );

    await client.query("commit");
    return formatHistoryRow(saved.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

app.get("/api/health", asyncRoute(async (req, res) => {
  requireDatabaseConfig();
  await pool.query("select 1");
  res.json({ ok: true, database: "postgresql" });
}));

app.get("/api/history", asyncRoute(async (req, res) => {
  requireDatabaseConfig();
  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const result = await pool.query(
    `select dr.id, dr.question, dr.answer, dr.request_type, dr.status, dr.created_at,
            concat_ws(' • ', nullif(v.model, ''), nullif(v.engine, ''), nullif(v.drive, '')) as vehicle
     from diagnostic_requests dr
     left join vehicles v on v.id = dr.vehicle_id
     where dr.user_id = $1
     order by dr.created_at desc
     limit 50`,
    [userId]
  );
  res.json({ items: result.rows.map(formatHistoryRow) });
}));

app.post("/api/history", asyncRoute(async (req, res) => {
  requireDatabaseConfig();
  const userId = String(req.body.userId || "").trim();
  const question = String(req.body.question || "").trim();
  const answer = String(req.body.answer || "").trim();
  if (!userId || !question || !answer) {
    return res.status(400).json({ error: "userId, question and answer are required" });
  }

  const item = await saveDiagnosticRequest({
    userId,
    question,
    answer,
    vehicle: req.body.vehicle || {},
    requestType: req.body.type || "Текстовый запрос"
  });
  res.status(201).json({ item });
}));

app.post("/api/chat", asyncRoute(async (req, res) => {
  requireDatabaseConfig();
  const userId = String(req.body.userId || "").trim();
  const prompt = String(req.body.prompt || req.body.message || "").trim();
  const vehicle = req.body.vehicle || {};
  if (!userId || !prompt) return res.status(400).json({ error: "userId and prompt are required" });

  let answer;
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        text: prompt,
        prompt,
        source: "web",
        userId,
        user_id: userId,
        raw_user_id: userId,
        chat_id: userId,
        username: "web_user",
        first_name: "Web",
        vehicle
      })
    });
    if (!response.ok) throw new Error("n8n webhook returned an error");
    const data = await response.json();
    answer = data.reply || data.answer || data.message || data.output || JSON.stringify(data, null, 2);
  } else {
    answer = "Демо-ответ: подключите N8N_WEBHOOK_URL в .env. Начните с проверки ремня, роликов, генератора и помпы, затем считайте ошибки OBD2.";
  }

  const item = await saveDiagnosticRequest({ userId, question: prompt, answer, vehicle });
  res.json({ answer, item });
}));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Server error" });
});

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`CarDiagnostic AI is running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize PostgreSQL:", error.message);
    process.exit(1);
  });
