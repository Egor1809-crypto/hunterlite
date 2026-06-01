"use client";

/**
 * CertificatePreview — the product's trophy.
 *
 * A restrained, editorial A-paper diploma. Two variants:
 *   - "earned": the crisp awarded certificate.
 *   - "locked": the same face blurred/dimmed behind an invitational lock + CTA
 *               (marketing teaser — "almost yours", never "denied").
 *
 * Palette-agnostic: every colour comes from `palette`, so it works on the
 * fixed-light marketing landing AND inside the token-themed app (light + dark).
 *
 * Design grounding (mandatory, malvah.co + abstract.com):
 *   - quiet classification code (LEGALHUNTER · ФЗ-127, LH-127…) — malvah
 *   - hierarchy by scale not weight; whitespace as the divider — malvah
 *   - ONE accent, ONE authority claim; hairline-only rules — abstract
 */

import { motion, useReducedMotion } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";

export interface CertPalette {
  bg: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  hairline: string;
  accent: string;
  shadowMd: string;
}

/** Fixed light palette for the marketing landing (matches its print-like hex). */
export const CERT_LIGHT_PALETTE: CertPalette = {
  bg: "#F7F1E8",
  surface: "#FFFDF8",
  textPrimary: "#18131D",
  textSecondary: "#5F5367",
  textMuted: "#9B7DB4",
  hairline: "#D9C9E8",
  accent: "#7C3AED",
  shadowMd: "0 24px 60px -28px rgba(24,19,29,0.28)",
};

/** Token palette for in-app usage (resolves correctly in light AND dark). */
export const CERT_TOKEN_PALETTE: CertPalette = {
  bg: "var(--bg-secondary)",
  surface: "var(--surface-card)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  hairline: "var(--border-color)",
  accent: "var(--primary)",
  shadowMd: "var(--shadow-md)",
};

interface CertificatePreviewProps {
  variant: "locked" | "earned";
  palette: CertPalette;
  recipientName?: string;
  issueDate?: string;
  verificationCode?: string;
  award?: string;
  lockTitle?: string;
  lockSubtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}

const DEFAULT_AWARD = "Эксперт в процедуре банкротства физических лиц";
const DEFAULT_CODE = "LH-127-04◦25";
const DEFAULT_DATE = "31.05.2026";

/* ── The diploma face ─────────────────────────────────────────────────────── */

function CertificateFace({
  p,
  recipientName,
  issueDate,
  verificationCode,
  award,
}: {
  p: CertPalette;
  recipientName?: string;
  issueDate: string;
  verificationCode: string;
  award: string;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col"
      style={{
        background: p.surface,
        padding: "clamp(20px, 5.5%, 40px)",
      }}
    >
      {/* inner hairline frame — the classic diploma double-rule */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ inset: 14, border: `1px solid ${p.hairline}` }}
      />

      <div className="relative flex h-full flex-col" style={{ padding: "clamp(8px, 2%, 18px)" }}>
        {/* eyebrow / classification code */}
        <div
          className="font-mono uppercase"
          style={{ fontSize: 10.5, letterSpacing: "0.18em", color: p.textMuted }}
        >
          LEGALHUNTER · ФЗ-127
        </div>

        {/* kicker */}
        <div
          className="uppercase"
          style={{ marginTop: "clamp(20px,5%,36px)", fontSize: 12, letterSpacing: "0.32em", color: p.textSecondary }}
        >
          Сертификат
        </div>

        {/* award title — the only large element */}
        <h3
          style={{
            marginTop: 12,
            fontSize: "clamp(20px, 5.5vw, 27px)",
            lineHeight: 1.16,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: p.textPrimary,
          }}
        >
          {award}
        </h3>

        {/* hairline rule */}
        <div style={{ marginTop: "clamp(14px,3%,24px)", height: 1, width: "100%", background: p.hairline }} />

        {/* lead-in + recipient */}
        <div style={{ marginTop: "clamp(12px,3%,20px)", fontSize: 12.5, color: p.textSecondary }}>
          Настоящим удостоверяется, что
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: "clamp(18px,4.5vw,23px)",
            fontWeight: 500,
            letterSpacing: "0.01em",
            color: recipientName ? p.textPrimary : p.textMuted,
          }}
        >
          {recipientName ?? "—————————"}
        </div>

        {/* authority line — THE single claim, carries the single accent */}
        <div className="flex items-center gap-2" style={{ marginTop: "clamp(10px,2.5%,16px)" }}>
          <span aria-hidden style={{ width: 4, height: 4, background: p.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, color: p.textSecondary }}>Заверено практикующими юристами РФ</span>
        </div>

        {/* push footer down */}
        <div className="flex-1" style={{ minHeight: 16 }} />

        {/* footer — three baseline-aligned columns */}
        <div className="flex items-end justify-between gap-3">
          {/* seal + commission */}
          <div className="flex items-center gap-2.5">
            <span
              className="relative flex items-center justify-center rounded-full"
              style={{ width: 44, height: 44, border: `1px solid ${p.hairline}` }}
            >
              <span aria-hidden className="absolute rounded-full" style={{ inset: 4, border: `1px solid ${p.hairline}` }} />
              <span style={{ fontSize: 13, letterSpacing: "0.04em", color: p.textSecondary }}>ЛХ</span>
            </span>
            <span className="font-mono uppercase" style={{ fontSize: 9.5, letterSpacing: "0.1em", color: p.textMuted, lineHeight: 1.4 }}>
              Комиссия<br />ЛегалХантер
            </span>
          </div>

          {/* signature line */}
          <div className="hidden flex-col items-center sm:flex">
            <span style={{ width: 110, height: 1, background: p.hairline }} />
            <span style={{ marginTop: 5, fontSize: 9.5, color: p.textMuted }}>Подпись комиссии</span>
          </div>

          {/* code + date */}
          <div className="text-right font-mono" style={{ fontSize: 9.5, color: p.textMuted, lineHeight: 1.5 }}>
            <div style={{ letterSpacing: "0.04em" }}>{verificationCode}</div>
            <div>Выдан {issueDate}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── The component ────────────────────────────────────────────────────────── */

export function CertificatePreview({
  variant,
  palette: p,
  recipientName,
  issueDate = DEFAULT_DATE,
  verificationCode = DEFAULT_CODE,
  award = DEFAULT_AWARD,
  lockTitle = "Пройдите курс — и получите сертификат.",
  lockSubtitle,
  ctaLabel = "Начать обучение",
  onCta,
  className,
}: CertificatePreviewProps) {
  const reduce = useReducedMotion();
  const locked = variant === "locked";

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ width: "100%", maxWidth: 460, marginInline: "auto" }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: "1 / 1.414",
          borderRadius: 8,
          border: `1px solid ${p.hairline}`,
          boxShadow: p.shadowMd,
          background: p.surface,
        }}
      >
        {/* face (blurred + dimmed when locked) */}
        <div
          aria-hidden={locked}
          style={
            locked
              ? { position: "absolute", inset: 0, filter: "blur(5px)", opacity: 0.55, transform: "scale(1.02)" }
              : { position: "absolute", inset: 0 }
          }
        >
          <CertificateFace
            p={p}
            recipientName={recipientName}
            issueDate={issueDate}
            verificationCode={verificationCode}
            award={award}
          />
        </div>

        {/* locked overlay */}
        {locked && (
          <>
            {/* scrim — real div, not backdrop-filter (Safari-safe) */}
            <div aria-hidden className="absolute inset-0" style={{ background: p.surface, opacity: 0.72 }} />

            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
              style={{ padding: "clamp(20px,7%,40px)" }}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
            >
              <span
                className="flex items-center justify-center rounded-full"
                style={{ width: 64, height: 64, border: `1px solid ${p.hairline}`, background: p.surface }}
              >
                <Lock size={28} strokeWidth={1.5} style={{ color: p.textSecondary }} />
              </span>

              <h4
                style={{ marginTop: 20, maxWidth: 300, fontSize: "clamp(18px,4.5vw,23px)", lineHeight: 1.25, fontWeight: 500, letterSpacing: "-0.01em", color: p.textPrimary }}
              >
                {lockTitle}
              </h4>

              {lockSubtitle && (
                <p style={{ marginTop: 10, maxWidth: 300, fontSize: 13.5, lineHeight: 1.45, color: p.textSecondary }}>
                  {lockSubtitle}
                </p>
              )}

              {onCta && (
                <motion.button
                  onClick={onCta}
                  className="mt-6 inline-flex items-center gap-2"
                  style={{
                    background: p.accent,
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 600,
                    padding: "13px 26px",
                    borderRadius: 10,
                  }}
                  whileHover={reduce ? undefined : { scale: 1.02 }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                >
                  {ctaLabel}
                  <ArrowRight size={16} />
                </motion.button>
              )}
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
