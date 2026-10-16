import { createHash, randomUUID } from "node:crypto";

// The client generates a random UUID as its secret session token. It is the
// only credential for poll/signal/leave, so it must never be shown to other
// users (peers only ever see the separate, server-issued `pub` handle).
const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

// Only a hash of the token is stored, so a database leak can't be replayed
// as live sessions.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newPublicId(): string {
  return randomUUID();
}

export function isValidPublicId(id: unknown): id is string {
  return typeof id === "string" && TOKEN_RE.test(id);
}
