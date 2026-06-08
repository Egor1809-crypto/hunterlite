"use client";

/**
 * CertificatePreview — the product's trophy: «Сертификат аттестации».
 *
 * Light editorial diploma (landscape) in the platform's own aesthetic
 * (malvah.co + abstract.com): cream/white surface, ONE accent (purple),
 * hairline-only rules, hierarchy by scale, generous whitespace, letter-spaced
 * caps. Two variants:
 *   - "earned": awarded certificate with real name/score/date/code.
 *   - "locked": same face blurred behind an invitational lock + CTA.
 *
 * Palette-driven, so it works on the cream marketing landing AND inside the
 * token-themed app (light + dark) via the exported palettes.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Lock, ArrowRight, ShieldCheck } from "lucide-react";

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
  shadowMd: "0 30px 70px -34px rgba(24,19,29,0.30)",
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
  palette?: CertPalette;
  recipientName?: string;
  issueDate?: string;
  verificationCode?: string;
  program?: string;
  format?: string;
  /** Overrides the body paragraph; defaults to a sentence built from `program`. */
  programDescription?: string;
  /** Issuer name under the signature line. Defaults to "LegalHunter". */
  issuerName?: string;
  score?: string;
  award?: string;
  lockTitle?: string;
  lockSubtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
}

const DEFAULT_CODE = "LH-BFL-2026-001";
const DEFAULT_DATE = "29.05.2026";
const DEFAULT_PROGRAM = "Банкротство физических лиц";
const DEFAULT_FORMAT = "Онлайн-курс";

/* ── The diploma face (light editorial, landscape) ───────────────────────── */

function CertificateFace({
  p,
  recipientName,
  issueDate,
  verificationCode,
  program,
  format,
  programDescription,
  issuerName = "LegalHunter",
}: {
  p: CertPalette;
  recipientName?: string;
  issueDate: string;
  verificationCode: string;
  program: string;
  format: string;
  programDescription?: string;
  issuerName?: string;
}) {
  // Shared letter-spaced uppercase voice of the diploma — tiny mono eyebrows.
  const cap = (extra?: React.CSSProperties): React.CSSProperties => ({
    textTransform: "uppercase",
    letterSpacing: "0.22em",
    fontSize: "clamp(6.5px, 0.95vw, 9px)",
    fontWeight: 600,
    lineHeight: 1,
    color: p.textMuted,
    ...extra,
  });

  const meta = [
    { label: "Программа", value: program },
    { label: "Формат", value: format },
    { label: "Дата выдачи", value: issueDate },
  ];

  const body =
    programDescription ??
    `успешно прошёл курс по программе «${program}» и подтвердил освоение ключевых практических аспектов сопровождения процедур банкротства граждан.`;

  return (
    <div
      className="relative flex h-full w-full"
      style={{ background: p.surface, color: p.textPrimary, padding: "clamp(9px, 2.2%, 20px)" }}
    >
      {/* Engraved hairline frame */}
      <div
        className="relative flex h-full w-full flex-col"
        style={{ border: `1px solid ${p.hairline}`, borderRadius: 3, padding: "clamp(16px, 4.4%, 42px)" }}
      >
        {/* Corner registration ticks (abstract.com flavour) */}
        {(["tl", "tr", "bl", "br"] as const).map((c) => {
          const isTop = c[0] === "t";
          const isLeft = c[1] === "l";
          return (
            <span
              key={c}
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                width: 10,
                height: 10,
                [isTop ? "top" : "bottom"]: -1,
                [isLeft ? "left" : "right"]: -1,
                borderTop: isTop ? `1px solid ${p.accent}` : "none",
                borderBottom: !isTop ? `1px solid ${p.accent}` : "none",
                borderLeft: isLeft ? `1px solid ${p.accent}` : "none",
                borderRight: !isLeft ? `1px solid ${p.accent}` : "none",
              }}
            />
          );
        })}

        {/* Very subtle guilloché — concentric engraving behind the title, centred */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: "50%",
            top: "42%",
            width: "62%",
            aspectRatio: "1 / 1",
            transform: "translate(-50%, -50%)",
            opacity: 0.5,
            backgroundImage: `repeating-radial-gradient(circle, transparent 0 7px, ${p.hairline} 7px 7.5px)`,
            maskImage: "radial-gradient(closest-side, #000 10%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(closest-side, #000 10%, transparent 72%)",
          }}
        />

        {/* TOP ROW — wordmark · centred discipline · sub-brand */}
        <div className="relative flex items-center justify-between gap-3">
          <span style={{ fontSize: "clamp(11px, 1.6vw, 15px)", fontWeight: 800, letterSpacing: "0.02em", color: p.textPrimary }}>
            LEGAL<span style={{ color: p.accent }}>HUNTER</span>
          </span>
          <span className="hidden items-center gap-2 sm:flex" style={cap()}>
            <span style={{ width: 16, height: 1, background: p.hairline }} />
            Свидетельство об аттестации
            <span style={{ width: 16, height: 1, background: p.hairline }} />
          </span>
          <span style={cap({ color: p.accent })}>ТехнологИИ&nbsp;Права</span>
        </div>

        <span style={{ marginTop: "clamp(8px, 2%, 16px)", display: "block", height: 1, background: p.hairline }} />

        {/* TITLE BLOCK — eyebrow code over a huge display title */}
        <div className="relative" style={{ marginTop: "clamp(12px, 3.2%, 30px)" }}>
          <div className="flex items-baseline gap-3">
            <span style={cap({ color: p.textSecondary, letterSpacing: "0.3em" })}>Сертификат&nbsp;аттестации</span>
            <span style={cap({ fontVariantNumeric: "tabular-nums", letterSpacing: "0.14em" })}>RU&middot;ATT</span>
          </div>
          <h3 style={{ marginTop: "clamp(4px, 1%, 10px)", fontSize: "clamp(34px, 9vw, 76px)", lineHeight: 0.88, fontWeight: 600, letterSpacing: "-0.05em", color: p.textPrimary }}>
            Сертифи<span style={{ color: p.accent }}>кат</span>
          </h3>
        </div>

        {/* RECIPIENT */}
        <div style={{ marginTop: "clamp(16px, 3.6%, 30px)", ...cap({ color: p.textSecondary, letterSpacing: "0.2em" }) }}>
          Настоящим подтверждается, что
        </div>
        <div className="relative" style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
          <div
            style={{
              marginTop: "clamp(6px, 1.6%, 13px)",
              fontSize: "clamp(24px, 6vw, 46px)",
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.0,
              color: recipientName ? p.textPrimary : p.textMuted,
            }}
          >
            {recipientName ?? "Имя Фамилия"}
          </div>
          <span
            style={{
              marginTop: "clamp(6px, 1.4%, 11px)",
              display: "block",
              height: 1,
              background: p.accent,
            }}
          />
        </div>

        {/* BODY */}
        <p style={{ marginTop: "clamp(11px, 2.8%, 22px)", maxWidth: 580, fontSize: "clamp(10px, 1.5vw, 13px)", lineHeight: 1.6, color: p.textSecondary }}>
          {body}
        </p>

        <div className="flex-1" style={{ minHeight: 10 }} />

        {/* META — three columns divided by air + hairline ticks (no boxes) */}
        <div
          className="relative grid grid-cols-3"
          style={{ marginTop: "clamp(10px, 2.4%, 18px)", borderTop: `1px solid ${p.hairline}` }}
        >
          {meta.map(({ label, value }, i) => (
            <div
              key={label}
              style={{
                position: "relative",
                padding: "clamp(9px, 1.9%, 15px) clamp(2px, 1.2%, 14px) 0",
                borderLeft: i === 0 ? "none" : `1px solid ${p.hairline}`,
              }}
            >
              {/* registration tick at top of each column */}
              <span aria-hidden style={{ position: "absolute", top: -1, left: i === 0 ? 0 : -1, width: 1, height: 6, background: p.accent }} />
              <div className="flex items-center gap-1.5" style={cap({ fontSize: "clamp(6px, 0.85vw, 7.5px)" })}>
                <span style={{ fontVariantNumeric: "tabular-nums", color: p.accent }}>{`0${i + 1}`}</span>
                {label}
              </div>
              <div className="truncate" style={{ marginTop: 5, fontSize: "clamp(9px, 1.4vw, 12.5px)", fontWeight: 600, letterSpacing: "-0.01em", color: p.textPrimary }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER — cert № · signature · engraved seal */}
        <div className="flex items-end justify-between gap-3" style={{ marginTop: "clamp(12px, 3%, 24px)" }}>
          <div>
            <span style={cap({ fontSize: "clamp(6px, 0.85vw, 7px)" })}>Сертификат №</span>
            <div
              style={{
                marginTop: 6,
                fontSize: "clamp(9px, 1.3vw, 12px)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                fontVariantNumeric: "tabular-nums",
                color: p.textPrimary,
              }}
            >
              {verificationCode}
            </div>
          </div>

          <div className="hidden flex-col items-center sm:flex">
            <span style={{ marginBottom: 7, fontSize: "clamp(11px, 1.6vw, 15px)", fontWeight: 700, letterSpacing: "-0.01em", color: p.textPrimary, fontStyle: "italic" }}>
              {issuerName}
            </span>
            <span style={{ width: "clamp(110px, 17vw, 168px)", height: 1, background: p.hairline }} />
            <span style={{ marginTop: 7, ...cap({ fontSize: "clamp(6px, 0.85vw, 7px)" }) }}>Подпись комиссии</span>
          </div>

          {/* Engraved verification seal — double hairline rings + curved legend */}
          <div className="flex flex-col items-center" style={{ gap: 6 }}>
            <span
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: "clamp(46px, 8.4vw, 64px)",
                height: "clamp(46px, 8.4vw, 64px)",
                border: `1px solid ${p.accent}`,
                boxShadow: `inset 0 0 0 3px ${p.surface}, inset 0 0 0 4px ${p.hairline}`,
              }}
            >
              <ShieldCheck size={20} strokeWidth={1.25} style={{ color: p.accent, width: "38%", height: "38%" }} />
              {/* eight engraving ticks around the ring */}
              {Array.from({ length: 8 }).map((_, k) => (
                <span
                  key={k}
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 1,
                    height: 3,
                    background: p.hairline,
                    transformOrigin: "center -22px",
                    transform: `translate(-50%, -50%) rotate(${k * 45}deg)`,
                  }}
                />
              ))}
            </span>
            <span style={cap({ fontSize: "clamp(5.5px, 0.8vw, 7px)", color: p.accent, letterSpacing: "0.26em" })}>Проверено</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── The component ────────────────────────────────────────────────────────── */

export function CertificatePreview({
  variant,
  palette = CERT_LIGHT_PALETTE,
  recipientName,
  issueDate = DEFAULT_DATE,
  verificationCode = DEFAULT_CODE,
  program = DEFAULT_PROGRAM,
  format = DEFAULT_FORMAT,
  programDescription,
  issuerName = "LegalHunter",
  lockTitle = "Пройдите курс — и получите сертификат.",
  lockSubtitle,
  ctaLabel = "Начать обучение",
  onCta,
  className,
}: CertificatePreviewProps) {
  const reduce = useReducedMotion();
  const locked = variant === "locked";
  const p = palette;

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{ width: "100%", maxWidth: 760, marginInline: "auto" }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: "1.414 / 1",
          borderRadius: 10,
          border: `1px solid ${p.hairline}`,
          boxShadow: p.shadowMd,
          background: p.surface,
        }}
      >
        {/* face (blurred when locked) */}
        <div
          aria-hidden={locked}
          style={
            locked
              ? { position: "absolute", inset: 0, filter: "blur(5px)", opacity: 0.55, transform: "scale(1.02)" }
              : { position: "absolute", inset: 0 }
          }
        >
          <CertificateFace p={p} recipientName={recipientName} issueDate={issueDate} verificationCode={verificationCode} program={program} format={format} programDescription={programDescription} issuerName={issuerName} />
        </div>

        {/* locked overlay */}
        {locked && (
          <>
            <div aria-hidden className="absolute inset-0" style={{ background: p.surface, opacity: 0.78 }} />
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
              style={{ padding: "clamp(20px,7%,44px)" }}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
            >
              <span
                className="inline-flex items-center gap-2"
                style={{ textTransform: "uppercase", letterSpacing: "0.26em", fontSize: "clamp(7px,1vw,9px)", fontWeight: 600, color: p.textMuted }}
              >
                <Lock size={11} strokeWidth={2} style={{ color: p.accent }} />
                Ещё не выдан
              </span>
              <h4 style={{ marginTop: 16, maxWidth: 360, fontSize: "clamp(20px,4.4vw,30px)", lineHeight: 1.12, fontWeight: 600, letterSpacing: "-0.035em", color: p.textPrimary }}>
                {lockTitle}
              </h4>
              {lockSubtitle && (
                <p style={{ marginTop: 12, maxWidth: 340, fontSize: 13, lineHeight: 1.5, color: p.textSecondary }}>{lockSubtitle}</p>
              )}
              {onCta && (
                <motion.button
                  onClick={onCta}
                  className="mt-7 inline-flex items-center gap-2"
                  style={{ background: p.textPrimary, color: p.surface, fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", padding: "13px 28px", borderRadius: 999 }}
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
