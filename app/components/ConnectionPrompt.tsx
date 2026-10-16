"use client";

import { useEffect } from "react";

// Reusable centered prompt for "someone wants to connect" and
// "someone wants to start video". Escape declines.
export default function ConnectionPrompt({
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDecline();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDecline]);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/60 p-6 backdrop-blur-[3px]">
      <div
        role="alertdialog"
        aria-labelledby="prompt-title"
        className="glass rise relative w-full max-w-sm rounded-3xl p-7 text-center"
      >
        {/* A light calling out from the dark */}
        <div className="relative mx-auto mb-5 h-4 w-4">
          {[0, 0.6, 1.2].map((delay) => (
            <span
              key={delay}
              className="absolute inset-0 rounded-full border border-sodium"
              style={{ animation: `ring 2.4s ease-out ${delay}s infinite` }}
            />
          ))}
          <span className="absolute inset-0 rounded-full bg-sodium shadow-[0_0_24px_6px_rgba(255,196,107,0.55)]" />
        </div>
        <h2 id="prompt-title" className="font-display text-3xl leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={onDecline} className="btn btn-ghost flex-1">
            {declineLabel}
          </button>
          <button onClick={onAccept} className="btn btn-primary flex-1" autoFocus>
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
