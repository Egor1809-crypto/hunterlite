"use client";

// Shared autoplay-unlock overlay for both call and chat modes.
//
// Browsers (Chrome strict, Safari, iOS Safari especially) block
// HTMLAudioElement.play() outside a user gesture. The original click
// that routed into a session counts as a gesture, but by the time the
// WebSocket finishes auth and the first TTS chunk arrives the
// activation may have expired — at that point play() rejects with
// NotAllowedError and useTTS sets `needsAudioUnlock = true`.
//
// Previously this overlay lived inline in `/call/page.tsx` only. The
// chat page (/training/[id]/page.tsx) wires `useTTS` for the same
// audio pipeline but did NOT render an unlock surface — so on chat
// the user just heard nothing and reported "ошибка ТТС". Extracting
// this component fixes that and ensures both surfaces stay in sync
// (copy / styling / a11y).

import { Volume2 } from "lucide-react";

interface TTSUnlockOverlayProps {
  visible: boolean;
  onUnlock: () => void;
}

export function TTSUnlockOverlay({ visible, onUnlock }: TTSUnlockOverlayProps) {
  if (!visible) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ background: "var(--overlay-bg)" }}
      onClick={onUnlock}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onUnlock();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Включить звук"
    >
      <div
        className="flex max-w-sm flex-col items-center gap-4 px-8 py-10 text-center"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-2xl)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--accent-muted)" }}
          aria-hidden="true"
        >
          <Volume2 size={26} style={{ color: "var(--accent)" }} />
        </div>
        <div className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Включите звук
        </div>
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Браузер заблокировал автозапуск. Нажмите в любом месте — голос клиента
          зазвучит сразу.
        </div>
      </div>
    </div>
  );
}
