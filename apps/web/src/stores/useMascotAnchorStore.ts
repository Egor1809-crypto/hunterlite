import { create } from "zustand";
import { useRef, useEffect } from "react";

/**
 * Stub replacement for the deleted mascot anchor store.
 */

export type MascotAnchorId = "duel" | "quiz_blitz" | "quiz_themed" | "quiz_free" | string;

interface MascotAnchorState {
  target: MascotAnchorId | null;
  anchors: Record<string, DOMRect | null>;
  setTarget: (id: MascotAnchorId | null) => void;
  setAnchorRect: (id: string, rect: DOMRect | null) => void;
}

export const useMascotAnchorStore = create<MascotAnchorState>((set) => ({
  target: null,
  anchors: {},
  setTarget: (id) => set({ target: id }),
  setAnchorRect: (id, rect) =>
    set((s) => ({ anchors: { ...s.anchors, [id]: rect } })),
}));

/** Hook that registers a DOM ref as a mascot anchor. Returns a ref compatible with any HTML element. */
export function useMascotAnchor(id: MascotAnchorId) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null);
  const setAnchorRect = useMascotAnchorStore((s) => s.setAnchorRect);

  useEffect(() => {
    if (!ref.current) return;
    const rect = (ref.current as HTMLElement).getBoundingClientRect();
    setAnchorRect(id, rect);
    return () => setAnchorRect(id, null);
  }, [id, setAnchorRect]);

  return ref;
}
