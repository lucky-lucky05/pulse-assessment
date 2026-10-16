import { prisma } from "@/lib/prisma";
import { releasePeersOf } from "@/lib/pairing";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import { guarded, json } from "@/lib/server/http";
import { hashToken, isValidToken } from "@/lib/server/auth";
import type { PollResponse, SignalType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upper bound on dots returned per poll, so one poll's payload stays bounded
// no matter how many sessions exist.
const MAX_PEERS = 1000;

// GET /api/poll — the single endpoint that drives the live map.
// The secret token travels in the `x-pulse-token` header (not the URL, which
// ends up in access logs and caches). It (1) heartbeats the caller, (2) reaps
// stale presence + orphan signals, (3) returns the filtered online peers, and
// (4) drains this user's mailbox.
export const GET = guarded("poll", 600, 60_000, async (request) => {
  const token = request.headers.get("x-pulse-token");
  if (!isValidToken(token)) return json({ error: "invalid token" }, 401);
  const id = hashToken(token);

  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);

  // 1) Heartbeat — refresh lastSeen for the caller ONLY. (Previously this
  // matched every row, so nobody ever went stale and dots never expired.)
  const { count } = await prisma.presence.updateMany({
    where: { id },
    data: { lastSeen: new Date(now) },
  });

  // 2) Reap stale presence rows (freeing anyone paired with them) and
  // orphaned signals. Independent deletes — no atomicity needed, and it avoids
  // transactions over a PgBouncer pooler.
  const stale = await prisma.presence.findMany({
    where: { lastSeen: { lt: staleCutoff } },
    select: { id: true, pub: true },
  });
  if (stale.length > 0) {
    await releasePeersOf(stale.map((s) => s.pub));
    await prisma.presence.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
  }
  await prisma.signal.deleteMany({ where: { createdAt: { lt: signalCutoff } } });

  const me = count > 0
    ? await prisma.presence.findUnique({
        where: { id },
        select: { pub: true },
      })
    : null;

  // 3) Online peers, excluding self.
  const peers = await prisma.presence.findMany({
    where: { id: { not: id }, lastSeen: { gte: staleCutoff } },
    select: { pub: true, lat: true, lng: true, busy: true },
    take: MAX_PEERS,
  });

  // 4) Drain this user's mailbox: read, then delete exactly what we read so a
  // concurrently-inserted signal is never lost. Ordered by the sequence
  // number so offer/ICE messages arrive in the order they were sent.
  const inbox = me
    ? await prisma.signal.findMany({
        where: { toPub: me.pub },
        orderBy: { seq: "asc" },
      })
    : [];
  if (inbox.length > 0) {
    await prisma.signal.deleteMany({
      where: { id: { in: inbox.map((s) => s.id) } },
    });
  }

  const response: PollResponse = {
    // false when our row was reaped/left (e.g. a backgrounded tab whose timers
    // were throttled) — the client re-joins so its dot comes back.
    online: me !== null,
    peers: peers.map((p) => ({
      id: p.pub,
      lat: p.lat,
      lng: p.lng,
      busy: p.busy,
    })),
    signals: inbox.map((s) => ({
      id: s.id,
      fromId: s.fromPub,
      toId: s.toPub,
      type: s.type as SignalType,
      payload: s.payload,
      createdAt: s.createdAt.toISOString(),
    })),
  };

  return json(response);
});
