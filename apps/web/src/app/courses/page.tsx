"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { EditorialHeader } from "@/components/ui/EditorialHeader";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";
import { Card } from "@/components/ui/Card";
import { COURSES, hasLink, type Course } from "./data";

/* ── Бейдж цены / «Бесплатно» ─────────────────────────────────────────────
 * Платный — тихий контур-токен с ценой. Бесплатный — единственный акцент
 * (var(--primary)) на странице, чтобы открытый курс читался сразу.
 * ─────────────────────────────────────────────────────────────────────── */
function PriceBadge({ course }: { course: Course }) {
  if (!course.paid) {
    return (
      <span
        className="inline-flex items-center font-mono uppercase tabular-nums"
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          padding: "5px 11px",
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
        padding: "5px 11px",
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

/* ── Карточка курса — крупная редакторская плитка, кликабельна целиком ───── */
function CourseCard({ course, index }: { course: Course; index: number }) {
  const liveCount = course.lessons.filter(hasLink).length;
  const hasLessons = course.lessons.length > 0;
  const num = String(index + 1).padStart(2, "0");

  const lessonsLabel = hasLessons
    ? `${String(course.lessons.length).padStart(2, "0")} уроков · ${liveCount} доступно`
    : "Уроки скоро появятся";

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.06, duration: 0.3, ease: "easeOut" }}
    >
      <Link href={`/courses/${course.slug}`} className="group block h-full">
        <Card
          variant="interactive"
          accentTop={!course.paid}
          padded={false}
          className="h-full"
          style={{ padding: "clamp(22px, 3vw, 34px)" }}
        >
          <div className="flex h-full flex-col">
            {/* Верх: код-номер · бейдж цены */}
            <div className="flex items-start justify-between gap-4">
              <span
                className="font-mono uppercase tabular-nums"
                style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}
              >
                {num} · {course.code}
              </span>
              <PriceBadge course={course} />
            </div>

            {/* Название — показываем полностью (без обрезки). Резервируем
                высоту под 3 строки (minHeight), чтобы описание на всех
                карточках начиналось на одном уровне, даже если заголовок
                короче. wordBreak/overflowWrap: normal — не рвать слова
                посередине («Сопровождение» остаётся целым). */}
            <h2
              className="mt-7 font-display"
              style={{
                fontSize: "clamp(24px, 3vw, 34px)",
                lineHeight: 1.04,
                minHeight: "3.12em",
                letterSpacing: "-0.03em",
                fontWeight: 600,
                color: "var(--text-primary)",
                wordBreak: "normal",
                overflowWrap: "normal",
              }}
            >
              {course.title}
            </h2>

            {/* Описание — целиком, без line-clamp, чтобы был виден весь текст. */}
            <p
              className="mt-4 text-[14px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {course.description}
            </p>

            {/* Низ: счётчик уроков · стрелка — прижат к низу, чтобы все карточки
                были одной высоты и нижние ряды совпадали по уровню. */}
            <div
              className="mt-auto flex items-center justify-between pt-5"
              style={{ marginTop: "auto", borderTop: "1px solid var(--border-color)" }}
            >
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.14em",
                  color: hasLessons ? "var(--text-secondary)" : "var(--text-muted)",
                }}
              >
                {lessonsLabel}
              </span>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              >
                <ArrowUpRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </span>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

export default function CoursesPage() {
  const totalLessons = COURSES.reduce((sum, c) => sum + c.lessons.length, 0);

  return (
    <AuthLayout showBreadcrumbs={false}>
      <div className="relative min-h-screen overflow-hidden bg-page-glow">
        <AbstractBackdrop />
        <div className="relative z-10 mx-auto max-w-[1080px] px-5 py-8 sm:px-8 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <EditorialHeader
              eyebrowLeft="Обучение · Видеокурсы"
              eyebrowRight={`${String(COURSES.length).padStart(2, "0")} курса · ${totalLessons} уроков`}
              title="Курсы"
              subtitle="Авторские программы по банкротству физических лиц. Выберите курс — от открытого практикума до экспертного уровня."
            />
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut", delay: 0.06 }}
            className="mt-12 sm:mt-16"
          >
            <div className="mb-5 flex items-center justify-between">
              <span
                className="font-mono uppercase"
                style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}
              >
                01 · Программы
              </span>
              <span
                className="font-mono uppercase tabular-nums"
                style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}
              >
                BFL
              </span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {COURSES.map((course, i) => (
                <CourseCard key={course.slug} course={course} index={i} />
              ))}
            </div>

            <p className="mt-6 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
              Платные курсы открываются после оплаты. Бесплатный практикум доступен всем пользователям платформы.
            </p>
          </motion.section>
        </div>
      </div>
    </AuthLayout>
  );
}
