import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import { z } from "zod";
import { initDb } from "./db";
import { hashPassword, verifyPassword, newId, newCode } from "./crypto";

const app = Fastify({ logger: true });

type JwtPayload = { userId: string };
let db: Awaited<ReturnType<typeof initDb>>;

app.decorate("authenticate", async (req: any, reply: any) => {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
});

app.get("/health", async () => ({ ok: true }));

// AUTH
app.post("/auth/signup", async (req, reply) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(6),
    })
    .parse(req.body);

  const userId = newId("usr");
  const now = Date.now();
  const passwordHash = hashPassword(body.password);

  try {
    await db.run(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      userId,
      body.email.toLowerCase(),
      passwordHash,
      now,
    );
  } catch (e: any) {
    if (
      String(e?.message || "")
        .toLowerCase()
        .includes("unique")
    ) {
      return reply.code(409).send({ error: "Email already exists" });
    }
    req.log.error(e);
    return reply.code(500).send({ error: "Server error" });
  }

  const avatarId = newId("avt");
  await db.run(
    "INSERT INTO avatars (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
    avatarId,
    userId,
    now,
    now,
  );

  const token = app.jwt.sign({ userId } satisfies JwtPayload);
  return { token };
});

app.post("/auth/login", async (req, reply) => {
  const body = z
    .object({
      email: z.string().email(),
      password: z.string().min(1),
    })
    .parse(req.body);

  const row = await db.get<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = ?",
    body.email.toLowerCase(),
  );

  if (!row) return reply.code(401).send({ error: "Invalid credentials" });

  const ok = verifyPassword(body.password, row.password_hash);
  if (!ok) return reply.code(401).send({ error: "Invalid credentials" });

  const token = app.jwt.sign({ userId: row.id } satisfies JwtPayload);
  return { token };
});

app.get("/me", { preHandler: (app as any).authenticate }, async (req: any) => {
  const userId = (req.user as any).userId as string;

  const user = await db.get(
    "SELECT id, email, created_at FROM users WHERE id = ?",
    userId,
  );

  return { user };
});

// AVATAR
app.get(
  "/avatar",
  { preHandler: (app as any).authenticate },
  async (req: any) => {
    const userId = (req.user as any).userId as string;

    const avatar = await db.get(
      "SELECT id, height_cm, chest_cm, waist_cm, hips_cm, fit_pref, updated_at FROM avatars WHERE user_id = ?",
      userId,
    );

    return { avatar };
  },
);

app.post(
  "/avatar",
  { preHandler: (app as any).authenticate },
  async (req: any) => {
    const userId = (req.user as any).userId as string;

    const body = z
      .object({
        heightCm: z.number().int().min(50).max(250).nullable().optional(),
        chestCm: z.number().int().min(40).max(200).nullable().optional(),
        waistCm: z.number().int().min(40).max(200).nullable().optional(),
        hipsCm: z.number().int().min(40).max(200).nullable().optional(),
        fitPref: z.enum(["tight", "regular", "loose"]).optional(),
      })
      .parse(req.body);

    const now = Date.now();

    await db.run(
      `
    UPDATE avatars
    SET height_cm = COALESCE(?, height_cm),
        chest_cm  = COALESCE(?, chest_cm),
        waist_cm  = COALESCE(?, waist_cm),
        hips_cm   = COALESCE(?, hips_cm),
        fit_pref  = COALESCE(?, fit_pref),
        updated_at = ?
    WHERE user_id = ?
  `,
      body.heightCm ?? null,
      body.chestCm ?? null,
      body.waistCm ?? null,
      body.hipsCm ?? null,
      body.fitPref ?? null,
      now,
      userId,
    );

    return { ok: true };
  },
);

// ONE-TIME CODE (website -> extension)
app.post(
  "/auth/create-one-time-code",
  { preHandler: (app as any).authenticate },
  async (req: any) => {
    const userId = (req.user as any).userId as string;

    const code = newCode();
    const now = Date.now();
    const expiresAt = now + 60_000;

    await db.run(
      "INSERT INTO one_time_codes (code, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      code,
      userId,
      expiresAt,
      now,
    );

    return { code, expiresAt };
  },
);

app.post("/auth/exchange-code", async (req, reply) => {
  const body = z.object({ code: z.string().min(10) }).parse(req.body);

  const row = await db.get<{ user_id: string; expires_at: number }>(
    "SELECT user_id, expires_at FROM one_time_codes WHERE code = ?",
    body.code,
  );

  if (!row) return reply.code(400).send({ error: "Invalid code" });

  if (Date.now() > row.expires_at) {
    await db.run("DELETE FROM one_time_codes WHERE code = ?", body.code);
    return reply.code(400).send({ error: "Code expired" });
  }

  await db.run("DELETE FROM one_time_codes WHERE code = ?", body.code);

  const token = app.jwt.sign({ userId: row.user_id } satisfies JwtPayload);
  return { token };
});

async function start() {
  db = await initDb();

  await app.register(helmet);
  await app.register(cors, {
    origin: ["http://localhost:3000"],
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "dev_secret_change_me",
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
