import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import { guarded, json, readJson } from "@/lib/server/http";
import { hashToken, isValidToken, newPublicId } from "@/lib/server/auth";
import type { JoinResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { token, lat, lng } (raw coords).
// Applies a 1–3 km privacy offset server-side and creates the presence row.
// Raw coordinates are never stored. The offset position is returned so the
// client can show "you" exactly where everyone else sees you.
export const POST = guarded("join", 20, 60_000, async (request) => {
  const body = await readJson(request, 1024);
  if (!body) return json({ error: "invalid body" }, 400);

  const { token, lat, lng } = body;
  if (!isValidToken(token)) return json({ error: "invalid token" }, 400);
  if (!isValidLatLng(lat, lng)) {
    return json({ error: "invalid coordinates" }, 400);
  }

  const id = hashToken(token);
  const now = new Date();

  // Re-joining an existing session must NOT re-roll the offset: repeated joins
  // with the same real coordinates would otherwise let anyone average the
  // random offsets back out to the true location. Just refresh the heartbeat.
  const existing = await prisma.presence.findUnique({ where: { id } });
  if (existing) {
    await prisma.presence.update({ where: { id }, data: { lastSeen: now } });
    return json({
      id: existing.pub,
      lat: existing.lat,
      lng: existing.lng,
    } satisfies JoinResponse);
  }

  const offset = applyPrivacyOffset(lat as number, lng as number);
  const created = await prisma.presence.create({
    data: {
      id,
      pub: newPublicId(),
      lat: offset.lat,
      lng: offset.lng,
      lastSeen: now,
    },
  });

  return json({
    id: created.pub,
    lat: created.lat,
    lng: created.lng,
  } satisfies JoinResponse);
});
