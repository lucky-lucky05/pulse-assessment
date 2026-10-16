import { prisma } from "@/lib/prisma";
import { freePair } from "@/lib/pairing";
import { guarded, json, readJson } from "@/lib/server/http";
import { hashToken, isValidPublicId, isValidToken } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/block — body { token, targetId }.
// Blocks a stranger for the rest of this session: hangs up any call with them,
// notifies them it ended, and hides both dots from each other. Nothing is
// recorded about *why*; the block list dies with the session.
export const POST = guarded("block", 30, 60_000, async (request) => {
  const body = await readJson(request, 1024);
  if (!body) return json({ error: "invalid body" }, 400);

  const { token, targetId } = body;
  if (!isValidToken(token)) return json({ error: "invalid token" }, 401);
  if (!isValidPublicId(targetId)) return json({ error: "invalid target" }, 400);

  const me = await prisma.presence.findUnique({
    where: { id: hashToken(token) },
    select: { pub: true },
  });
  if (!me) return json({ error: "not online" }, 401);
  if (me.pub === targetId) return json({ error: "invalid target" }, 400);

  await prisma.block.upsert({
    where: {
      blockerPub_blockedPub: { blockerPub: me.pub, blockedPub: targetId },
    },
    create: { blockerPub: me.pub, blockedPub: targetId },
    update: {},
  });

  // If they were talking, hang up and let the other side know.
  const target = await prisma.presence.findUnique({
    where: { pub: targetId },
    select: { peerPub: true },
  });
  if (target?.peerPub === me.pub) {
    await freePair(me.pub, targetId);
    await prisma.signal.create({
      data: { fromPub: me.pub, toPub: targetId, type: "end" },
    });
  }

  return json({ ok: true });
});
