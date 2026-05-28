"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Award,
  ArrowLeft,
  Share2,
  Download,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Copy,
  ExternalLink,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";

interface AttemptSummary {
  id: string;
  started_at: string;
  finished_at: string | null;
  score_percent: number | null;
  correct_count: number | null;
  total_count: number | null;
  passed: boolean | null;
  certificate_code: string | null;
}

const EXAM_TITLES: Record<string, string> = {
  "exam-1": "Процедуры банкротства",
  "exam-2": "Кредиторы и требования",
  "exam-3": "Арбитражный управляющий",
  "exam-4": "Оспаривание и ответственность",
  "exam-5": "Финальная аттестация",
};

const EXAM_COLORS: Record<string, { color: string; rgb: string }> = {
  "exam-1": { color: "#3B82F6", rgb: "59,130,246" },
  "exam-2": { color: "#F59E0B", rgb: "245,158,11" },
  "exam-3": { color: "#EC4899", rgb: "236,72,153" },
  "exam-4": { color: "#6366F1", rgb: "99,102,241" },
  "exam-5": { color: "#F59E0B", rgb: "245,158,11" },
};

export default function CertificatePage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [attempt, setAttempt] = useState<AttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<AttemptSummary[]>(`/exams/${examId}/results`)
      .then((results) => {
        const best = results
          .filter((r) => r.passed && r.certificate_code)
          .sort((a, b) => (b.score_percent ?? 0) - (a.score_percent ?? 0))[0];
        if (best) {
          setAttempt(best);
        } else {
          setError("Сертификат не найден. Сдайте экзамен для получения.");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Ошибка загрузки");
        setLoading(false);
      });
  }, [examId]);

  const verifyUrl =
    typeof window !== "undefined" && attempt?.certificate_code
      ? `${window.location.origin}/exam/certificate/verify/${attempt.certificate_code}`
      : "";

  const handleCopyLink = async () => {
    if (!verifyUrl) return;
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const handleShare = async () => {
    if (!verifyUrl || !attempt) return;
    const title = EXAM_TITLES[examId] ?? "Экзамен";
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Сертификат: ${title}`,
          text: `Сертификат HunterLite — ${title}, ${attempt.score_percent}%`,
          url: verifyUrl,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const style = EXAM_COLORS[examId] ?? { color: "#8B5CF6", rgb: "139,92,246" };
  const examTitle = EXAM_TITLES[examId] ?? examId;

  if (loading) {
    return (
      <AuthLayout>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <Loader2 size={32} className="animate-spin" style={{ color: "#F59E0B" }} />
        </div>
      </AuthLayout>
    );
  }

  if (error || !attempt) {
    return (
      <AuthLayout>
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <div className="text-center max-w-sm px-6">
            <AlertTriangle
              size={48}
              className="mx-auto mb-4"
              style={{ color: "var(--warning)" }}
            />
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              {error || "Сертификат не найден"}
            </p>
            <button
              onClick={() => router.push("/exam")}
              className="text-sm font-bold px-5 py-2.5 rounded-xl"
              style={{
                background: "rgba(245,158,11,0.1)",
                border: "1.5px solid rgba(245,158,11,0.3)",
                color: "#F59E0B",
              }}
            >
              К экзаменам
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  const issuedDate = attempt.finished_at
    ? new Date(attempt.finished_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <AuthLayout>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes certGlow {
          0%, 100% { box-shadow: 0 0 30px rgba(${style.rgb},0.1), 0 0 60px rgba(${style.rgb},0.05); }
          50% { box-shadow: 0 0 50px rgba(${style.rgb},0.15), 0 0 100px rgba(${style.rgb},0.08); }
        }
        @keyframes certShine {
          0% { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(300%) skewX(-15deg); }
        }
        @media print {
          nav, .no-print, header, footer { display: none !important; }
          body { background: white !important; }
          .cert-card { box-shadow: none !important; border: 2px solid #e5e7eb !important; }
        }
      `,
        }}
      />

      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="absolute -top-32 right-[20%] rounded-full opacity-[0.04]"
            style={{
              width: 700,
              height: 700,
              background: `radial-gradient(circle, ${style.color} 0%, transparent 70%)`,
            }}
          />
          <div
            className="absolute top-[60%] -left-20 rounded-full opacity-[0.03]"
            style={{
              width: 500,
              height: 500,
              background: "radial-gradient(circle, #6366F1 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative z-10 max-w-[600px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => router.push("/exam")}
            className="no-print flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={16} />
            К экзаменам
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="cert-card rounded-3xl overflow-hidden relative"
            style={{
              background: `linear-gradient(160deg, rgba(${style.rgb},0.06) 0%, rgba(255,255,255,0.02) 40%, rgba(${style.rgb},0.04) 100%)`,
              border: `2px solid rgba(${style.rgb},0.2)`,
              animation: "certGlow 4s ease-in-out infinite",
            }}
          >
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ borderRadius: "inherit", zIndex: 1 }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "40%",
                  height: "100%",
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
                  animation: "certShine 6s ease-in-out infinite",
                }}
              />
            </div>

            <div
              className="h-1.5"
              style={{
                background: `linear-gradient(90deg, transparent, rgba(${style.rgb},0.5), ${style.color}, rgba(${style.rgb},0.5), transparent)`,
              }}
            />

            <div className="relative z-[2] p-8 sm:p-10">
              <div className="text-center mb-8">
                <div
                  className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-4"
                  style={{
                    background: `linear-gradient(135deg, rgba(${style.rgb},0.15), rgba(${style.rgb},0.08))`,
                    border: `2px solid rgba(${style.rgb},0.3)`,
                    boxShadow: `0 8px 24px rgba(${style.rgb},0.15)`,
                  }}
                >
                  <Award size={36} style={{ color: style.color }} />
                </div>

                <div
                  className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2"
                  style={{ color: style.color }}
                >
                  Сертификат
                </div>
                <h1
                  className="text-xl sm:text-2xl font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {examTitle}
                </h1>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  HunterLite — Обучение банкротству (ФЗ-127)
                </p>
              </div>

              <div className="flex justify-center mb-8">
                <div
                  className="flex items-center gap-2 px-5 py-2 rounded-full"
                  style={{
                    background: "rgba(34,197,94,0.08)",
                    border: "1.5px solid rgba(34,197,94,0.25)",
                  }}
                >
                  <CheckCircle size={16} style={{ color: "var(--success)" }} />
                  <span className="text-sm font-bold" style={{ color: "var(--success)" }}>
                    Экзамен сдан
                  </span>
                </div>
              </div>

              <div
                className="grid grid-cols-2 gap-4 mb-8 p-5 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: style.color }}>
                    {attempt.score_percent}%
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Результат
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {attempt.correct_count}/{attempt.total_count}
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Верных ответов
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Дата выдачи
                  </span>
                  <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    {issuedDate}
                  </span>
                </div>
                <div
                  className="h-px"
                  style={{ background: "var(--border-color)" }}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Код верификации
                  </span>
                  <span
                    className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg"
                    style={{
                      background: `rgba(${style.rgb},0.08)`,
                      color: style.color,
                      border: `1px solid rgba(${style.rgb},0.15)`,
                    }}
                  >
                    {attempt.certificate_code}
                  </span>
                </div>
              </div>

              {verifyUrl && (
                <div
                  className="p-4 rounded-xl mb-6"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Ссылка для проверки
                  </div>
                  <div className="flex items-center gap-2">
                    <code
                      className="flex-1 text-[11px] break-all"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {verifyUrl}
                    </code>
                    <button
                      onClick={handleCopyLink}
                      className="shrink-0 p-2 rounded-lg transition-colors"
                      style={{
                        background: copied
                          ? "rgba(34,197,94,0.1)"
                          : `rgba(${style.rgb},0.08)`,
                        color: copied ? "var(--success)" : style.color,
                      }}
                      title="Копировать ссылку"
                    >
                      {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              className="h-1"
              style={{
                background: `linear-gradient(90deg, transparent, rgba(${style.rgb},0.3), transparent)`,
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="no-print mt-6 flex flex-wrap gap-3 justify-center"
          >
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
              style={{
                background: `rgba(${style.rgb},0.1)`,
                border: `1.5px solid rgba(${style.rgb},0.3)`,
                color: style.color,
              }}
            >
              <Share2 size={14} />
              Поделиться
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1.5px solid rgba(255,255,255,0.1)",
                color: "var(--text-secondary)",
              }}
            >
              <Download size={14} />
              Скачать PDF
            </button>
            {verifyUrl && (
              <button
                onClick={() =>
                  router.push(
                    `/exam/certificate/verify/${attempt.certificate_code}`
                  )
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1.5px solid rgba(255,255,255,0.1)",
                  color: "var(--text-secondary)",
                }}
              >
                <ExternalLink size={14} />
                Верификация
              </button>
            )}
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
