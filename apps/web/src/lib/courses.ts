/**
 * Course progress + mini-check API types + fetch helpers.
 * Mirrors apps/api/app/api/courses.py.
 */
import { api } from "@/lib/api";

export interface LessonProgress {
  lesson_index: number;
  completed: boolean;
  attempts_used: number;
  locked: boolean;
  unlock_at: string | null; // ISO UTC when the lesson opens
}

export interface CourseProgress {
  course_slug: string;
  total_lessons: number;
  completed_lessons: number;
  percent: number;
  next_unlock_at: string | null;
  lessons: LessonProgress[];
}

export interface ProgressResponse {
  courses: CourseProgress[];
}

export interface QuizQuestion {
  q: string;
  options: string[];
}

export interface LessonQuiz {
  course_slug: string;
  lesson_index: number;
  questions: QuizQuestion[];
  completed: boolean;
  attempts_used: number;
  max_attempts: number;
}

export interface QuizSubmitResult {
  passed: boolean;
  completed: boolean;
  attempts_used: number;
  attempts_left: number;
  max_attempts: number;
}

export const coursesApi = {
  progress: (opts?: { signal?: AbortSignal }) =>
    api.get<ProgressResponse>("/courses/progress", opts),
  quiz: (slug: string, index: number, opts?: { signal?: AbortSignal }) =>
    api.get<LessonQuiz>(`/courses/${slug}/lessons/${index}/quiz`, opts),
  submit: (slug: string, index: number, answers: number[]) =>
    api.post<QuizSubmitResult>(`/courses/${slug}/lessons/${index}/quiz/submit`, { answers }),
  rewatch: (slug: string, index: number) =>
    api.post<void>(`/courses/${slug}/lessons/${index}/rewatch`, {}),
};
