"use client";

/**
 * Видимость плавающего помощника «Маняша».
 *
 * Хранится локально (per-device) — это UI-предпочтение, не серверное состояние:
 * пользователь может скрыть маскот на своём устройстве из /settings, и виджет
 * мгновенно исчезнет на всех вкладках (через `storage` + кастом-событие).
 */

import { useCallback, useEffect, useState } from "react";

export const ASSISTANT_HIDDEN_KEY = "manyasha.hidden";
export const ASSISTANT_EVENT = "hunterlite:assistant-visibility";

export function getAssistantHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ASSISTANT_HIDDEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAssistantHidden(hidden: boolean): void {
  try {
    localStorage.setItem(ASSISTANT_HIDDEN_KEY, String(hidden));
  } catch {
    /* localStorage unavailable */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ASSISTANT_EVENT));
  }
}

/** Реактивный хук: [скрыт, setСкрыт]. Слушает изменения из других вкладок. */
export function useAssistantHidden(): [boolean, (hidden: boolean) => void] {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(getAssistantHidden());
    const sync = () => setHidden(getAssistantHidden());
    window.addEventListener(ASSISTANT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ASSISTANT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const set = useCallback((next: boolean) => {
    setAssistantHidden(next);
    setHidden(next);
  }, []);

  return [hidden, set];
}
