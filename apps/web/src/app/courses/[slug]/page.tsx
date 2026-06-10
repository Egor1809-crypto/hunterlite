"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight, Play, Lock, ArrowLeft, Clock } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";
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

/* ── Один урок = редакторская строка индекса (перенесено из обзора) ──────── */
function LessonRow({ lesson, index }: { lesson: Lesson; index: number }) {
  const live = hasLink(lesson);
  const num = String(index + 1).padStart(2, "0");

  const inner = (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 py-6 sm:gap-8 sm:py-7">
      <span
        className="font-mono tabular-nums transition-colors"
        style={{
          fontSize: "clamp(28px, 4.5vw, 44px)",
          lineHeight: 1,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: live ? "var(--text-muted)" : "var(--border-color)",
          width: "clamp(46px, 7vw, 72px)",
        }}
      >
        {num}
      </span>

      <div className="min-w-0">
        <div
          className="flex items-center gap-2 font-mono uppercase"
          style={{ fontSize: 10.5, letterSpacing: "0.18em", color: "var(--text-muted)" }}
        >
          <span>Урок {num}</span>
          {lesson.duration && (
            <>
              <span style={{ color: "var(--border-color)" }}>·</span>
              <span className="tabular-nums">{lesson.duration}</span>
            </>
          )}
          {!live && (
            <>
              <span style={{ color: "var(--border-color)" }}>·</span>
              <span>скоро</span>
            </>
          )}
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
      </div>

      <div className="flex items-center gap-4">
        <div
          className="relative hidden overflow-hidden sm:block"
          style={{
            width: "clamp(96px, 13vw, 152px)",
            aspectRatio: "16 / 9",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            background: "var(--bg-secondary)",
          }}
        >
          {lesson.cover ? (
            <Image
              src={lesson.cover}
              alt={lesson.title}
              width={304}
              height={171}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
              style={{ filter: live ? "none" : "grayscale(1)", opacity: live ? 1 : 0.55 }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-sm" style={{ color: "var(--text-muted)" }}>
              {num}
            </div>
          )}
          {live && (
            <span
              className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: "color-mix(in srgb, var(--text-primary) 30%, transparent)" }}
            >
              <span
                className="flex items-center justify-center rounded-full backdrop-blur-sm"
                style={{ width: 36, height: 36, background: "color-mix(in srgb, var(--primary) 92%, transparent)" }}
              >
                <Play size={15} className="ml-0.5" style={{ color: "var(--primary-contrast, #fff)" }} fill="currentColor" />
              </span>
            </span>
          )}
        </div>

        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300"
          style={{
            border: "1px solid var(--border-color)",
            color: live ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          {live ? (
            <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          ) : (
            <Lock size={13} />
          )}
        </span>
      </div>
    </div>
  );

  const rowStyle = { borderTop: index === 0 ? "none" : "1px solid var(--border-color)" } as const;

  return live ? (
    <a
      href={lesson.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block transition-colors"
      style={rowStyle}
    >
      {inner}
    </a>
  ) : (
    <div className="group block cursor-default" style={rowStyle}>
      {inner}
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

  if (!course) {
    notFound();
  }

  const liveCount = course.lessons.filter(hasLink).length;
  const hasLessons = course.lessons.length > 0;

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
                      <LessonRow lesson={lesson} index={i} />
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
    </AuthLayout>
  );
}
