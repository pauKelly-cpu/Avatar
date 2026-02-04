import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  const derived = scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, "hex");
  return timingSafeEqual(derived, storedBuf);
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export function newCode(): string {
  return randomBytes(20).toString("hex");
}
