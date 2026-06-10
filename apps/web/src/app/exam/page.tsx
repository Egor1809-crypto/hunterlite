"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Shield,
  Clock,
  Award,
  CheckCircle,
  Lock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  FileText,
  Star,
  X,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { EditorialHeader } from "@/components/ui/EditorialHeader";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { Card } from "@/components/ui/Card";
import { AbstractBackdrop } from "@/components/ui/AbstractBackdrop";
import { CertificatePreview, CERT_TOKEN_PALETTE } from "@/components/certificate/CertificatePreview";

// ONE restrained brand accent for every card — the platform token var(--primary)
// so it follows the theme (purple in light, blue in dark) like the rest of the
// app. Tints go through color-mix instead of hardcoded hex-alpha.
const accentMix = (pct: number) => `color-mix(in srgb, var(--primary) ${pct}%, transparent)`;

// The mechanic is the new differentiator — surface it on every card.
const MECHANIC_META: Record<string, { label: string; ai: boolean }> = {
  hard_mcq: { label: "Тест + числа", ai: false },
  sequencing: { label: "Порядок + пары", ai: false },
  matching: { label: "Сопоставление", ai: false },
  case_analysis: { label: "Анализ дела", ai: true },
  document_drafting: { label: "Документ", ai: true },
  multi_step: { label: "Капстоун-дело", ai: true },
  mcq: { label: "Тест", ai: false },
};

interface ExamItem {
  id: string;
  title: string;
  description: string;
  categories: string[];
  question_count: number;
  time_limit_minutes: number;
  pass_threshold: number;
  mechanic: string;
  order_index: number;
  unlock_condition: Record<string, unknown>;
  best_score: number | null;
  attempts_count: number;
  passed: boolean;
  is_locked: boolean;
  certificate_code: string | null;
}

function ExamCard({ exam, onStart }: { exam: ExamItem; onStart: () => void }) {
  const isFinal = exam.id === "exam-5";
  const accent = "var(--primary)";
  const mech = MECHANIC_META[exam.mechanic] ?? { label: exam.mechanic, ai: false };

  return (
    <Card
      padded={false}
      className="group relative overflow-hidden"
      style={{ opacity: exam.is_locked ? 0.55 : 1 }}
    >
      {/* accent strip */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, var(--primary), ${accentMix(13)} 70%, transparent)` }} />

      <div className="p-5 sm:p-6">
        {/* Header — no icon-tile; mono eyebrow carries identity */}
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
                Экзамен {exam.order_index}
              </span>
              {/* mechanic pill — the differentiator */}
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ background: accentMix(9), color: accent, border: `1px solid ${accentMix(19)}` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                {mech.label}
              </span>
              {mech.ai ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                  <Star size={11} style={{ color: accent }} /> ИИ-оценка
                </span>
              ) : (
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Авто-проверка</span>
              )}
              {isFinal && (
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--warning)" }}>Финал</span>
              )}
              {exam.passed && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--success)" }}>
                  <CheckCircle size={12} /> Сдан
                </span>
              )}
            </div>

            <h3 className="mt-2 text-[19px] font-semibold leading-tight tracking-tight" style={{ color: "var(--text-primary)" }}>
              {exam.title}
            </h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {exam.description}
            </p>
          </div>

          {exam.passed && exam.best_score !== null && (
            <div className="shrink-0 text-right">
              <div className="font-mono text-[26px] font-semibold leading-none tabular-nums" style={{ color: "var(--success)" }}>{exam.best_score}%</div>
              <div className="mt-1 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>лучший</div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-4 gap-2.5">
          {[
            { icon: FileText, label: "Заданий", value: String(exam.question_count) },
            { icon: Clock, label: "Минут", value: String(exam.time_limit_minutes) },
            { icon: Star, label: "Порог", value: `${exam.pass_threshold}%` },
            { icon: RefreshCw, label: "Попыток", value: String(exam.attempts_count) },
          ].map((s) => {
            const SIcon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-xl px-2 py-3 text-center transition-colors"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
              >
                <SIcon size={14} className="mx-auto mb-1.5" style={{ color: accent }} />
                <div className="font-mono text-[15px] font-bold leading-none tabular-nums" style={{ color: "var(--text-primary)" }}>{s.value}</div>
                <div className="mt-1.5 text-[10.5px] font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Categories */}
        {exam.categories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {exam.categories.map((t) => (
              <span
                key={t}
                className="rounded-md px-2.5 py-1 text-[11.5px] font-medium"
                style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-5">
          {exam.is_locked ? (
            <div className="flex items-center gap-2 rounded-xl px-3 py-3 text-[13px]" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
              <Lock size={14} /> Сдайте предыдущий экзамен, чтобы открыть этот.
            </div>
          ) : (
            <button
              onClick={onStart}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-semibold text-white transition-transform active:scale-[0.99]"
              style={{ background: accent, boxShadow: "var(--shadow-sm)" }}
            >
              <GraduationCap size={17} />
              {exam.passed ? "Пересдать экзамен" : "Начать экзамен"}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ExamPage() {
  const router = useRouter();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCert, setShowCert] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const userName = useAuthStore((s) => s.user?.full_name ?? null);

  useEffect(() => {
    api.get<ExamItem[]>("/exams/")
      .then((data) => { setExams(data); setLoading(false); })
      .catch((err) => { setError(err.message || "Ошибка загрузки"); setLoading(false); });
  }, []);

  // Deep-link: /exam?cert=1 opens the certificate preview directly.
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cert") === "1") {
      setShowCert(true);
    }
  }, []);

  const passedModules = useMemo(() => exams.filter((e) => e.id !== "exam-5" && e.passed).length, [exams]);
  const finalPassed = exams.find((e) => e.id === "exam-5")?.passed ?? false;
  const overallProgress = finalPassed ? 100 : Math.round((passedModules / 5) * 100);

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--primary)" }} />
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout>
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg-primary)" }}>
          <div className="text-center">
            <AlertTriangle size={40} className="mx-auto mb-4" style={{ color: "var(--danger)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{error}</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showBreadcrumbs={false}>
      <div className="relative min-h-screen overflow-hidden bg-page-glow">
        <AbstractBackdrop />
        <div className="relative z-10 mx-auto max-w-[900px] px-5 py-8 sm:px-8 sm:py-12">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: "easeOut" }}>
            <EditorialHeader
              eyebrowLeft="Аттестация · ФЗ-127"
              eyebrowRight="5 экзаменов"
              title="Экзамен"
              subtitle="Подтверждение квалификации по ФЗ-127 — 5 экзаменов, 5 механик, ИИ-оценка."
              subtitleNoWrap
              right={
                <button
                  id="cert-open-btn"
                  onClick={() => setShowCert(true)}
                  className="hidden shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors sm:inline-flex"
                  style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                >
                  <Award size={16} style={{ color: "var(--primary)" }} /> Сертификат
                </button>
              }
            />
          </motion.div>

          {/* Progress banner */}
          <Card accentTop className="mt-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="mb-3 flex items-center gap-2">
                  <Award size={15} style={{ color: "var(--primary)" }} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Путь к сертификату</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {exams.filter((e) => e.id !== "exam-5").map((exam, i) => (
                    <div key={exam.id} className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-semibold tabular-nums"
                        style={{
                          background: exam.passed ? "var(--primary-muted)" : "var(--bg-secondary)",
                          border: `1.5px solid ${exam.passed ? "var(--primary)" : "var(--border-color)"}`,
                          color: exam.passed ? "var(--primary)" : "var(--text-muted)",
                        }}
                      >
                        {exam.passed ? <CheckCircle size={14} /> : i + 1}
                      </div>
                      {i < 3 && <div className="h-0.5 w-6 rounded-full" style={{ background: exam.passed ? "var(--primary)" : "var(--border-color)" }} />}
                    </div>
                  ))}
                  <div className="h-0.5 w-6 rounded-full" style={{ background: passedModules === 4 ? "var(--primary)" : "var(--border-color)" }} />
                  <button
                    onClick={() => setShowCert(true)}
                    aria-label="Посмотреть сертификат"
                    className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform hover:scale-105"
                    style={{
                      background: finalPassed ? "var(--primary-muted)" : "var(--bg-secondary)",
                      border: `2px solid ${finalPassed || passedModules === 4 ? "var(--primary)" : "var(--border-color)"}`,
                    }}
                  >
                    {finalPassed
                      ? <Award size={18} style={{ color: "var(--primary)" }} />
                      : <Lock size={16} style={{ color: passedModules === 4 ? "var(--primary)" : "var(--text-muted)" }} />}
                  </button>
                </div>

                <p className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  {finalPassed
                    ? "Сертификат получен — поздравляем."
                    : passedModules === 4
                      ? "Все 4 модуля сданы. Финальный экзамен открыт."
                      : `Сдано ${passedModules} из 4 модулей. Порог сдачи — 88%.`}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-center">
                <div className="relative h-20 w-20">
                  <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-color)" strokeWidth="6" />
                    <circle cx="40" cy="40" r="34" fill="none" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(overallProgress / 100) * 213.6} 213.6`} style={{ transition: "stroke-dasharray 0.5s ease" }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-lg font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{overallProgress}%</div>
                </div>
                <span className="mt-2 font-mono text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Прогресс</span>
              </div>
            </div>
          </Card>

          {/* Exam cards */}
          <div className="mt-8 space-y-4">
            {exams.map((exam, i) => (
              <motion.div key={exam.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(0.1 + i * 0.05, 0.35) }}>
                <ExamCard exam={exam} onStart={() => router.push(`/exam/${exam.id}`)} />
              </motion.div>
            ))}
          </div>

          {/* Earned certificates */}
          {exams.some((e) => e.certificate_code) && (
            <div className="mt-10">
              <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Ваши сертификаты</h2>
              <div className="space-y-3">
                {exams.filter((e) => e.certificate_code).map((exam) => (
                  <Card
                    key={exam.id}
                    variant="interactive"
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/exam/certificate/${exam.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter") router.push(`/exam/certificate/${exam.id}`); }}
                    className="group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Award size={20} style={{ color: "var(--primary)" }} />
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{exam.title}</div>
                        <div className="font-mono text-[12px]" style={{ color: "var(--text-secondary)" }}>{exam.best_score}% · код {exam.certificate_code}</div>
                      </div>
                    </div>
                    <span className="font-mono text-[12px] font-semibold" style={{ color: "var(--primary)" }}>Открыть</span>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Rules */}
          <Card className="mt-8">
            <div className="flex items-start gap-3">
              <Shield size={16} className="mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <div>
                <div className="mb-1.5 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Правила экзаменации</div>
                <ul className="space-y-1.5 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  <li>Все экзамены открыты — проходите в любом порядке.</li>
                  <li>У каждого экзамена своя механика; порог сдачи везде — 88%.</li>
                  <li>Задания формируются по плану экзамена; сложные ответы оценивает ИИ-эксперт по рубрике.</li>
                  <li>Таймер проверяется на сервере; сертификат — только при проходе в срок.</li>
                  <li>При успешной сдаче выдаётся сертификат с кодом верификации.</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Certificate modal */}
      <AnimatePresence>
        {showCert && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0" style={{ background: "var(--overlay-bg)", backdropFilter: "blur(6px)" }} onClick={() => { setShowCert(false); setShowSample(false); }} />
            <motion.div
              className="relative w-full max-w-[820px]"
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
            >
              <button
                onClick={() => { setShowCert(false); setShowSample(false); }}
                aria-label="Закрыть"
                className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", boxShadow: "var(--shadow-md)" }}
              >
                <X size={16} />
              </button>

              {finalPassed || showSample ? (
                <CertificatePreview
                  variant="earned"
                  palette={CERT_TOKEN_PALETTE}
                  recipientName={userName ?? "Фамилия Имя Отчество"}
                />
              ) : (
                <CertificatePreview
                  variant="locked"
                  palette={CERT_TOKEN_PALETTE}
                  lockTitle="Сдайте экзамен на проходной балл — и получите сертификат об аттестации."
                  lockSubtitle="Станьте экспертом в процедуре банкротства физических лиц."
                  ctaLabel="К экзаменам"
                  onCta={() => { setShowCert(false); setShowSample(false); }}
                />
              )}

              {/* Sample preview toggle — lets you see the diploma design before passing */}
              {!finalPassed && (
                <div className="mt-4 flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => setShowSample((v) => !v)}
                    className="flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
                    style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  >
                    <Award size={15} style={{ color: "var(--primary)" }} />
                    {showSample ? "Скрыть образец" : "Посмотреть образец сертификата"}
                  </button>
                  {showSample && (
                    <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Это образец — сдайте экзамен, чтобы получить именной сертификат.
                    </span>
                  )}
                </div>
              )}

              {finalPassed && (
                <button
                  onClick={() => { setShowCert(false); router.push("/exam/certificate/exam-5"); }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  <Award size={16} /> Открыть сертификат
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
