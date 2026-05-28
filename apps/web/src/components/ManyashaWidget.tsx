"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ManyashaWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post<{ reply: string }>("/manyasha/chat", {
        message: userMsg.content,
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
  }, [input, loading, messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  if (!enabled) return null;

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-[9999] flex items-center justify-center rounded-full shadow-lg"
            style={{
              width: 56,
              height: 56,
              background: "linear-gradient(135deg, #7C3AED, #3B82F6)",
              boxShadow:
                "0 0 20px rgba(124,58,237,0.4), 0 4px 12px rgba(0,0,0,0.3)",
            }}
            aria-label="Открыть Маняшу"
          >
            <span className="text-2xl" role="img" aria-label="matryoshka">
              {"🪆"}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-[9999] flex flex-col"
            style={{
              width: "min(380px, calc(100vw - 48px))",
              height: "min(500px, calc(100vh - 100px))",
              background: "rgba(15, 15, 30, 0.98)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: 16,
              backdropFilter: "blur(20px)",
              boxShadow:
                "0 0 30px rgba(124,58,237,0.15), 0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(59,130,246,0.2))",
                borderBottom: "1px solid rgba(139,92,246,0.2)",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{"🪆"}</span>
                <span
                  className="font-semibold text-sm"
                  style={{ color: "rgba(255,255,255,0.95)" }}
                >
                  Маняша
                </span>
                <span
                  className="rounded-full"
                  style={{
                    width: 8,
                    height: 8,
                    background: "#4ade80",
                    display: "inline-block",
                  }}
                />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                style={{ width: 32, height: 32 }}
                aria-label="Закрыть"
              >
                <X size={18} style={{ color: "rgba(255,255,255,0.6)" }} />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
              style={{ scrollbarWidth: "thin" }}
            >
              {messages.length === 0 && !loading && (
                <div
                  className="text-center py-8"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  <span className="text-4xl block mb-3">{"🪆"}</span>
                  <p className="text-sm">
                    Привет! Я Маняша, твой AI-помощник.
                  </p>
                  <p className="text-sm mt-1">Спроси что-нибудь!</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <span className="shrink-0 mr-2 mt-1 text-sm">
                      {"🪆"}
                    </span>
                  )}
                  <div
                    className="rounded-xl px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap break-words"
                    style={{
                      background:
                        msg.role === "user"
                          ? "rgba(59, 130, 246, 0.2)"
                          : "rgba(139, 92, 246, 0.1)",
                      border:
                        msg.role === "user"
                          ? "1px solid rgba(59, 130, 246, 0.3)"
                          : "1px solid rgba(139, 92, 246, 0.2)",
                      color: "rgba(255, 255, 255, 0.9)",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="flex justify-start">
                  <span className="shrink-0 mr-2 mt-1 text-sm">
                    {"🪆"}
                  </span>
                  <div
                    className="rounded-xl px-3 py-2"
                    style={{
                      background: "rgba(139, 92, 246, 0.1)",
                      border: "1px solid rgba(139, 92, 246, 0.2)",
                    }}
                  >
                    <div className="flex gap-1 items-center h-5">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className="rounded-full"
                          style={{
                            width: 6,
                            height: 6,
                            background: "rgba(139, 92, 246, 0.6)",
                          }}
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: dot * 0.15,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div
              className="shrink-0 px-3 pb-3 pt-2"
              style={{
                borderTop: "1px solid rgba(139, 92, 246, 0.15)",
              }}
            >
              <div
                className="flex items-end gap-2 rounded-xl px-3 py-2"
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Спроси Маняшу..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent outline-none text-sm"
                  style={{
                    color: "rgba(255, 255, 255, 0.9)",
                    maxHeight: 80,
                    lineHeight: "1.4",
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="shrink-0 flex items-center justify-center rounded-lg transition-all"
                  style={{
                    width: 32,
                    height: 32,
                    background:
                      input.trim() && !loading
                        ? "linear-gradient(135deg, #7C3AED, #3B82F6)"
                        : "rgba(255,255,255,0.05)",
                    opacity: input.trim() && !loading ? 1 : 0.4,
                    cursor:
                      input.trim() && !loading ? "pointer" : "not-allowed",
                  }}
                  aria-label="Отправить"
                >
                  <Send
                    size={16}
                    style={{ color: "rgba(255, 255, 255, 0.9)" }}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
