import { prisma } from "@/lib/prisma";
import { freePair } from "@/lib/pairing";
import { guarded, json, readJson } from "@/lib/server/http";
import { hashToken, isValidPublicId, isValidToken } from "@/lib/server/auth";
import type { SignalType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: readonly SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

const MAX_PAYLOAD = 32 * 1024; // SDP/ICE are a few KB; cap well above that.
const MAX_BODY = MAX_PAYLOAD + 1024;
const MAX_MAILBOX = 200; // undelivered signals one recipient may accumulate

// Payloads are only meaningful for the WebRTC handshake. Validate their shape
// so the server never relays arbitrary blobs between strangers.
function validPayload(type: SignalType, payload: unknown): boolean {
  if (type === "offer" || type === "answer" || type === "ice") {
    if (typeof payload !== "string" || payload.length > MAX_PAYLOAD) {
      return false;
    }
    try {
      const data = JSON.parse(payload) as Record<string, unknown> | null;
      if (!data || typeof data !== "object") return false;
      return type === "ice"
        ? typeof data.candidate === "string"
        : data.type === type && typeof data.sdp === "string";
    } catch {
      return false;
    }
  }
  // request/accept/decline/end carry no payload.
  return payload === undefined || payload === null;
}

// POST /api/signal — body { token, toId, type, payload? }
// Authenticated by the caller's secret token (the sender identity comes from
// the token, never from the body, so nobody can impersonate another user).
// Also enforces the connection state machine server-side:
//   request  → only when both are free; records an outstanding request
//   accept   → only answers a real outstanding request; pairs both sessions
//   decline  → only answers a real outstanding request
//   offer/answer/ice → only between paired sessions
//   end      → hangs up a pairing or cancels a request
export const POST = guarded("signal", 300, 60_000, async (request) => {
  const body = await readJson(request, MAX_BODY);
  if (!body) return json({ error: "invalid body" }, 400);

  const { token, toId, type, payload } = body;
  if (!isValidToken(token)) return json({ error: "invalid token" }, 401);
  if (!isValidPublicId(toId)) return json({ error: "invalid recipient" }, 400);
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return json({ error: "invalid type" }, 400);
  }
  const signalType = type as SignalType;
  if (!validPayload(signalType, payload)) {
    return json({ error: "invalid payload" }, 400);
  }

  const me = await prisma.presence.findUnique({
    where: { id: hashToken(token) },
  });
  if (!me) return json({ error: "not online" }, 401);
  if (me.pub === toId) return json({ error: "invalid recipient" }, 400);

  const target = await prisma.presence.findUnique({ where: { pub: toId } });

  const deliver = async () => {
    // Bound the mailbox so a flood can't pile up unread rows for one user.
    const queued = await prisma.signal.count({ where: { toPub: toId } });
    if (queued >= MAX_MAILBOX) return false;
    await prisma.signal.create({
      data: {
        fromPub: me.pub,
        toPub: toId,
        type: signalType,
        payload: typeof payload === "string" ? payload : null,
      },
    });
    return true;
  };

  const autoDecline = async () => {
    // Tell the initiator the request can't go through (target gone or busy).
    await prisma.signal.create({
      data: { fromPub: toId, toPub: me.pub, type: "decline", payload: null },
    });
    return json({ ok: true, autoDeclined: true });
  };

  switch (signalType) {
    case "request": {
      // "One active connection at a time": a busy sender can't start another,
      // and a busy/offline target auto-declines instead of being disturbed.
      if (me.busy) return json({ error: "already connected" }, 409);
      if (!target || target.busy) return autoDecline();
      // Blocked either way: look like an ordinary decline, reveal nothing.
      const blocked = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerPub: toId, blockedPub: me.pub },
            { blockerPub: me.pub, blockedPub: toId },
          ],
        },
        select: { id: true },
      });
      if (blocked) return autoDecline();
      await prisma.presence.update({
        where: { id: me.id },
        data: { pendingPub: toId },
      });
      break;
    }

    case "accept": {
      // Only valid as the answer to a request the other side really made.
      if (!target || target.pendingPub !== me.pub || me.busy || target.busy) {
        return json({ error: "no pending request" }, 409);
      }
      await prisma.presence.update({
        where: { id: me.id },
        data: { busy: true, peerPub: toId, pendingPub: null },
      });
      await prisma.presence.update({
        where: { id: target.id },
        data: { busy: true, peerPub: me.pub, pendingPub: null },
      });
      break;
    }

    case "decline": {
      if (!target || target.pendingPub !== me.pub) {
        return json({ error: "no pending request" }, 409);
      }
      await prisma.presence.update({
        where: { id: target.id },
        data: { pendingPub: null },
      });
      break;
    }

    case "offer":
    case "answer":
    case "ice": {
      // WebRTC handshake traffic only flows between paired sessions.
      if (!target || me.peerPub !== toId || target.peerPub !== me.pub) {
        return json({ error: "not connected" }, 403);
      }
      break;
    }

    case "end": {
      if (me.peerPub === toId) {
        await freePair(me.pub, toId);
      } else if (me.pendingPub === toId) {
        await prisma.presence.update({
          where: { id: me.id },
          data: { pendingPub: null },
        });
      } else {
        // Not paired and no outstanding request: nothing to end, nothing to relay.
        return json({ ok: true });
      }
      break;
    }
  }

  if (!target) return json({ ok: true });
  const delivered = await deliver();
  if (!delivered) return json({ error: "recipient mailbox full" }, 429);
  return json({ ok: true });
});
