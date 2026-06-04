"use client";

/**
 * ConsentGate — 152-ФЗ personal-data consent acceptance screen.
 *
 * The backend gates training-start (and /home data) behind
 * `check_consent_accepted`, returning 403 until the user has an accepted
 * `UserConsent` row. Previously the frontend only *read* `/consent/status` and
 * bounced un-consented users to /home (which itself needs consent) — a dead end
 * that no real (non-demo) user could escape. This screen lets them accept.
 *
 * Flow: GET /consent/status → POST /consent/ for every entry in `missing` →
 * call onAccepted(). Platform-token styling (light + dark), one accent.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, AlertTriangle, ArrowRight, Check } from "lucide-react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

interface MissingConsent {
  consent_type: string;
  version: string;
}
interface ConsentStatus {
  all_accepted: boolean;
  missing: MissingConsent[];
}

export default function ConsentGate({ onAccepted }: { onAccepted: () => void }) {
  const [missing, setMissing] = useState<MissingConsent[] | null>(null);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch what's missing (also short-circuits if already accepted elsewhere).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = (await api.get("/consent/status")) as ConsentStatus;
        if (cancelled) return;
        if (data.all_accepted) {
          onAccepted();
          return;
        }
        setMissing(data.missing ?? [{ consent_type: "personal_data_processing", version: "1.0" }]);
      } catch (e) {
        if (cancelled) return;
        logger.error("[ConsentGate] status error:", e);
        // Fall back to the known required consent so the user is never stuck.
        setMissing([{ consent_type: "personal_data_processing", version: "1.0" }]);
      }
    })();
    return () => { cancelled = true; };
  }, [onAccepted]);

  const accept = async () => {
    if (!checked || submitting || !missing) return;
    setSubmitting(true);
    setError(null);
    try {
      for (const m of missing) {
        try {
          await api.post("/consent/", { consent_type: m.consent_type, version: m.version });
        } catch (e: unknown) {
          // 409 = already accepted (race / double-submit) — treat as success.
          const msg = e instanceof Error ? e.message : "";
          if (!/409|already/i.test(msg)) throw e;
        }
      }
      onAccepted();
    } catch (e) {
      logger.error("[ConsentGate] accept error:", e);
      setError("Не удалось сохранить согласие. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10" style={{ background: "var(--bg-primary)" }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-[560px] overflow-hidden rounded-[24px]"
        style={{ background: "var(--surface-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-lg)" }}
      >
        {/* accent strip */}
        <div className="h-1 w-full" style={{ background: "var(--primary)" }} />

        <div className="px-7 py-8 sm:px-10 sm:py-10">
          <div className="flex items-center gap-3.5">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "var(--primary-muted)", border: "1px solid var(--border-color)" }}
            >
              <ShieldCheck size={24} strokeWidth={1.9} style={{ color: "var(--primary)" }} />
            </span>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                152-ФЗ · доступ к обучению
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Согласие на обработку данных
              </h1>
            </div>
          </div>

          <p className="mt-6 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Для доступа к тренажёрам, экзаменам и AI-ассистенту нам нужно ваше согласие на
            обработку персональных данных в соответствии с Федеральным законом № 152-ФЗ
            «О персональных данных».
          </p>

          <ul className="mt-4 space-y-2.5">
            {[
              "Данные используются только для вашего обучения и оценки результатов.",
              "Мы не передаём их третьим лицам и не используем в маркетинге без отдельного согласия.",
              "Согласие можно отозвать, обратившись в поддержку.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <Check size={15} strokeWidth={2.4} className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          {/* consent checkbox */}
          <button
            type="button"
            onClick={() => setChecked((v) => !v)}
            disabled={!missing}
            className="mt-6 flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors disabled:opacity-50"
            style={{
              background: checked ? "var(--primary-muted)" : "var(--bg-secondary)",
              border: `1px solid ${checked ? "var(--primary)" : "var(--border-color)"}`,
            }}
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors"
              style={{
                background: checked ? "var(--primary)" : "transparent",
                border: `1.5px solid ${checked ? "var(--primary)" : "var(--border-color)"}`,
              }}
            >
              {checked && <Check size={13} strokeWidth={3} style={{ color: "#fff" }} />}
            </span>
            <span className="text-[13.5px] leading-snug" style={{ color: "var(--text-primary)" }}>
              Я даю согласие на обработку моих персональных данных в соответствии с 152-ФЗ.
            </span>
          </button>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-[13px]" style={{ color: "var(--danger)" }}>
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          <motion.button
            onClick={accept}
            disabled={!checked || submitting || !missing}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full py-4 text-[15px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--primary)", color: "#fff" }}
            whileHover={checked && !submitting ? { scale: 1.01 } : undefined}
            whileTap={checked && !submitting ? { scale: 0.99 } : undefined}
          >
            {submitting ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <>
                Принять и продолжить
                <ArrowRight size={16} />
              </>
            )}
          </motion.button>

          {!missing && (
            <div className="mt-4 flex items-center justify-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
              <Loader2 size={13} className="animate-spin" /> Загрузка…
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
