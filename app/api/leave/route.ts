import { prisma } from "@/lib/prisma";
import { releasePeersOf } from "@/lib/pairing";
import { guarded, json, readJson } from "@/lib/server/http";
import { hashToken, isValidToken } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { token }. Removes the caller's presence row and any
// pending signals to/from them. Called via navigator.sendBeacon on tab close,
// so the body arrives as text/plain (readJson parses text regardless of type).
// Requires the secret token: knowing someone's public id can't kick them off.
export const POST = guarded("leave", 60, 60_000, async (request) => {
  const body = await readJson(request, 1024);
  const token = body?.token;
  if (!isValidToken(token)) return json({ error: "invalid token" }, 400);

  const me = await prisma.presence.findUnique({
    where: { id: hashToken(token) },
    select: { pub: true },
  });
  if (!me) return json({ ok: true });

  // Independent cleanup deletes — no atomicity needed (and interactive
  // transactions are unreliable over a PgBouncer pooler).
  await prisma.signal.deleteMany({
    where: { OR: [{ toPub: me.pub }, { fromPub: me.pub }] },
  });
  await prisma.block.deleteMany({
    where: { OR: [{ blockerPub: me.pub }, { blockedPub: me.pub }] },
  });
  await releasePeersOf([me.pub]);
  await prisma.presence.deleteMany({ where: { id: hashToken(token) } });

  return json({ ok: true });
});
