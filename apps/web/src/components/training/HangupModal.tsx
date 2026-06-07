"use client";

import { motion, AnimatePresence } from "framer-motion";
import { PhoneOff, Phone, BarChart3 } from "lucide-react";
import type { HangupData } from "@/types";

interface HangupModalProps {
  open: boolean;
  data: HangupData | null;
  onRedial: () => void;
  onResults: () => void;
}

export function HangupModal({ open, data, onRedial, onResults }: HangupModalProps) {
  if (!data) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "var(--overlay-bg)", backdropFilter: "blur(8px)" }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Клиент повесил трубку"
            initial={{ scale: 0.8, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md p-6 overflow-hidden"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-2xl)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Icon */}
            <div className="relative flex justify-center mb-4">
              <div
                className="flex items-center justify-center w-16 h-16 rounded-full"
                style={{
                  background: "var(--danger-muted)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <PhoneOff size={28} style={{ color: "var(--danger)" }} />
              </div>
            </div>

            {/* Title */}
            <h2
              className="relative text-center text-lg font-semibold mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              Клиент положил трубку
            </h2>

            {/* Hangup phrase */}
            <div
              className="relative rounded-xl p-4 mb-4"
              style={{
                background: "var(--danger-muted)",
                border: "1px solid var(--border-color)",
              }}
            >
              <p
                className="text-sm italic text-center"
                style={{ color: "var(--text-primary)" }}
              >
                &ldquo;{data.hangupPhrase}&rdquo;
              </p>
            </div>

            {/* Reason */}
            <p
              className="relative text-center text-xs mb-6"
              style={{ color: "var(--text-muted)" }}
            >
              {data.reason}
            </p>

            {/* Actions */}
            <div className="relative flex gap-3">
              {data.canContinue ? (
                <>
                  <button
                    onClick={onRedial}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: "var(--accent-muted)",
                      border: "1px solid var(--border-color)",
                      color: "var(--accent)",
                    }}
                  >
                    <Phone size={16} />
                    Перезвонить
                  </button>
                  <button
                    onClick={onResults}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <BarChart3 size={16} />
                    К результатам
                  </button>
                </>
              ) : (
                <button
                  onClick={onResults}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <BarChart3 size={16} />
                  К результатам
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
