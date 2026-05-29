"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import { useSound } from "@/hooks/useSound";
import { Confetti } from "@/components/ui/Confetti";

interface PostSessionVerdictProps {
  score: number;
  onContinue: () => void;
  xpGained?: number;
}

function getVerdict(score: number): { word: string; wordRu: string; color: string; glow: string } {
  if (score >= 90) return { word: "DOMINANT", wordRu: "ДОМИНИРУЮЩИЙ", color: "var(--success)", glow: "color-mix(in srgb, var(--success) 50%, transparent)" };
  if (score >= 75) return { word: "CONFIDENT", wordRu: "УВЕРЕННЫЙ", color: "var(--accent)", glow: "color-mix(in srgb, var(--accent) 50%, transparent)" };
  if (score >= 60) return { word: "STEADY", wordRu: "СТАБИЛЬНЫЙ", color: "var(--gf-xp)", glow: "color-mix(in srgb, var(--gf-xp) 50%, transparent)" };
  if (score >= 40) return { word: "HESITANT", wordRu: "НЕУВЕРЕННЫЙ", color: "var(--info)", glow: "color-mix(in srgb, var(--info) 50%, transparent)" };
  return { word: "LOST CONTROL", wordRu: "ПОТЕРЯЛ КОНТРОЛЬ", color: "var(--danger)", glow: "color-mix(in srgb, var(--danger) 50%, transparent)" };
}

export function PostSessionVerdict({ score, onContinue, xpGained = 0 }: PostSessionVerdictProps) {
  const [phase, setPhase] = useState<"counting" | "verdict" | "details">("counting");
  const [displayScore, setDisplayScore] = useState(0);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const { playSound } = useSound();
  const verdict = getVerdict(score);
  const isPerfect = score >= 90;

  // Count-up animation
  useEffect(() => {
    if (phase !== "counting") return;
    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(score, Math.round(increment * step));
      setDisplayScore(current);

      if (step >= steps) {
        clearInterval(timer);
        setDisplayScore(score);
        setTimeout(() => setPhase("verdict"), 300);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [phase, score]);

  // Auto-advance to details
  useEffect(() => {
    if (phase === "verdict") {
      // Trigger confetti for perfect scores
      if (isPerfect) {
        setConfettiTrigger((n) => n + 1);
        playSound("legendary");
      }
      const timer = setTimeout(() => setPhase("details"), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, isPerfect, playSound]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        backgroundColor: "var(--bg-primary)",
        backgroundImage: `
          radial-gradient(circle at 50% 38%, ${verdict.glow} 0%, transparent 28%),
          radial-gradient(circle at 18% 18%, rgba(59,130,246,0.12) 0%, transparent 24%),
          radial-gradient(circle at 80% 72%, rgba(168,85,247,0.12) 0%, transparent 26%),
          linear-gradient(180deg, rgba(255,255,255,0.02), transparent 45%)
        `,
      }}
    >
      <Confetti trigger={confettiTrigger} />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(circle at 50% 45%, #000 0%, transparent 72%)",
        }}
      />

      <div className="relative z-[202] w-full max-w-4xl px-6 text-center">
        <AnimatePresence mode="wait">
          {/* Phase 1: Score count-up */}
          {phase === "counting" && (
            <motion.div
              key="counting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
            >
              {/* Gold frame for perfect scores */}
              <div className="relative inline-block">
                {isPerfect && (
                  <>
                    {/* Rotating stars around the score */}
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className="absolute"
                        style={{
                          top: i === 0 ? -20 : i === 2 ? undefined : "50%",
                          bottom: i === 2 ? -20 : undefined,
                          left: i === 3 ? -20 : i === 1 ? undefined : "50%",
                          right: i === 1 ? -20 : undefined,
                          transform: "translate(-50%, -50%)",
                        }}
                        animate={{
                          rotate: 360,
                          scale: [0.6, 1, 0.6],
                        }}
                        transition={{
                          rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                          scale: { duration: 2, repeat: Infinity, delay: i * 0.5 },
                        }}
                      >
                        <Star size={18} fill="var(--gf-xp)" style={{ color: "var(--gf-xp)", filter: "drop-shadow(0 0 6px rgba(255, 215, 0, 0.6))" }} />
                      </motion.div>
                    ))}
                    {/* Gold glow ring */}
                    <motion.div
                      className="absolute inset-[-24px] rounded-full pointer-events-none"
                      style={{
                        border: "2px solid rgba(255, 215, 0, 0.3)",
                        boxShadow: "0 0 40px rgba(255, 215, 0, 0.15), inset 0 0 40px rgba(255, 215, 0, 0.05)",
                      }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </>
                )}
                <motion.div
                  className="font-display font-bold"
                  style={{
                    fontSize: "140px",
                    lineHeight: 1,
                    color: verdict.color,
                    textShadow: `0 0 60px ${verdict.glow}`,
                  }}
                >
                  {displayScore}
                </motion.div>
              </div>
              <div className="font-medium text-2xl tracking-wide mt-3" style={{ color: "var(--text-muted)" }}>
                ИТОГОВЫЙ БАЛЛ
              </div>
            </motion.div>
          )}

          {/* Phase 2: Verdict word — Russian primary, pixel font, sharp rendering */}
          {phase === "verdict" && (
            <motion.div
              key="verdict"
              initial={{ scale: 3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="space-y-4"
            >
              {/* Full-screen color flash */}
              <div
                className="fixed inset-0 emotion-flash pointer-events-none z-[203]"
                style={{ background: verdict.color }}
              />
              <div
                className="font-bold tracking-wide glitch-text"
                data-text={verdict.wordRu}
                style={{
                  // Pixel font (VT323) needs explicit crisp rendering; the
                  // browser otherwise smooths it like a regular font and the
                  // pixel grid disappears.
                  fontSize: "120px",
                  lineHeight: 1,
                  color: verdict.color,
                  textShadow: `0 0 60px ${verdict.glow}, 0 0 120px ${verdict.glow}`,
                  WebkitFontSmoothing: "none",
                  MozOsxFontSmoothing: "grayscale",
                  imageRendering: "pixelated",
                  letterSpacing: "0.05em",
                }}
              >
                {verdict.wordRu}
              </div>
            </motion.div>
          )}

          {/* Phase 3: Summary + continue */}
          {phase === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
	              className="mx-auto max-w-3xl rounded-[28px] border px-6 py-10 shadow-2xl md:px-12 md:py-12"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))",
                  borderColor: "rgba(255,255,255,0.12)",
                  boxShadow: `0 30px 90px rgba(0,0,0,0.42), 0 0 80px ${verdict.glow}`,
                  backdropFilter: "blur(28px) saturate(1.25)",
                  WebkitBackdropFilter: "blur(28px) saturate(1.25)",
                }}
	            >
	              {/* Score with optional gold frame */}
	              <div className="relative inline-flex flex-col items-center">
	                {isPerfect && (
                  <motion.div
                    className="absolute inset-[-16px] rounded-2xl pointer-events-none"
                    style={{
                      border: "2px solid rgba(255, 215, 0, 0.4)",
                      boxShadow: "0 0 30px rgba(255, 215, 0, 0.15)",
                      background: "linear-gradient(135deg, rgba(255, 215, 0, 0.05), transparent)",
                    }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                  <div
                    className="relative mb-6 flex h-48 w-48 items-center justify-center rounded-full md:h-56 md:w-56"
                    style={{
                      background: `conic-gradient(${verdict.color} ${Math.max(0, Math.min(100, score)) * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                      boxShadow: `0 0 42px ${verdict.glow}`,
                    }}
                  >
                    <div
                      className="absolute inset-[10px] rounded-full"
                      style={{ background: "rgba(5,7,13,0.92)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
	                  <div className="relative">
                      <div
                        className="font-display text-6xl font-bold md:text-7xl"
                        style={{ color: "var(--text-primary)", textShadow: `0 0 30px ${verdict.glow}` }}
                      >
                        {score.toFixed(1)}
                        <span className="text-2xl" style={{ color: "var(--text-muted)" }}>/100</span>
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.28em]" style={{ color: verdict.color }}>
                        Общий балл
                      </div>
                    </div>
	                </div>
	                <div
	                  className="font-display text-3xl font-bold uppercase tracking-wide md:text-5xl"
	                  style={{
	                    color: verdict.color,
	                    textShadow: `0 0 32px ${verdict.glow}`,
	                    letterSpacing: "0.05em",
	                  }}
	                >
	                  {verdict.wordRu}
	                </div>
                  <p className="mt-4 max-w-xl text-base md:text-lg" style={{ color: "var(--text-secondary)" }}>
                    Разбор готов: сильные места, ошибки, динамика клиента и рекомендации AI-коуча собраны ниже.
                  </p>
	              </div>

	              {/* XP gained */}
	              {xpGained > 0 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
	                  className="inline-flex items-center gap-2 rounded-full px-5 py-2"
                  style={{
                    background: "var(--accent-muted)",
                    border: "1px solid var(--accent)",
                    boxShadow: `0 0 20px ${verdict.glow}`,
                  }}
	                >
                    <Star size={16} fill="currentColor" style={{ color: "var(--accent)" }} />
	                  <span className="font-display text-lg font-bold" style={{ color: "var(--accent)" }}>
	                    +{xpGained} XP
	                  </span>
	                </motion.div>
	              )}

	              {/* Continue button */}
	              <motion.button
	                onClick={onContinue}
	                className="mt-8 flex items-center gap-2 mx-auto rounded-2xl px-8 py-4 text-lg font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${verdict.color}, color-mix(in srgb, ${verdict.color} 60%, #ffffff 18%))`,
                    color: "#05070d",
                    boxShadow: `0 18px 48px ${verdict.glow}`,
                  }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Разбор полёта
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
