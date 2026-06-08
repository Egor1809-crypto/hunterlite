"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Loader2 } from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { EditorialHeader } from "@/components/ui/EditorialHeader";
import { Card } from "@/components/ui/Card";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";
import { CertificatePreview, CERT_TOKEN_PALETTE } from "@/components/certificate/CertificatePreview";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";

// Mirrors the shape returned by GET /exams/ (see app/exam/page.tsx). We only
// read the fields needed to compute certificate eligibility.
interface ExamItem {
  id: string;
  title: string;
  passed: boolean;
  best_score: number | null;
  pass_threshold: number;
}

// The certificate is earned by passing the 4 thematic modules (exam-1..4) and
// the final capstone (exam-5), each at the platform threshold of 88%.
const PASS_THRESHOLD = 88;

export default function CertificatePage() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userName = useAuthStore((s) => s.user?.full_name ?? null);

  useEffect(() => {
    api
      .get<ExamItem[]>("/exams/")
      .then((data) => {
        setExams(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Ошибка загрузки");
        setLoading(false);
      });
  }, []);

  const modules = useMemo(() => exams.filter((e) => e.id !== "exam-5"), [exams]);
  const finalExam = useMemo(() => exams.find((e) => e.id === "exam-5") ?? null, [exams]);
  const passedModules = useMemo(() => modules.filter((e) => e.passed).length, [modules]);
  const finalPassed = finalExam?.passed ?? false;
  const earned = finalPassed;
  const totalSteps = 5; // 4 modules + final
  const doneSteps = passedModules + (finalPassed ? 1 : 0);
  const progress = earned ? 100 : Math.round((doneSteps / totalSteps) * 100);

  // Requirement rows — what the user must complete, with live status.
  const requirements = useMemo(() => {
    const rows = modules.map((m, i) => ({
      key: m.id,
      index: i + 1,
      label: m.title || `Модуль ${i + 1}`,
      hint: "Тематический модуль",
      done: m.passed,
      score: m.best_score,
    }));
    rows.push({
      key: "exam-5",
      index: rows.length + 1,
      label: finalExam?.title || "Финальный экзамен",
      hint: "Капстоун-дело",
      done: finalPassed,
      score: finalExam?.best_score ?? null,
    });
    return rows;
  }, [modules, finalExam, finalPassed]);

  const ctaLabel = earned
    ? "Перейти к экзаменам"
    : doneSteps === 0
      ? "Начать аттестацию"
      : "Продолжить аттестацию";

  return (
    <AuthLayout showBreadcrumbs={false}>
      <div className="relative min-h-screen overflow-hidden bg-page-glow">
        <AbstractBackdrop />
        <div className="relative z-10 mx-auto max-w-[960px] px-5 py-8 sm:px-8 sm:py-12">
          {/* ── KEEP: editorial header framework ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <EditorialHeader
              eyebrowLeft="Аттестация · ФЗ-127"
              eyebrowRight={earned ? "Сертификат получен" : `${doneSteps} / ${totalSteps}`}
              title="Сертификат"
              subtitle="Именной сертификат об аттестации по банкротству физических лиц. Сдайте четыре модуля и финальный экзамен — каждый на порог 88%."
            />
          </motion.div>

          {loading ? (
            <div className="mt-24 flex justify-center">
              <Loader2 className="animate-spin" size={28} style={{ color: "var(--primary)" }} />
            </div>
          ) : error ? (
            <Card className="mt-10">
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            </Card>
          ) : (
            <>
              {/* ════════════════════════════════════════════════
                  HERO — magazine spread. The diploma IS the page.
                 ════════════════════════════════════════════════ */}
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: "easeOut", delay: 0.05 }}
                className="mt-14 sm:mt-20"
              >
                {/* spec strip — a caption line above the spread */}
                <div
                  className="flex items-baseline justify-between gap-4 pb-4"
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <span
                    className="font-mono uppercase"
                    style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--text-secondary)" }}
                  >
                    {earned ? "Ваш сертификат" : "Образец документа"}
                  </span>
                  <span
                    className="font-mono uppercase tabular-nums"
                    style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--text-muted)" }}
                  >
                    SC—127 · A4 · 1.414:1
                  </span>
                </div>

                {/* The diploma, presented as the centrepiece of the spread */}
                <div className="mt-10 sm:mt-12">
                  {earned ? (
                    <CertificatePreview
                      variant="earned"
                      palette={CERT_TOKEN_PALETTE}
                      recipientName={userName ?? "Фамилия Имя Отчество"}
                    />
                  ) : (
                    <CertificatePreview
                      variant="locked"
                      palette={CERT_TOKEN_PALETTE}
                      lockTitle={`Сдайте все экзамены на ≥${PASS_THRESHOLD}% — и сертификат станет именным.`}
                      lockSubtitle="Эксперт в процедуре банкротства физических лиц."
                      ctaLabel="К экзаменам"
                      onCta={() => router.push("/exam")}
                    />
                  )}
                </div>

                {/* caption row under the spread — figure label + action */}
                <div className="mx-auto mt-8 flex max-w-[760px] flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
                  <p
                    className="font-mono uppercase"
                    style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)", maxWidth: 360 }}
                  >
                    Рис. 01 · Именной сертификат об аттестации, LegalHunter
                  </p>
                  {earned && (
                    <button
                      onClick={() => router.push("/exam/certificate/exam-5")}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-transform hover:scale-[1.01]"
                      style={{ background: "var(--primary)", color: "#fff", border: "1px solid var(--primary)" }}
                    >
                      Открыть и скачать
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </motion.section>

              {/* ════════════════════════════════════════════════
                  REQUIREMENTS — a spec sheet, editorial & precise.
                 ════════════════════════════════════════════════ */}
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: "easeOut", delay: 0.1 }}
                className="mt-20 sm:mt-28"
              >
                <div className="grid gap-12 lg:grid-cols-[320px_1fr]">
                  {/* Left — brief + the threshold number as a hero numeral */}
                  <div className="lg:sticky lg:top-12 lg:self-start">
                    <div
                      className="font-mono uppercase tabular-nums"
                      style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-secondary)" }}
                    >
                      01 · Условия
                    </div>
                    <h2
                      className="font-display"
                      style={{
                        marginTop: 10,
                        fontSize: "clamp(28px, 4.4vw, 38px)",
                        lineHeight: 1.0,
                        letterSpacing: "-0.035em",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      Что нужно
                      <br />
                      выполнить
                    </h2>

                    <div
                      className="mt-9 flex items-end gap-3 pt-7"
                      style={{ borderTop: "1px solid var(--border-color)" }}
                    >
                      <span
                        className="font-mono leading-none tabular-nums"
                        style={{ fontSize: 72, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.04em" }}
                      >
                        88
                      </span>
                      <span className="pb-2.5 text-sm leading-tight" style={{ color: "var(--text-muted)" }}>
                        % порог
                        <br />
                        на каждом
                      </span>
                    </div>

                    <p className="mt-7 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      Четыре тематических модуля и финальный экзамен. После сдачи финала сертификат
                      становится именным и доступен для скачивания.
                    </p>
                  </div>

                  {/* Right — live checklist as numbered spec rows + progress */}
                  <div>
                    <div className="flex flex-col">
                      {requirements.map((r, i) => (
                        <div
                          key={r.key}
                          className="grid grid-cols-[28px_1fr_auto] items-center gap-4 py-5"
                          style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-color)" }}
                        >
                          <span
                            className="font-mono text-[12px] tabular-nums"
                            style={{ color: r.done ? "var(--primary)" : "var(--text-muted)", letterSpacing: "0.08em" }}
                          >
                            {String(r.index).padStart(2, "0")}
                          </span>
                          <div className="min-w-0">
                            <div
                              className="truncate text-[15px] font-semibold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {r.label}
                            </div>
                            <div className="font-mono text-[11px]" style={{ color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                              {r.hint} · порог {PASS_THRESHOLD}%
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {r.done && typeof r.score === "number" ? (
                              <span
                                className="font-mono text-[13px] font-semibold tabular-nums"
                                style={{ color: "var(--primary)" }}
                              >
                                {r.score}%
                              </span>
                            ) : (
                              <span
                                className="font-mono text-[11px] uppercase tabular-nums"
                                style={{ color: "var(--text-muted)", letterSpacing: "0.12em" }}
                              >
                                —
                              </span>
                            )}
                            <span
                              className="font-mono text-[10px] uppercase tabular-nums"
                              style={{
                                color: r.done ? "var(--primary)" : "var(--text-muted)",
                                letterSpacing: "0.16em",
                                minWidth: 56,
                                textAlign: "right",
                              }}
                            >
                              {r.done ? "Сдано" : "Закрыт"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="mt-10 pt-8"
                      style={{ borderTop: "1px solid var(--border-color)" }}
                    >
                      <div className="mb-3 flex items-baseline justify-between">
                        <span
                          className="font-mono uppercase"
                          style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}
                        >
                          Прогресс аттестации
                        </span>
                        <span
                          className="font-mono text-[13px] font-semibold tabular-nums"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {progress}%
                        </span>
                      </div>
                      <div
                        className="h-1 w-full overflow-hidden rounded-full"
                        style={{ background: "var(--border-color)" }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: "var(--primary)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>

                      <button
                        onClick={() => router.push("/exam")}
                        className="mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold transition-transform hover:scale-[1.01]"
                        style={{ background: "var(--primary)", color: "#fff", border: "1px solid var(--primary)" }}
                      >
                        {ctaLabel}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* ════════════════════════════════════════════════
                  TEASER — quiet, editorial link to the championship.
                 ════════════════════════════════════════════════ */}
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: "easeOut", delay: 0.14 }}
                className="mt-16 sm:mt-24"
              >
                <Card
                  variant="interactive"
                  accentTop
                  padded={false}
                  className="group cursor-pointer"
                  onClick={() => router.push("/certificate/contest")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push("/certificate/contest");
                    }
                  }}
                >
                  <div className="grid items-stretch gap-0 sm:grid-cols-[1fr_auto]">
                    <div className="p-7 sm:p-9">
                      <div className="flex items-center justify-between gap-4">
                        <span
                          className="font-mono uppercase"
                          style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--primary)" }}
                        >
                          02 · Чемпионат сезона
                        </span>
                        <span
                          className="font-mono uppercase tabular-nums"
                          style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--text-muted)" }}
                        >
                          CUP—S1
                        </span>
                      </div>
                      <h3
                        className="font-display"
                        style={{
                          marginTop: 18,
                          fontSize: "clamp(24px, 3.6vw, 32px)",
                          lineHeight: 1.06,
                          letterSpacing: "-0.03em",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        Аттестованных ждёт розыгрыш приза
                      </h3>
                      <p
                        className="mt-3 max-w-md text-[14px] leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Сдайте аттестацию до конца сезона — и поборитесь за главный приз. Чем выше балл и
                        быстрее сдача, тем выше место.
                      </p>
                      <div
                        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
                        style={{ color: "var(--primary)" }}
                      >
                        Смотреть чемпионат
                        <ArrowUpRight
                          size={16}
                          className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                      </div>
                    </div>

                    {/* Right — minimal podium, hairline-divided from copy */}
                    <div
                      className="hidden items-end justify-center gap-2 px-10 py-9 sm:flex"
                      style={{ borderLeft: "1px solid var(--border-color)" }}
                    >
                      {[2, 1, 3].map((place) => {
                        const h = place === 1 ? 64 : place === 2 ? 46 : 36;
                        const lead = place === 1;
                        return (
                          <div key={place} className="flex flex-col items-center gap-2">
                            <div
                              className="w-9 rounded-t-sm"
                              style={{ height: h, background: lead ? "var(--primary)" : "var(--primary-muted)" }}
                            />
                            <span
                              className="font-mono text-[10px] tabular-nums"
                              style={{ color: lead ? "var(--primary)" : "var(--text-muted)", letterSpacing: "0.1em" }}
                            >
                              {place}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              </motion.section>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
