// Client-side helpers for talking to the coordination API.
//
// `token` is this tab's secret session token — it authenticates every call and
// is never shared with other users. Peers are addressed by their public id.
import type { JoinResponse, PollResponse, SignalType } from "@/lib/types";

export async function join(
  token: string,
  lat: number,
  lng: number,
): Promise<JoinResponse> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, lat, lng }),
  });
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
  return res.json();
}

export async function poll(token: string): Promise<PollResponse> {
  const res = await fetch("/api/poll", {
    cache: "no-store",
    headers: { "x-pulse-token": token },
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  token: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<boolean> {
  try {
    const res = await fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, toId, type, payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Fire-and-forget leave that survives the tab closing.
export function leave(token: string): void {
  const body = JSON.stringify({ token });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/leave", body);
  } else {
    void fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}
