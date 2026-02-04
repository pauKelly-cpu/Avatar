import { open } from "sqlite";
import sqlite3 from "sqlite3";

export const dbPromise = open({
  filename: "data.sqlite",
  driver: sqlite3.Database,
});

export async function initDb() {
  const db = await dbPromise;

  await db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS avatars (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      height_cm INTEGER,
      chest_cm INTEGER,
      waist_cm INTEGER,
      hips_cm INTEGER,
      fit_pref TEXT DEFAULT 'regular',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS one_time_codes (
      code TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  return db;
}
