import { prisma } from "@/lib/prisma";

// Clear the busy/peer state of two sessions, but only if they are actually
// paired with each other (each side's peerPub must point back at the other).
export async function freePair(a: string, b: string): Promise<void> {
  await prisma.presence.updateMany({
    where: { pub: a, peerPub: b },
    data: { busy: false, peerPub: null, pendingPub: null },
  });
  await prisma.presence.updateMany({
    where: { pub: b, peerPub: a },
    data: { busy: false, peerPub: null, pendingPub: null },
  });
}

// When sessions leave/expire, release whoever they were paired with so the
// survivor doesn't stay marked busy (greyed out on the map) forever.
export async function releasePeersOf(pubs: string[]): Promise<void> {
  if (pubs.length === 0) return;
  await prisma.presence.updateMany({
    where: { peerPub: { in: pubs } },
    data: { busy: false, peerPub: null, pendingPub: null },
  });
}
