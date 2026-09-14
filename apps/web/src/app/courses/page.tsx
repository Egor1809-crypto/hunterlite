"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { EditorialHeader } from "@/components/ui/EditorialHeader";
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
    <Link
      href={`/courses/${course.slug}`}
      className="editorial-course-row group"
    >
      <span className="editorial-index-number">{num}</span>
      <div>
        <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
          {course.title}
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {course.description}
        </p>
        <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          {lessonsLabel}
        </p>
      </div>
      <div className="editorial-course-action">
        <PriceBadge course={course} />
        <ArrowUpRight size={22} />
      </div>
    </Link>
  );
}

export default function CoursesPage() {
  const totalLessons = COURSES.reduce((sum, c) => sum + c.lessons.length, 0);

  return (
    <AuthLayout showBreadcrumbs={false}>
      <div className="relative min-h-screen overflow-hidden editorial-page">
        <div className="relative z-10 mx-auto max-w-[920px] px-5 py-8 sm:px-8 sm:py-12">
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
            <div className="editorial-index">
              {COURSES.map((course, i) => (
                <CourseCard key={course.slug} course={course} index={i} />
              ))}
            </div>

            <p
              className="mt-6 font-mono text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              Платные курсы открываются после оплаты. Бесплатный практикум
              доступен всем пользователям платформы.
            </p>
          </motion.section>
        </div>
      </div>
    </AuthLayout>
  );
}
