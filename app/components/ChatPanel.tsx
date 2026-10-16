"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_MESSAGE_CHARS } from "@/lib/webrtc";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
  onBlock,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
  onBlock: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (connected) inputRef.current?.focus();
  }, [connected]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  return (
    <section
      aria-label="Chat with a stranger"
      className="glass rise absolute inset-x-3 bottom-3 z-20 flex max-h-[78dvh] min-h-[55dvh] flex-col overflow-hidden rounded-3xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-5 sm:max-h-none sm:min-h-0 sm:w-[24rem]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            {connected && (
              <span
                className="absolute inset-0 rounded-full bg-lagoon"
                style={{ animation: "ring 2s ease-out infinite" }}
              />
            )}
            <span
              className={`relative h-2.5 w-2.5 rounded-full ${
                connected ? "bg-lagoon" : "bg-sodium"
              }`}
            />
          </span>
          <div>
            <h2 className="font-display text-2xl leading-none">A stranger</h2>
            <p className="mt-1 text-xs text-muted">
              {connected ? "Connected, just the two of you" : "Connecting…"}
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-2">
          <button
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            className="btn btn-ghost px-3.5 py-2"
            aria-label="Ask to start a video call"
          >
            <VideoIcon /> Video
          </button>
          <button
            onClick={() => {
              setMenuOpen((o) => !o);
              setConfirmBlock(false);
            }}
            className="btn btn-ghost h-9 w-9 !p-0"
            aria-label="More options"
            aria-expanded={menuOpen}
          >
            <span aria-hidden>⋯</span>
          </button>
          {menuOpen && (
            <div className="glass rise absolute right-0 top-11 z-10 w-56 rounded-2xl p-2">
              {!confirmBlock ? (
                <>
                  <button
                    onClick={onEnd}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/10"
                  >
                    End conversation
                  </button>
                  <button
                    onClick={() => setConfirmBlock(true)}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose hover:bg-white/10"
                  >
                    Block this person…
                  </button>
                </>
              ) : (
                <div className="p-2 text-sm">
                  <p className="leading-relaxed text-muted">
                    Ends the chat and hides you from each other for the rest of
                    this session.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setConfirmBlock(false)}
                      className="btn btn-ghost flex-1 py-2"
                    >
                      Cancel
                    </button>
                    <button onClick={onBlock} className="btn btn-danger flex-1 py-2">
                      Block
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div
        className="flex-1 space-y-2 overflow-y-auto px-5 py-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 && (
          <p className="mt-10 text-balance text-center text-sm leading-relaxed text-muted">
            Say hello. What you write goes straight to them and is gone when
            either of you leaves.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.mine
                  ? "rounded-br-md bg-sodium text-[#2a1a00]"
                  : "rounded-bl-md bg-white/10 text-text"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder={connected ? "Write a message" : "Connecting…"}
          disabled={!connected}
          aria-label="Message"
          className="flex-1 rounded-full bg-white/[0.07] px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:bg-white/10 focus:ring-1 focus:ring-sodium disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          className="btn btn-primary"
        >
          Send
        </button>
      </form>
    </section>
  );
}

function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="6" width="13" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M15 10.5 21 7v10l-6-3.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
