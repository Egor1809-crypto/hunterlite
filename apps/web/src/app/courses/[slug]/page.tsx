"use client";

import { use, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import { Play, Lock, ArrowLeft, Clock, Check, ClipboardCheck } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";
import LessonQuiz from "@/components/courses/LessonQuiz";
import { coursesApi, type CourseProgress } from "@/lib/courses";
import { getCourse, hasLink, type Course, type Lesson } from "../data";

/* ── Бейдж цены / «Бесплатно» — как на обзоре ─────────────────────────────── */
function PriceBadge({ course }: { course: Course }) {
  if (!course.paid) {
    return (
      <span
        className="inline-flex items-center font-mono uppercase tabular-nums"
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          padding: "6px 13px",
          borderRadius: 999,
          color: "var(--primary-contrast, #fff)",
          background: "var(--primary)",
        }}
      >
        Бесплатно
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center font-mono uppercase tabular-nums"
      style={{
        fontSize: 11,
        letterSpacing: "0.12em",
        padding: "6px 13px",
        borderRadius: 999,
        color: "var(--text-primary)",
        border: "1px solid var(--border-color)",
        background: "var(--bg-secondary)",
      }}
    >
      {course.price}
    </span>
  );
}

/** «через N дн» / «сегодня» до открытия урока (дрип, чт 19:00 МСК). */
function untilUnlock(iso: string | null): string {
  if (!iso) return "скоро";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "скоро";
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 1) return "завтра";
  const last = days % 10;
  const word = last === 1 && days !== 11 ? "день" : last >= 2 && last <= 4 && (days < 12 || days > 14) ? "дня" : "дней";
  return `через ${days} ${word}`;
}

/* ── Один урок = редакторская строка индекса ──────── */
function LessonRow({
  lesson,
  index,
  completed,
  locked,
  unlockAt,
  onCheck,
}: {
  lesson: Lesson;
  index: number;
  completed: boolean;
  locked: boolean;
  unlockAt: string | null;
  onCheck: () => void;
}) {
  const live = hasLink(lesson) && !locked;
  const num = String(index + 1).padStart(2, "0");
  const rowStyle = { borderTop: index === 0 ? "none" : "1px solid var(--border-color)" } as const;

  return (
    <div className="group block" style={rowStyle}>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 py-6 sm:gap-8 sm:py-7">
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: "clamp(28px, 4.5vw, 44px)",
            lineHeight: 1,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: completed ? "var(--primary)" : live ? "var(--text-muted)" : "var(--border-color)",
            width: "clamp(46px, 7vw, 72px)",
          }}
        >
          {num}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.18em", color: "var(--text-muted)" }}>
            <span>Урок {num}</span>
            {lesson.duration && (
              <>
                <span style={{ color: "var(--border-color)" }}>·</span>
                <span className="tabular-nums">{lesson.duration}</span>
              </>
            )}
            {completed ? (
              <>
                <span style={{ color: "var(--border-color)" }}>·</span>
                <span className="inline-flex items-center gap-1" style={{ color: "var(--primary)" }}><Check size={11} /> Пройдено</span>
              </>
            ) : locked ? (
              <>
                <span style={{ color: "var(--border-color)" }}>·</span>
                <span className="inline-flex items-center gap-1"><Lock size={10} /> Откроется в чт 19:00 · {untilUnlock(unlockAt)}</span>
              </>
            ) : !hasLink(lesson) ? (
              <>
                <span style={{ color: "var(--border-color)" }}>·</span>
                <span>скоро</span>
              </>
            ) : null}
          </div>
          <h3
            className="mt-2 line-clamp-2 font-display"
            style={{
              fontSize: "clamp(18px, 2.6vw, 26px)",
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              fontWeight: 600,
              color: live ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {lesson.title}
          </h3>
          {lesson.description && (
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {lesson.description}
            </p>
          )}

          {/* Actions: Смотреть (внешнее видео) + Проверка / статус */}
          {live && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={lesson.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium no-underline transition-colors"
                style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              >
                <Play size={13} fill="currentColor" /> Смотреть
              </a>
              {completed ? (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
                  <Check size={13} /> Урок пройден
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onCheck}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-opacity hover:opacity-90"
                  style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}
                >
                  <ClipboardCheck size={13} /> Пройти проверку
                </button>
              )}
            </div>
          )}

          {locked && (
            <div
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px]"
              style={{ border: "1px dashed var(--border-color)", color: "var(--text-muted)" }}
            >
              <Lock size={13} /> Откроется в четверг, 19:00 (МСК) · {untilUnlock(unlockAt)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div
            className="relative hidden overflow-hidden sm:block"
            style={{ width: "clamp(96px, 13vw, 152px)", aspectRatio: "16 / 9", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}
          >
            {lesson.cover ? (
              <Image
                src={lesson.cover}
                alt={lesson.title}
                width={304}
                height={171}
                className="h-full w-full object-cover"
                style={{ filter: live ? "none" : "grayscale(1)", opacity: live ? 1 : 0.55 }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-mono text-sm" style={{ color: "var(--text-muted)" }}>{num}</div>
            )}
          </div>

          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ border: `1px solid ${completed ? "var(--primary)" : "var(--border-color)"}`, color: completed ? "var(--primary)" : live ? "var(--text-primary)" : "var(--text-muted)" }}
          >
            {completed ? <Check size={16} /> : live ? <Play size={13} fill="currentColor" /> : <Lock size={13} />}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Секция-заглушка для курсов без уроков ────────────────────────────────── */
function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        padding: "clamp(48px, 9vw, 96px) 24px",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-2xl)",
        background: "var(--surface-card)",
      }}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          border: "1px solid var(--border-color)",
          color: "var(--text-muted)",
        }}
      >
        <Clock size={22} />
      </span>
      <h3
        className="mt-6 font-display"
        style={{
          fontSize: "clamp(22px, 3vw, 30px)",
          lineHeight: 1.1,
          letterSpacing: "-0.025em",
          fontWeight: 600,
          color: "var(--text-primary)",
        }}
      >
        Уроки скоро появятся
      </h3>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Мы записываем материалы этого курса. Уроки будут открываться по мере готовности — загляните позже.
      </p>
    </div>
  );
}

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const course = getCourse(slug);

  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [openQuiz, setOpenQuiz] = useState<number | null>(null);

  const refreshProgress = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const r = await coursesApi.progress({ signal });
        setProgress(r.courses.find((c) => c.course_slug === slug) ?? null);
      } catch {
        /* not logged in / network — page still renders without progress */
      }
    },
    [slug],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    refreshProgress(ctrl.signal);
    return () => ctrl.abort();
  }, [refreshProgress]);

  if (!course) {
    notFound();
  }

  const liveCount = course.lessons.filter(hasLink).length;
  const hasLessons = course.lessons.length > 0;
  const lessonMeta = new Map((progress?.lessons ?? []).map((l) => [l.lesson_index, l]));
  const percent = progress?.percent ?? 0;
  const completedCount = progress?.completed_lessons ?? 0;

  return (
    <AuthLayout showBreadcrumbs={false}>
      <div className="relative min-h-screen overflow-hidden bg-page-glow">
        <AbstractBackdrop />
        <div className="relative z-10 mx-auto max-w-[920px] px-5 py-8 sm:px-8 sm:py-12">
          {/* Back-link на обзор */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
            <Link
              href="/courses"
              className="group inline-flex items-center gap-2 font-mono uppercase transition-colors"
              style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}
            >
              <ArrowLeft size={14} className="transition-transform duration-300 group-hover:-translate-x-0.5" />
              Все курсы
            </Link>
          </motion.div>

          {/* Шапка курса */}
          <motion.header
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: "easeOut", delay: 0.04 }}
            className="mt-8"
          >
            <div className="flex items-center justify-between gap-4">
              <span
                className="font-mono uppercase tabular-nums"
                style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-secondary)" }}
              >
                Обучение · {course.code}
              </span>
              <PriceBadge course={course} />
            </div>

            <h1
              className="mt-5 font-display"
              style={{
                fontSize: "clamp(40px, 7vw, 80px)",
                lineHeight: 0.95,
                letterSpacing: "-0.045em",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {course.title}
            </h1>
            <p className="mt-5" style={{ fontSize: 17, lineHeight: 1.55, color: "var(--text-secondary)", maxWidth: 620 }}>
              {course.description}
            </p>
          </motion.header>

          {/* Тело: уроки или заглушка */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
            className="mt-12 sm:mt-16"
          >
            {hasLessons ? (
              <>
                {/* Прогресс прохождения курса (мини-проверки) */}
                <div className="mb-7 rounded-2xl p-5" style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}>
                      Прогресс курса
                    </span>
                    <span className="font-mono tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: percent === 100 ? "var(--primary)" : "var(--text-primary)" }}>
                      {percent}% · {completedCount}/{course.lessons.length}
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-secondary)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "var(--primary)" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Урок засчитывается после мини-проверки (3 из 3). Для участия в чемпионате нужно 100%.
                  </p>
                </div>

                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}>
                    01 · Программа курса
                  </span>
                  <span className="font-mono uppercase tabular-nums" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}>
                    {String(course.lessons.length).padStart(2, "0")} уроков · {liveCount} доступно
                  </span>
                </div>

                <div className="flex flex-col" style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {course.lessons.map((lesson, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(0.12 + i * 0.025, 0.36), duration: 0.26, ease: "easeOut" }}
                    >
                      <LessonRow
                        lesson={lesson}
                        index={i}
                        completed={lessonMeta.get(i)?.completed ?? false}
                        locked={lessonMeta.get(i)?.locked ?? false}
                        unlockAt={lessonMeta.get(i)?.unlock_at ?? null}
                        onCheck={() => setOpenQuiz(i)}
                      />
                    </motion.div>
                  ))}
                </div>

                <p className="mt-5 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Видео открываются по внешней ссылке. Уроки в статусе «скоро» появятся по мере записи.
                </p>
              </>
            ) : (
              <EmptyState />
            )}
          </motion.section>
        </div>
      </div>

      {openQuiz !== null && (
        <LessonQuiz
          slug={slug}
          lessonIndex={openQuiz}
          lessonTitle={course.lessons[openQuiz]?.title ?? ""}
          onClose={() => setOpenQuiz(null)}
          onPassed={() => refreshProgress()}
        />
      )}
    </AuthLayout>
  );
}
