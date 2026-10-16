"use client";

import { useEffect, useRef, useState } from "react";

// Safety by default: the stranger's video starts blurred. Nothing unexpected
// is ever shown without the viewer choosing to reveal it, and they can hide it
// again instantly. The blur is purely local (CSS) — it costs nothing and the
// server never sees video anyway.
export default function VideoPanel({
  localStream,
  remoteStream,
  onToggleMic,
  onToggleCam,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onToggleMic: (enabled: boolean) => void;
  onToggleCam: (enabled: boolean) => void;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-ink">
      <div className="relative flex-1 overflow-hidden">
        {/* Remote (full screen) */}
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          aria-label="Stranger's video"
          className={`h-full w-full bg-dusk object-cover transition-[filter] duration-500 ${
            revealed ? "" : "scale-110 blur-3xl"
          }`}
        />

        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            Waiting for their video…
          </div>
        )}

        {remoteStream && !revealed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="font-display text-3xl">Video is blurred</p>
            <p className="max-w-xs text-sm leading-relaxed text-text/80">
              You decide when to see them. You can blur it again at any time.
            </p>
            <button onClick={() => setRevealed(true)} className="btn btn-primary">
              Show video
            </button>
          </div>
        )}

        {remoteStream && revealed && (
          <button
            onClick={() => setRevealed(false)}
            className="btn btn-ghost absolute left-4 top-4 bg-ink/60 backdrop-blur"
          >
            Blur video
          </button>
        )}

        {/* Local (picture-in-picture) */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          aria-label="Your video"
          className={`absolute bottom-4 right-4 h-40 w-28 rounded-2xl border border-line bg-dusk object-cover shadow-xl sm:h-48 sm:w-36 ${
            camOn ? "" : "opacity-30"
          }`}
          style={{ transform: "scaleX(-1)" }}
        />
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-line bg-ink p-4">
        <button
          onClick={() => {
            onToggleMic(!micOn);
            setMicOn(!micOn);
          }}
          aria-pressed={!micOn}
          className={`btn ${micOn ? "btn-ghost" : "btn-primary"}`}
        >
          {micOn ? "Mute" : "Unmute"}
        </button>
        <button
          onClick={() => {
            onToggleCam(!camOn);
            setCamOn(!camOn);
          }}
          aria-pressed={!camOn}
          className={`btn ${camOn ? "btn-ghost" : "btn-primary"}`}
        >
          {camOn ? "Camera off" : "Camera on"}
        </button>
        <button onClick={onEnd} className="btn btn-danger">
          End video
        </button>
      </div>
    </div>
  );
}
