import { useEffect, useRef, useCallback, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

interface TrainingMapData {
  test_map: unknown;
  exams: unknown;
  cases: unknown;
}

// Base names; the real localStorage keys are namespaced per user id (see
// keyFor) so progress never leaks between accounts on the same browser.
const LS_TEST_MAP = "hunterlite_test_map_progress";
const LS_EXAMS = "hunterlite_exam_progress";
const LS_CASES = "hunterlite_case_progress";

function keyFor(base: string, userId: string | null): string {
  return userId ? `${base}:${userId}` : base;
}

function readLS(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLS(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded — ignore */ }
}

function hasProgress(value: unknown) {
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).length > 0;
}

export function useTrainingMapSync() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    // Re-sync whenever the logged-in user changes so account B never reads
    // account A's mirrored cache.
    if (syncedFor.current === userId) return;
    syncedFor.current = userId;

    (async () => {
      try {
        const remote = await api.get<TrainingMapData>("/training-map/progress");
        const hasRemote =
          hasProgress(remote.test_map) ||
          hasProgress(remote.exams) ||
          hasProgress(remote.cases);

        if (hasRemote) {
          if (hasProgress(remote.test_map)) writeLS(keyFor(LS_TEST_MAP, userId), remote.test_map);
          if (hasProgress(remote.exams)) writeLS(keyFor(LS_EXAMS, userId), remote.exams);
          if (hasProgress(remote.cases)) writeLS(keyFor(LS_CASES, userId), remote.cases);
        } else {
          const local: Partial<TrainingMapData> = {};
          const tm = readLS(keyFor(LS_TEST_MAP, userId));
          if (tm) local.test_map = tm;
          const ex = readLS(keyFor(LS_EXAMS, userId));
          if (ex) local.exams = ex;
          const cs = readLS(keyFor(LS_CASES, userId));
          if (cs) local.cases = cs;

          if (Object.keys(local).length > 0) {
            await api.put("/training-map/progress", local);
          }
        }
      } catch {
        /* offline or not authenticated — localStorage only */
      }
    })();
  }, [userId]);
}

export function useSaveTestMapProgress() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback((states: unknown) => {
    writeLS(keyFor(LS_TEST_MAP, userId), states);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.put("/training-map/progress", { test_map: states }).catch(() => {});
    }, 2000);
  }, [userId]);
}

export function useSaveExamProgress() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useCallback((examId: string, data: Record<string, unknown>) => {
    const stored = readLS(keyFor(LS_EXAMS, userId)) as Record<string, unknown> | null;
    const progress = stored ?? {};
    progress[examId] = data;
    writeLS(keyFor(LS_EXAMS, userId), progress);
    api.put("/training-map/progress", { exams: progress }).catch(() => {});
  }, [userId]);
}

export function useSaveCaseProgress() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useCallback((caseId: string, data: Record<string, unknown>) => {
    const stored = readLS(keyFor(LS_CASES, userId)) as Record<string, unknown> | null;
    const progress = stored ?? {};
    progress[caseId] = data;
    writeLS(keyFor(LS_CASES, userId), progress);
    api.put("/training-map/progress", { cases: progress }).catch(() => {});
  }, [userId]);
}
