import { prisma } from "@/lib/prisma";

// Clear the busy/peer state of two sessions, but only if they are actually
// paired with each other (each side's peerId must point back at the other).
export async function freePair(a: string, b: string): Promise<void> {
  await prisma.presence.updateMany({
    where: { id: a, peerId: b },
    data: { busy: false, peerId: null },
  });
  await prisma.presence.updateMany({
    where: { id: b, peerId: a },
    data: { busy: false, peerId: null },
  });
}

// When a session leaves/expires, release whoever it was paired with so they
// don't stay marked busy (and greyed out on the map) forever.
export async function releasePeersOf(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.presence.updateMany({
    where: { peerId: { in: ids } },
    data: { busy: false, peerId: null },
  });
}
