import { useEffect, useRef, useCallback, useState } from "react";
import { api } from "@/lib/api";

interface TrainingMapData {
  test_map: unknown;
  exams: unknown;
  cases: unknown;
}

const LS_TEST_MAP = "hunterlite_test_map_progress";
const LS_EXAMS = "hunterlite_exam_progress";
const LS_CASES = "hunterlite_case_progress";

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
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;

    (async () => {
      try {
        const remote = await api.get<TrainingMapData>("/training-map/progress");
        const hasRemote =
          hasProgress(remote.test_map) ||
          hasProgress(remote.exams) ||
          hasProgress(remote.cases);

        if (hasRemote) {
          if (hasProgress(remote.test_map)) writeLS(LS_TEST_MAP, remote.test_map);
          if (hasProgress(remote.exams)) writeLS(LS_EXAMS, remote.exams);
          if (hasProgress(remote.cases)) writeLS(LS_CASES, remote.cases);
        } else {
          const local: Partial<TrainingMapData> = {};
          const tm = readLS(LS_TEST_MAP);
          if (tm) local.test_map = tm;
          const ex = readLS(LS_EXAMS);
          if (ex) local.exams = ex;
          const cs = readLS(LS_CASES);
          if (cs) local.cases = cs;

          if (Object.keys(local).length > 0) {
            await api.put("/training-map/progress", local);
          }
        }
      } catch {
        /* offline or not authenticated — localStorage only */
      }
    })();
  }, []);
}

export function useSaveTestMapProgress() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback((states: unknown) => {
    writeLS(LS_TEST_MAP, states);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.put("/training-map/progress", { test_map: states }).catch(() => {});
    }, 2000);
  }, []);
}

export function useSaveExamProgress() {
  return useCallback((examId: string, data: Record<string, unknown>) => {
    const stored = readLS(LS_EXAMS) as Record<string, unknown> | null;
    const progress = stored ?? {};
    progress[examId] = data;
    writeLS(LS_EXAMS, progress);
    api.put("/training-map/progress", { exams: progress }).catch(() => {});
  }, []);
}

export function useSaveCaseProgress() {
  return useCallback((caseId: string, data: Record<string, unknown>) => {
    const stored = readLS(LS_CASES) as Record<string, unknown> | null;
    const progress = stored ?? {};
    progress[caseId] = data;
    writeLS(LS_CASES, progress);
    api.put("/training-map/progress", { cases: progress }).catch(() => {});
  }, []);
}
