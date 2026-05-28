"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import Image from "next/image";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Message {
  role: "user" | "assistant";
  content: string;
}

/* ------------------------------------------------------------------ */
/*  Quick-action chips shown in the empty state                        */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  "Что такое банкротство?",
  "Расскажи о процедурах",
  "Помоги с клиентом",
  "Какие документы нужны?",
];

/* ------------------------------------------------------------------ */
/*  Gzhel color palette — matching reference project                   */
/* ------------------------------------------------------------------ */

const GZHEL = {
  primary: "#1565C0",
  primaryLight: "#42A5F5",
  accent: "#2196F3",
  bgPanel: "rgba(10, 18, 40, 0.98)",
  border: "rgba(21, 101, 192, 0.2)",
  borderActive: "rgba(21, 101, 192, 0.45)",
  glow: "rgba(33, 150, 243, 0.25)",
  glowStrong: "rgba(33, 150, 243, 0.45)",
  textMuted: "rgba(255, 255, 255, 0.45)",
};

/* ------------------------------------------------------------------ */
/*  Inline keyframes (injected once) — Gzhel blue theme                */
/* ------------------------------------------------------------------ */

const KEYFRAMES_ID = "manyasha-keyframes";

function ensureKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes manyasha-float {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-6px); }
    }
    @keyframes manyasha-bubble-pop {
      0%   { transform: scale(0) translateY(10px); opacity: 0; }
      60%  { transform: scale(1.05) translateY(-2px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes manyasha-glow-breathe {
      0%, 100% { filter: drop-shadow(0 0 12px ${GZHEL.glow}); }
      50%      { filter: drop-shadow(0 0 24px ${GZHEL.glowStrong}); }
    }
    @keyframes manyasha-border-glow {
      0%, 100% { opacity: 0.4; }
      50%      { opacity: 1; }
    }
    .manyasha-scrollbar::-webkit-scrollbar { width: 4px; }
    .manyasha-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .manyasha-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(21, 101, 192, 0.2);
      border-radius: 4px;
    }
    .manyasha-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(21, 101, 192, 0.35);
    }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ManyashaWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [inputFocused, setInputFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Inject keyframes
  useEffect(() => ensureKeyframes(), []);

  // Check if disabled in settings
  useEffect(() => {
    const stored = localStorage.getItem("hunterlite_manyasha_enabled");
    if (stored === "false") setEnabled(false);

    const handler = () => {
      const val = localStorage.getItem("hunterlite_manyasha_enabled");
      setEnabled(val !== "false");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Load chat history from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("manyasha_history");
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch {
        // ignore corrupt data
      }
    }
  }, []);

  // Save chat history
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem("manyasha_history", JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || loading) return;
      const userMsg: Message = { role: "user", content };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await api.post<{ reply: string }>("/manyasha/chat", {
          message: content,
          history: messages.slice(-10),
        });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.reply },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Ой, что-то пошло не так. Попробуй ещё раз!",
          },
        ]);
      }
      setLoading(false);
    },
    [input, loading, messages],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  // Auto-grow textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 72) + "px";
    },
    [],
  );

  if (!enabled) return null;

  return (
    <>
      {/* ---------------------------------------------------------- */}
      {/*  FLOATING MASCOT — real Gzhel matryoshka image              */}
      {/* ---------------------------------------------------------- */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {/* Speech bubble — "Нужна помощь?" */}
            <AnimatePresence>
              {hovered && (
                <motion.div
                  initial={{ scale: 0, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0, opacity: 0, y: 10 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="mb-2 mr-2 px-4 py-2.5 rounded-2xl relative"
                  style={{
                    background: "rgba(255, 255, 255, 0.95)",
                    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
                    border: "1px solid rgba(21, 101, 192, 0.15)",
                  }}
                >
                  <span className="text-sm font-semibold" style={{ color: "#1a2b3d" }}>
                    Нужна помощь?
                  </span>
                  {/* Speech bubble tail */}
                  <div
                    className="absolute -bottom-2 right-6 w-4 h-4"
                    style={{
                      background: "rgba(255, 255, 255, 0.95)",
                      transform: "rotate(45deg)",
                      borderRight: "1px solid rgba(21, 101, 192, 0.15)",
                      borderBottom: "1px solid rgba(21, 101, 192, 0.15)",
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mascot image button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setOpen(true)}
              className="relative rounded-full overflow-hidden border-0 bg-transparent p-0 cursor-pointer"
              style={{
                width: 80,
                height: 80,
                animation: "manyasha-float 4s ease-in-out infinite, manyasha-glow-breathe 3s ease-in-out infinite",
              }}
              aria-label="Открыть Маняшу"
            >
              <Image
                src="/mascot/mascot-idle.jpg"
                alt="Маняша — AI-помощник"
                width={80}
                height={80}
                className="rounded-full object-cover object-[center_20%]"
                style={{
                  border: "3px solid rgba(21, 101, 192, 0.4)",
                  borderRadius: "50%",
                }}
                priority
              />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------- */}
      {/*  CHAT PANEL                                                  */}
      {/* ---------------------------------------------------------- */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="fixed bottom-6 right-6 z-[9999] flex flex-col overflow-hidden"
            style={{
              width: "min(400px, calc(100vw - 48px))",
              maxHeight: "min(560px, calc(100vh - 100px))",
              background: GZHEL.bgPanel,
              border: `1px solid ${GZHEL.border}`,
              borderRadius: 20,
              backdropFilter: "blur(40px)",
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${GZHEL.glow}`,
            }}
          >
            {/* ------ HEADER with real mascot ------ */}
            <div
              className="relative shrink-0 flex items-center justify-between px-4 py-3"
              style={{
                background: "linear-gradient(135deg, rgba(21,101,192,0.12), rgba(33,150,243,0.06))",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-full overflow-hidden shrink-0"
                  style={{
                    width: 42,
                    height: 42,
                    border: `2px solid rgba(21, 101, 192, 0.3)`,
                    boxShadow: `0 0 12px ${GZHEL.glow}`,
                  }}
                >
                  <Image
                    src="/mascot/mascot-idle.jpg"
                    alt="Маняша"
                    width={42}
                    height={42}
                    className="rounded-full object-cover object-[center_20%]"
                  />
                </div>
                <div className="flex flex-col">
                  <span
                    className="font-bold text-sm leading-tight"
                    style={{ color: "rgba(255,255,255,0.95)" }}
                  >
                    Маняша
                  </span>
                  <span
                    className="text-[11px] leading-tight flex items-center gap-1"
                    style={{ color: GZHEL.textMuted }}
                  >
                    <Sparkles size={10} />
                    AI-помощник по банкротству
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-lg transition-all duration-200"
                style={{
                  width: 32,
                  height: 32,
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
                aria-label="Закрыть"
              >
                <X size={18} style={{ color: "rgba(255,255,255,0.5)" }} />
              </button>

              {/* Bottom glow line */}
              <div
                className="absolute bottom-0 left-4 right-4 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${GZHEL.borderActive}, ${GZHEL.accent}40, transparent)`,
                  animation: "manyasha-border-glow 3s ease-in-out infinite",
                }}
              />
            </div>

            {/* ------ MESSAGES ------ */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 manyasha-scrollbar"
              style={{ scrollbarWidth: "thin" }}
            >
              {/* Empty state / greeting */}
              {messages.length === 0 && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex flex-col items-center text-center py-4 px-2"
                >
                  <div
                    className="rounded-full overflow-hidden mb-4"
                    style={{
                      width: 80,
                      height: 80,
                      border: `2px solid ${GZHEL.border}`,
                      boxShadow: `0 0 20px ${GZHEL.glow}`,
                    }}
                  >
                    <Image
                      src="/mascot/mascot-idle.jpg"
                      alt="Маняша"
                      width={80}
                      height={80}
                      className="rounded-full object-cover object-[center_20%]"
                    />
                  </div>
                  <p
                    className="font-bold text-base mb-1"
                    style={{ color: "rgba(255,255,255,0.9)" }}
                  >
                    Привет! Я Маняша
                  </p>
                  <p
                    className="text-xs mb-5"
                    style={{ color: GZHEL.textMuted }}
                  >
                    Задайте любой вопрос о банкротстве
                  </p>

                  {/* Quick action chips */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {QUICK_ACTIONS.map((label) => (
                      <button
                        key={label}
                        onClick={() => sendMessage(label)}
                        className="rounded-full px-3 py-1.5 text-xs transition-all duration-200"
                        style={{
                          background: "rgba(21, 101, 192, 0.08)",
                          border: `1px solid ${GZHEL.border}`,
                          color: "rgba(255,255,255,0.7)",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(21, 101, 192, 0.18)";
                          e.currentTarget.style.borderColor = GZHEL.borderActive;
                          e.currentTarget.style.color = "rgba(255,255,255,0.95)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(21, 101, 192, 0.08)";
                          e.currentTarget.style.borderColor = GZHEL.border;
                          e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Message bubbles */}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.04 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div
                      className="shrink-0 mr-2 mt-1 rounded-full overflow-hidden"
                      style={{
                        width: 26,
                        height: 26,
                        border: `1px solid ${GZHEL.border}`,
                      }}
                    >
                      <Image
                        src="/mascot/mascot-idle.jpg"
                        alt="Маняша"
                        width={26}
                        height={26}
                        className="rounded-full object-cover object-[center_20%]"
                      />
                    </div>
                  )}
                  <div
                    className="rounded-2xl px-3.5 py-2.5 max-w-[82%] text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                    style={
                      msg.role === "user"
                        ? {
                            background: "linear-gradient(135deg, rgba(21,101,192,0.25), rgba(33,150,243,0.15))",
                            border: "1px solid rgba(21,101,192,0.25)",
                            color: "rgba(255,255,255,0.92)",
                            borderBottomRightRadius: 6,
                          }
                        : {
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.85)",
                            borderBottomLeftRadius: 6,
                          }
                    }
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div
                    className="shrink-0 mr-2 mt-1 rounded-full overflow-hidden"
                    style={{
                      width: 26,
                      height: 26,
                      border: `1px solid ${GZHEL.border}`,
                    }}
                  >
                    <Image
                      src="/mascot/mascot-idle.jpg"
                      alt="Маняша"
                      width={26}
                      height={26}
                      className="rounded-full object-cover object-[center_20%]"
                    />
                  </div>
                  <div
                    className="rounded-2xl px-4 py-3"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderBottomLeftRadius: 6,
                    }}
                  >
                    <div className="flex gap-1.5 items-center h-4">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className="rounded-full"
                          style={{
                            width: 6,
                            height: 6,
                            background: `linear-gradient(135deg, ${GZHEL.primary}, ${GZHEL.accent})`,
                          }}
                          animate={{
                            y: [0, -5, 0],
                            opacity: [0.4, 1, 0.4],
                          }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: dot * 0.18,
                            ease: "easeInOut",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ------ INPUT AREA ------ */}
            <div
              className="shrink-0 px-4 pb-4 pt-2"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div
                className="flex items-end gap-2 rounded-2xl px-3.5 py-2.5 transition-all duration-300"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: inputFocused
                    ? `1px solid ${GZHEL.borderActive}`
                    : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: inputFocused
                    ? "0 0 20px rgba(21, 101, 192, 0.08), inset 0 0 20px rgba(21, 101, 192, 0.03)"
                    : "none",
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="Спроси Маняшу..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent outline-none text-[13px] placeholder:text-white/20"
                  style={{
                    color: "rgba(255, 255, 255, 0.9)",
                    maxHeight: 72,
                    lineHeight: "1.5",
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="shrink-0 flex items-center justify-center rounded-xl transition-all duration-200"
                  style={{
                    width: 34,
                    height: 34,
                    background:
                      input.trim() && !loading
                        ? `linear-gradient(135deg, ${GZHEL.primary}, ${GZHEL.accent})`
                        : "rgba(255,255,255,0.04)",
                    opacity: input.trim() && !loading ? 1 : 0.3,
                    cursor:
                      input.trim() && !loading ? "pointer" : "not-allowed",
                    boxShadow:
                      input.trim() && !loading
                        ? `0 0 16px ${GZHEL.glow}`
                        : "none",
                  }}
                  aria-label="Отправить"
                >
                  <Send
                    size={15}
                    style={{
                      color: "rgba(255, 255, 255, 0.9)",
                      transform: "rotate(-45deg)",
                      marginLeft: 1,
                      marginBottom: 1,
                    }}
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
