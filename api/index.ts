import { createServer } from "http";
import { Pool } from "pg";
import { SignJWT, jwtVerify } from "jose";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Config ────────────────────────────────────────────────────────────────
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me"
);
const ENC_KEY_HEX = process.env.ENCRYPTION_KEY;
const ENC_KEY = ENC_KEY_HEX ? Buffer.from(ENC_KEY_HEX, "hex") : randomBytes(32);
const FREE_LIMIT = 6;

// ─── Database ───────────────────────────────────────────────────────────────
function getDb() {
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) throw new Error("No DATABASE_URL set");
  return new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
}

// ─── JWT ────────────────────────────────────────────────────────────────────
async function signToken(sub: string, name: string | null): Promise<string> {
  return new SignJWT({ sub, name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("365d")
    .sign(JWT_SECRET);
}

async function verifyToken(token: string): Promise<{ sub: string; name: string | null } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { sub: payload.sub as string, name: (payload.name ?? null) as string | null };
  } catch { return null; }
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

async function getUser(req: any) {
  const cookies = parseCookies(req.headers?.cookie ?? "");
  const token = cookies["adhd_token"];
  if (!token) return null;
  return verifyToken(token);
}

function setAuthCookie(res: any, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie",
    `adhd_token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 3600}; SameSite=Lax${isProd ? "; Secure" : ""}`);
}

function clearAuthCookie(res: any) {
  const isProd = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie",
    `adhd_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProd ? "; Secure" : ""}`);
}

// ─── Encryption ─────────────────────────────────────────────────────────────
function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: Buffer.concat([enc, tag]).toString("base64"), iv: iv.toString("base64") };
}

function decrypt(encB64: string, ivB64: string): string {
  const iv = Buffer.from(ivB64, "base64");
  const combined = Buffer.from(encB64, "base64");
  const tag = combined.subarray(combined.length - 16);
  const enc = combined.subarray(0, combined.length - 16);
  const d = createDecipheriv("aes-256-gcm", ENC_KEY, iv);
  d.setAuthTag(tag);
  return d.update(enc) + d.final("utf8");
}


// ─── Auto-migration: create user_data table if not exists ─────────────────
async function ensureUserDataTable(db: any) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_data (
      user_id             TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tasks               JSONB NOT NULL DEFAULT '[]',
      brain_dump          JSONB NOT NULL DEFAULT '[]',
      focus_sessions      JSONB NOT NULL DEFAULT '{}',
      daily_logs          JSONB NOT NULL DEFAULT '{}',
      quick_chips         JSONB NOT NULL DEFAULT '[]',
      quadrant_map        JSONB NOT NULL DEFAULT '{}',
      quadrant_task_order JSONB NOT NULL DEFAULT '{}',
      calendar_day_order  JSONB NOT NULL DEFAULT '{}',
      deleted_categories  JSONB NOT NULL DEFAULT '[]',
      display_name        TEXT,
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// ─── Response helpers ────────────────────────────────────────────────────────
function json(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

// ─── Main handler ────────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.statusCode = 200; res.end(); return; }

  const url = req.url?.split("?")[0] ?? "/";

  // ── GET /api/ping ──────────────────────────────────────────────────────────
  if (url === "/api/ping") {
    json(res, 200, { ok: true, time: new Date().toISOString() });
    return;
  }

  // ── GET /api/health ────────────────────────────────────────────────────────
  if (url === "/api/health") {
    const env = {
      hasDatabaseUrl: !!(process.env.DATABASE_URL ?? process.env.POSTGRES_URL),
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
      hasOwnerKey: !!process.env.OWNER_OPENAI_KEY,
    };
    try {
      const db = getDb();
      await db.query("SELECT 1");
      await db.end();
      json(res, 200, { ok: true, db: "connected", env });
    } catch (err: any) {
      json(res, 500, { ok: false, error: err?.message, env });
    }
    return;
  }

  // ── POST /api/auth/login ───────────────────────────────────────────────────
  if (url === "/api/auth/login" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const { email, name } = body;
      if (!email || !email.includes("@")) {
        json(res, 400, { error: "Valid email required" }); return;
      }
      const id = email.trim().toLowerCase();
      const db = getDb();
      const { rows } = await db.query("SELECT id, name FROM users WHERE id = $1", [id]);
      let userName: string | null = null;

      if (rows.length === 0) {
        userName = name?.trim() || null;
        await db.query("INSERT INTO users (id, name) VALUES ($1, $2)", [id, userName]);
      } else {
        userName = rows[0].name;
        const newName = name?.trim();
        if (newName && newName !== userName) {
          userName = newName;
          await db.query("UPDATE users SET name = $1 WHERE id = $2", [userName, id]);
        }
      }
      await db.end();

      const token = await signToken(id, userName);
      setAuthCookie(res, token);
      json(res, 200, { user: { id, name: userName } });
    } catch (err: any) {
      console.error("Login error:", err);
      json(res, 500, { error: "Login failed: " + (err?.message ?? "unknown") });
    }
    return;
  }

  // ── POST /api/auth/logout ──────────────────────────────────────────────────
  if (url === "/api/auth/logout" && req.method === "POST") {
    clearAuthCookie(res);
    json(res, 200, { ok: true });
    return;
  }

  // ── GET /api/auth/me ───────────────────────────────────────────────────────
  if (url === "/api/auth/me") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }
    json(res, 200, { user: { id: user.sub, name: user.name } });
    return;
  }

  // ── /api/key (GET status / POST save / DELETE remove) ─────────────────────
  if (url === "/api/key") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }
    const db = getDb();

    if (req.method === "GET") {
      try {
        const { rows } = await db.query(
          "SELECT api_key_encrypted, ai_usage_count FROM users WHERE id = $1", [user.sub]);
        await db.end();
        const hasKey = !!(rows[0]?.api_key_encrypted);
        const usageCount = Number(rows[0]?.ai_usage_count ?? 0);
        json(res, 200, {
          hasKey,
          usageCount,
          freeLimit: FREE_LIMIT,
          remaining: hasKey ? null : Math.max(0, FREE_LIMIT - usageCount),
        });
      } catch (err: any) {
        json(res, 500, { error: err?.message });
      }
      return;
    }

    if (req.method === "POST") {
      try {
        const { key } = await readBody(req);
        if (!key) { json(res, 400, { error: "API key required" }); return; }
        const { encrypted, iv } = encrypt(key.trim());
        await db.query("UPDATE users SET api_key_encrypted = $1, api_key_iv = $2 WHERE id = $3",
          [encrypted, iv, user.sub]);
        await db.end();
        json(res, 200, { ok: true });
      } catch (err: any) {
        json(res, 500, { error: err?.message });
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        await db.query("UPDATE users SET api_key_encrypted = NULL, api_key_iv = NULL WHERE id = $1", [user.sub]);
        await db.end();
        json(res, 200, { ok: true });
      } catch (err: any) {
        json(res, 500, { error: err?.message });
      }
      return;
    }
  }

  // ── POST /api/ai/complete ──────────────────────────────────────────────────
  if (url === "/api/ai/complete" && req.method === "POST") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }

    try {
      const body = await readBody(req);
      const { systemPrompt, userMessage, model = "gpt-4o-mini" } = body;
      if (!userMessage) { json(res, 400, { error: "userMessage required" }); return; }

      const db = getDb();
      const { rows } = await db.query(
        "SELECT api_key_encrypted, api_key_iv, ai_usage_count FROM users WHERE id = $1", [user.sub]);
      const row = rows[0];
      await db.end();

      let apiKey: string;
      let usingOwnerKey = false;

      if (row?.api_key_encrypted && row?.api_key_iv) {
        apiKey = decrypt(row.api_key_encrypted, row.api_key_iv);
      } else {
        const usageCount = Number(row?.ai_usage_count ?? 0);
        if (usageCount >= FREE_LIMIT) {
          json(res, 402, {
            error: `You've used your ${FREE_LIMIT} free AI requests. Add your Gemini API key in Settings to continue.`,
            usageCount, freeLimit: FREE_LIMIT,
          });
          return;
        }
        const ownerKey = process.env.OWNER_GEMINI_KEY ?? process.env.OWNER_OPENAI_KEY;
        if (!ownerKey) {
          json(res, 402, { error: "No API key configured. Add your Gemini API key in Settings." });
          return;
        }
        apiKey = ownerKey;
        usingOwnerKey = true;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
      const prompt = systemPrompt ? `${systemPrompt}\n\nUser: ${userMessage}` : userMessage;
      const result = await geminiModel.generateContent(prompt);
      const content = result.response.text() ?? "";

      if (usingOwnerKey) {
        const db2 = getDb();
        await db2.query(
          "UPDATE users SET ai_usage_count = COALESCE(ai_usage_count,0)+1 WHERE id=$1", [user.sub]);
        const { rows: r2 } = await db2.query("SELECT ai_usage_count FROM users WHERE id=$1", [user.sub]);
        await db2.end();
        const newCount = Number(r2[0]?.ai_usage_count ?? 0);
        json(res, 200, { content, usageCount: newCount, freeLimit: FREE_LIMIT, remaining: FREE_LIMIT - newCount });
        return;
      }

      json(res, 200, { content });
    } catch (err: any) {
      console.error("AI error:", err);
      if (err?.status === 401 || err?.message?.includes("API_KEY_INVALID")) { json(res, 401, { error: "Invalid Gemini API key." }); return; }
      if (err?.status === 429) { json(res, 429, { error: "Gemini rate limit. Try again soon." }); return; }
      json(res, 500, { error: "AI request failed: " + (err?.message ?? "unknown") });
    }
    return;
  }

  // ── /api/tour-completed — GET status / POST mark done ──────────────────────
  if (url === "/api/tour-completed") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }
    const db = getDb();
    if (req.method === "GET") {
      try {
        const { rows } = await db.query(
          "SELECT tour_completed FROM users WHERE id = $1",
          [user.sub]
        );
        await db.end();
        json(res, 200, { tourCompleted: rows[0]?.tour_completed ?? false });
      } catch (err: any) {
        await db.end();
        json(res, 500, { error: err?.message });
      }
      return;
    }
    if (req.method === "POST") {
      try {
        await db.query(
          "UPDATE users SET tour_completed = TRUE WHERE id = $1",
          [user.sub]
        );
        await db.end();
        json(res, 200, { ok: true });
      } catch (err: any) {
        await db.end();
        json(res, 500, { error: err?.message });
      }
      return;
    }
  }

  // ── GET /api/config — expose public config to frontend ─────────────────────
  if (url === "/api/config") {
    json(res, 200, {
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    });
    return;
  }

  // ── POST /api/auth/google — verify Google ID token, issue session ──────────
  if (url === "/api/auth/google" && req.method === "POST") {
    try {
      const { credential } = await readBody(req);
      if (!credential) { json(res, 400, { error: "credential required" }); return; }

      // Verify Google ID token via Google's tokeninfo endpoint
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!r.ok) { json(res, 401, { error: "Invalid Google token" }); return; }
      const gUser = await r.json() as {
        sub: string; email: string; given_name?: string; name?: string;
        aud: string; exp: string;
      };

      // Validate audience matches our client ID
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (clientId && gUser.aud !== clientId) {
        json(res, 401, { error: "Token audience mismatch" }); return;
      }

      const email = gUser.email.toLowerCase();
      const firstName = gUser.given_name ?? gUser.name?.split(" ")[0] ?? null;

      const db = getDb();
      const { rows } = await db.query("SELECT id, name FROM users WHERE id = $1", [email]);
      if (rows.length === 0) {
        await db.query("INSERT INTO users (id, name) VALUES ($1, $2)", [email, firstName]);
      } else if (firstName && rows[0].name !== firstName) {
        await db.query("UPDATE users SET name = $1 WHERE id = $2", [firstName, email]);
      }
      await db.end();

      const token = await signToken(email, firstName);
      setAuthCookie(res, token);
      json(res, 200, { user: { id: email, name: firstName } });
    } catch (err: any) {
      console.error("Google auth error:", err);
      json(res, 500, { error: "Google login failed: " + (err?.message ?? "unknown") });
    }
    return;
  }

  // ── POST /api/ai/stream — streaming AI (SSE) ─────────────────────────────
  if (url === "/api/ai/stream" && req.method === "POST") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }

    try {
      const body = await readBody(req);
      const { systemPrompt, userMessage, model = "gpt-4o-mini" } = body ?? {};
      if (!userMessage) { json(res, 400, { error: "userMessage required" }); return; }

      const db = getDb();
      const { rows } = await db.query(
        "SELECT api_key_encrypted, api_key_iv, ai_usage_count FROM users WHERE id = $1", [user.sub]);
      await db.end();
      const row = rows[0];

      let apiKey: string;
      let usingOwnerKey = false;

      if (row?.api_key_encrypted && row?.api_key_iv) {
        apiKey = decrypt(row.api_key_encrypted as string, row.api_key_iv as string);
      } else {
        const usageCount = Number(row?.ai_usage_count ?? 0);
        if (usageCount >= FREE_LIMIT) {
          json(res, 402, { error: `You've used your ${FREE_LIMIT} free AI requests. Add your Gemini API key in Settings.` });
          return;
        }
        const ownerKey = process.env.OWNER_GEMINI_KEY ?? process.env.OWNER_OPENAI_KEY;
        if (!ownerKey) { json(res, 402, { error: "No API key configured." }); return; }
        apiKey = ownerKey;
        usingOwnerKey = true;
      }

      // SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", req.headers?.origin ?? "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.statusCode = 200;

      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
      const prompt = systemPrompt ? `${systemPrompt}\n\nUser: ${userMessage}` : userMessage;
      const streamResult = await geminiModel.generateContentStream(prompt);

      let fullContent = "";
      for await (const chunk of streamResult.stream) {
        const delta = chunk.text() ?? "";
        if (delta) {
          fullContent += delta;
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      }

      // Increment usage if using owner key
      if (usingOwnerKey) {
        const db2 = getDb();
        await db2.query("UPDATE users SET ai_usage_count = COALESCE(ai_usage_count,0)+1 WHERE id=$1", [user.sub]);
        await db2.end();
      }

      res.write(`data: ${JSON.stringify({ done: true })}

`);
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        if (err?.status === 401 || err?.message?.includes("API_KEY_INVALID")) { json(res, 401, { error: "Invalid Gemini API key." }); return; }
        if (err?.status === 429) { json(res, 429, { error: "Gemini rate limit." }); return; }
        json(res, 500, { error: err?.message ?? "Stream failed" });
      } else {
        res.write(`data: ${JSON.stringify({ error: err?.message ?? "Stream error" })}

`);
        res.end();
      }
    }
    return;
  }

  // ── POST /api/drive/connect — exchange auth code for refresh token ──────────
  if (url === "/api/drive/connect" && req.method === "POST") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }
    try {
      const { code, redirectUri } = await readBody(req);
      if (!code) { json(res, 400, { error: "code required" }); return; }
      const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
      // Exchange auth code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }).toString(),
      });
      const tokens = await tokenRes.json() as { access_token?: string; refresh_token?: string; error?: string };
      if (tokens.error || !tokens.refresh_token) {
        json(res, 400, { error: tokens.error ?? "No refresh token returned. Ensure access_type=offline." });
        return;
      }
      const db = getDb();
      await db.query("UPDATE users SET google_refresh_token = $1 WHERE id = $2", [tokens.refresh_token, user.sub]);
      await db.end();
      json(res, 200, { ok: true, accessToken: tokens.access_token });
    } catch (err: any) {
      json(res, 500, { error: err?.message ?? "Failed to connect Drive" });
    }
    return;
  }

  // ── GET /api/drive/token — get fresh access token using stored refresh token ─
  if (url === "/api/drive/token") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }
    try {
      const db = getDb();
      const { rows } = await db.query("SELECT google_refresh_token FROM users WHERE id = $1", [user.sub]);
      await db.end();
      const refreshToken = rows[0]?.google_refresh_token as string | null;
      if (!refreshToken) { json(res, 404, { error: "No Google Drive connection. Please connect first." }); return; }
      const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }).toString(),
      });
      const data = await tokenRes.json() as { access_token?: string; error?: string };
      if (data.error || !data.access_token) { json(res, 401, { error: "Drive token refresh failed. Reconnect Google Drive." }); return; }
      json(res, 200, { accessToken: data.access_token });
    } catch (err: any) {
      json(res, 500, { error: err?.message ?? "Token refresh failed" });
    }
    return;
  }

  // ── DELETE /api/drive/disconnect — remove stored refresh token ───────────────
  if (url === "/api/drive/disconnect" && req.method === "DELETE") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }
    try {
      const db = getDb();
      await db.query("UPDATE users SET google_refresh_token = NULL WHERE id = $1", [user.sub]);
      await db.end();
      json(res, 200, { ok: true });
    } catch (err: any) {
      json(res, 500, { error: err?.message ?? "Failed to disconnect" });
    }
    return;
  }


  // ── GET /api/user-data — load all user app data from DB ──────────────────
  if (url === "/api/user-data" && req.method === "GET") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }
    try {
      const db = getDb();
      await ensureUserDataTable(db);
      const { rows } = await db.query("SELECT * FROM user_data WHERE user_id = $1", [user.sub]);
      await db.end();
      if (rows.length === 0) {
        json(res, 200, { exists: false, data: null });
      } else {
        json(res, 200, { exists: true, data: rows[0] });
      }
    } catch (err: any) {
      json(res, 500, { error: err?.message ?? "Failed to load data" });
    }
    return;
  }

  // ── POST /api/user-data — upsert all user app data ────────────────────────
  if (url === "/api/user-data" && req.method === "POST") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }
    try {
      const body = await readBody(req);
      const db = getDb();
      await ensureUserDataTable(db);
      await db.query(`
        INSERT INTO user_data (
          user_id, tasks, brain_dump, focus_sessions, daily_logs,
          quick_chips, quadrant_map, quadrant_task_order, calendar_day_order,
          deleted_categories, display_name, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          tasks = EXCLUDED.tasks,
          brain_dump = EXCLUDED.brain_dump,
          focus_sessions = EXCLUDED.focus_sessions,
          daily_logs = EXCLUDED.daily_logs,
          quick_chips = EXCLUDED.quick_chips,
          quadrant_map = EXCLUDED.quadrant_map,
          quadrant_task_order = EXCLUDED.quadrant_task_order,
          calendar_day_order = EXCLUDED.calendar_day_order,
          deleted_categories = EXCLUDED.deleted_categories,
          display_name = EXCLUDED.display_name,
          updated_at = NOW()
      `, [
        user.sub,
        JSON.stringify(body.tasks ?? []),
        JSON.stringify(body.brain_dump ?? []),
        JSON.stringify(body.focus_sessions ?? {}),
        JSON.stringify(body.daily_logs ?? {}),
        JSON.stringify(body.quick_chips ?? []),
        JSON.stringify(body.quadrant_map ?? {}),
        JSON.stringify(body.quadrant_task_order ?? {}),
        JSON.stringify(body.calendar_day_order ?? {}),
        JSON.stringify(body.deleted_categories ?? []),
        body.display_name ?? null,
      ]);
      await db.end();
      json(res, 200, { ok: true });
    } catch (err: any) {
      json(res, 500, { error: err?.message ?? "Failed to save data" });
    }
    return;
  }

  // ── PATCH /api/user-data — partial update (single field) ─────────────────
  if (url === "/api/user-data" && req.method === "PATCH") {
    const user = await getUser(req);
    if (!user) { json(res, 401, { error: "Not authenticated" }); return; }
    try {
      const body = await readBody(req);
      const { field, value } = body;
      const ALLOWED = ["tasks","brain_dump","focus_sessions","daily_logs","quick_chips",
        "quadrant_map","quadrant_task_order","calendar_day_order","deleted_categories","display_name"];
      if (!field || !ALLOWED.includes(field)) {
        json(res, 400, { error: `Invalid field: ${field}` }); return;
      }
      const db = getDb();
      await ensureUserDataTable(db);
      await db.query(
        "INSERT INTO user_data (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
        [user.sub]
      );
      const isJson = field !== "display_name";
      const val = isJson ? JSON.stringify(value) : value;
      await db.query(
        `UPDATE user_data SET ${field} = $1, updated_at = NOW() WHERE user_id = $2`,
        [val, user.sub]
      );
      await db.end();
      json(res, 200, { ok: true });
    } catch (err: any) {
      json(res, 500, { error: err?.message ?? "Failed to update" });
    }
    return;
  }

  // 404
  json(res, 404, { error: "Not found" });
}
