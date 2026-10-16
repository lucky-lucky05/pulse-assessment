"use client";

import { useState } from "react";

// Deterministic scatter (seeded) so server and client render the same field.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = ["#ffc46b", "#ffc46b", "#ffd9a0", "#ff9d5c", "#8fd3ff", "#5eead4"];
const FIELD = (() => {
  const rnd = mulberry32(7);
  return Array.from({ length: 70 }, () => ({
    x: rnd() * 100,
    y: rnd() * 100,
    s: 2 + rnd() * 4,
    t: 2.8 + rnd() * 4,
    d: -rnd() * 6,
    c: PALETTE[Math.floor(rnd() * PALETTE.length)],
  }));
})();

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => Promise<void> | void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "joining" | "error">(
    "idle",
  );
  const [error, setError] = useState<string>("");

  function fail(message: string) {
    setStatus("error");
    setError(message);
  }

  function enter() {
    if (!("geolocation" in navigator)) {
      fail("This browser can't share a location, so Pulse can't place you on the map.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStatus("joining");
        try {
          await onReady(pos.coords.latitude, pos.coords.longitude);
        } catch {
          fail("Couldn't reach Pulse. Check your connection and try again.");
        }
      },
      (err) =>
        fail(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked. Allow it in your browser's site settings, then try again. It's only used to place your light on the map."
            : "Couldn't find your location. Move somewhere with a better signal and try again.",
        ),
      // High accuracy + maximumAge:0 forces a fresh fix instead of reusing the
      // browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  const busy = status === "locating" || status === "joining";

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      {/* The night side of Earth: a field of breathing lights */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 110%, #1b2350 0%, #0d1226 45%, #080b14 80%)",
        }}
      >
        {FIELD.map((d, i) => (
          <span
            key={i}
            className="field-dot"
            style={
              {
                left: `${d.x}%`,
                top: `${d.y}%`,
                "--s": `${d.s}px`,
                "--t": `${d.t}s`,
                "--d": `${d.d}s`,
                "--c": d.c,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="rise relative z-10 flex max-w-xl flex-col items-center text-center">
        <h1 className="font-display text-7xl italic tracking-tight sm:text-8xl">
          Pulse
        </h1>
        <p className="mt-5 max-w-md text-balance text-lg leading-relaxed text-text/85">
          Every light on this map is a real person online right now. Tap one to
          say hello.
        </p>

        <button
          onClick={enter}
          disabled={busy}
          className="btn btn-primary mt-9 px-9 py-3.5 text-base shadow-[0_0_50px_-8px_var(--sodium)]"
        >
          {status === "locating"
            ? "Finding you…"
            : status === "joining"
              ? "Lighting you up…"
              : "Put me on the map"}
        </button>

        <p
          role="alert"
          className={`mt-5 max-w-sm text-sm leading-relaxed text-rose ${
            status === "error" ? "" : "invisible"
          }`}
        >
          {error || " "}
        </p>

        <ul className="mt-10 grid max-w-md gap-2 text-sm text-muted">
          <li>Your light appears 1–3 km from where you really are.</li>
          <li>No accounts. Chat and video go straight between you two.</li>
          <li>Close the tab and you were never here.</li>
        </ul>
      </div>
    </main>
  );
}
