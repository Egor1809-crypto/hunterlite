import { useEffect, useRef, useCallback, useState } from "react";
import { api } from "@/lib/api";

interface TrainingMapData {
  test_map: Record<string, unknown>;
  exams: Record<string, unknown>;
  cases: Record<string, unknown>;
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

export function useTrainingMapSync() {
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current) return;
    synced.current = true;

    (async () => {
      try {
        const remote = await api.get<TrainingMapData>("/training-map/progress");
        const hasRemote =
          Object.keys(remote.test_map).length > 0 ||
          Object.keys(remote.exams).length > 0 ||
          Object.keys(remote.cases).length > 0;

        if (hasRemote) {
          if (Object.keys(remote.test_map).length > 0) writeLS(LS_TEST_MAP, remote.test_map);
          if (Object.keys(remote.exams).length > 0) writeLS(LS_EXAMS, remote.exams);
          if (Object.keys(remote.cases).length > 0) writeLS(LS_CASES, remote.cases);
        } else {
          const local: Partial<TrainingMapData> = {};
          const tm = readLS(LS_TEST_MAP);
          if (tm) local.test_map = tm as Record<string, unknown>;
          const ex = readLS(LS_EXAMS);
          if (ex) local.exams = ex as Record<string, unknown>;
          const cs = readLS(LS_CASES);
          if (cs) local.cases = cs as Record<string, unknown>;

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
