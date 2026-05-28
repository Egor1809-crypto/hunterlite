"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

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
/*  Inline keyframes (injected once)                                   */
/* ------------------------------------------------------------------ */

const KEYFRAMES_ID = "manyasha-keyframes";

function ensureKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes manyasha-pulse-ring {
      0%   { transform: scale(1);   opacity: 0.5; }
      70%  { transform: scale(1.5); opacity: 0; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    @keyframes manyasha-glow-breathe {
      0%, 100% { box-shadow: 0 0 20px rgba(236,72,153,0.25), 0 4px 14px rgba(0,0,0,0.3); }
      50%      { box-shadow: 0 0 36px rgba(236,72,153,0.45), 0 4px 14px rgba(0,0,0,0.3); }
    }
    @keyframes manyasha-border-glow {
      0%, 100% { opacity: 0.4; }
      50%      { opacity: 1; }
    }
    .manyasha-scrollbar::-webkit-scrollbar { width: 4px; }
    .manyasha-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .manyasha-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(236,72,153,0.2);
      border-radius: 4px;
    }
    .manyasha-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(236,72,153,0.35);
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
      {/*  FLOATING BUTTON                                            */}
      {/* ---------------------------------------------------------- */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-[9999] flex items-center justify-center rounded-full"
            style={{
              width: 56,
              height: 56,
              background: "linear-gradient(135deg, #EC4899, #8B5CF6)",
              boxShadow:
                "0 0 30px rgba(236, 72, 153, 0.3), 0 4px 14px rgba(0,0,0,0.3)",
              animation: "manyasha-glow-breathe 3s ease-in-out infinite",
            }}
            aria-label="Открыть Маняшу"
          >
            {/* Pulsing ring */}
            <span
              className="absolute inset-0 rounded-full"
              style={{
                border: "2px solid rgba(236, 72, 153, 0.5)",
                animation:
                  "manyasha-pulse-ring 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              }}
            />
            <span
              className="text-2xl select-none relative z-10"
              role="img"
              aria-label="matryoshka"
            >
              {"🪆"}
            </span>
          </motion.button>
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
              width: "min(380px, calc(100vw - 48px))",
              maxHeight: "min(520px, calc(100vh - 100px))",
              background: "rgba(10, 10, 25, 0.98)",
              border: "1px solid rgba(236, 72, 153, 0.15)",
              borderRadius: 20,
              backdropFilter: "blur(40px)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(236,72,153,0.1)",
            }}
          >
            {/* ------ HEADER ------ */}
            <div
              className="relative shrink-0 flex items-center justify-between px-5 py-3.5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(236,72,153,0.12), rgba(139,92,246,0.08))",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 36,
                    height: 36,
                    background: "linear-gradient(135deg, #EC4899, #8B5CF6)",
                    boxShadow: "0 0 12px rgba(236,72,153,0.3)",
                  }}
                >
                  <span className="text-lg select-none">{"🪆"}</span>
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
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    <Sparkles size={10} />
                    AI-помощник
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
                  background:
                    "linear-gradient(90deg, transparent, rgba(236,72,153,0.4), rgba(139,92,246,0.3), transparent)",
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
                  className="flex flex-col items-center text-center py-6 px-2"
                >
                  <div
                    className="flex items-center justify-center rounded-full mb-4"
                    style={{
                      width: 64,
                      height: 64,
                      background:
                        "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(139,92,246,0.1))",
                      border: "1px solid rgba(236,72,153,0.15)",
                    }}
                  >
                    <span className="text-3xl select-none">{"🪆"}</span>
                  </div>
                  <p
                    className="font-bold text-base mb-1"
                    style={{ color: "rgba(255,255,255,0.9)" }}
                  >
                    Привет! Я Маняша
                  </p>
                  <p
                    className="text-xs mb-5"
                    style={{ color: "rgba(255,255,255,0.4)" }}
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
                          background: "rgba(236, 72, 153, 0.08)",
                          border: "1px solid rgba(236, 72, 153, 0.2)",
                          color: "rgba(255,255,255,0.7)",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "rgba(236, 72, 153, 0.18)";
                          e.currentTarget.style.borderColor =
                            "rgba(236, 72, 153, 0.4)";
                          e.currentTarget.style.color =
                            "rgba(255,255,255,0.95)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(236, 72, 153, 0.08)";
                          e.currentTarget.style.borderColor =
                            "rgba(236, 72, 153, 0.2)";
                          e.currentTarget.style.color =
                            "rgba(255,255,255,0.7)";
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
                      className="shrink-0 mr-2 mt-1 flex items-center justify-center rounded-full"
                      style={{
                        width: 24,
                        height: 24,
                        background:
                          "linear-gradient(135deg, rgba(236,72,153,0.2), rgba(139,92,246,0.15))",
                        border: "1px solid rgba(236,72,153,0.15)",
                      }}
                    >
                      <span className="text-xs select-none">{"🪆"}</span>
                    </div>
                  )}
                  <div
                    className="rounded-2xl px-3.5 py-2.5 max-w-[82%] text-[13px] leading-relaxed whitespace-pre-wrap break-words"
                    style={
                      msg.role === "user"
                        ? {
                            background:
                              "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.2))",
                            border: "1px solid rgba(99,102,241,0.2)",
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
                    className="shrink-0 mr-2 mt-1 flex items-center justify-center rounded-full"
                    style={{
                      width: 24,
                      height: 24,
                      background:
                        "linear-gradient(135deg, rgba(236,72,153,0.2), rgba(139,92,246,0.15))",
                      border: "1px solid rgba(236,72,153,0.15)",
                    }}
                  >
                    <span className="text-xs select-none">{"🪆"}</span>
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
                            background:
                              "linear-gradient(135deg, #EC4899, #8B5CF6)",
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
                    ? "1px solid rgba(236, 72, 153, 0.3)"
                    : "1px solid rgba(255,255,255,0.06)",
                  boxShadow: inputFocused
                    ? "0 0 20px rgba(236, 72, 153, 0.08), inset 0 0 20px rgba(236, 72, 153, 0.03)"
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
                        ? "linear-gradient(135deg, #EC4899, #8B5CF6)"
                        : "rgba(255,255,255,0.04)",
                    opacity: input.trim() && !loading ? 1 : 0.3,
                    cursor:
                      input.trim() && !loading ? "pointer" : "not-allowed",
                    boxShadow:
                      input.trim() && !loading
                        ? "0 0 16px rgba(236,72,153,0.25)"
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
