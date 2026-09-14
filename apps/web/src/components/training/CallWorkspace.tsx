"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  Mic,
  PhoneOff,
  Square,
  Loader2,
  Volume2,
} from "lucide-react";
import { STAGE_GUIDANCE } from "@/lib/script_guidance";
import { ClientPortrait } from "./ClientPortrait";

export type CallLine = { role: "user" | "assistant"; content: string };
const GOALS = [
  "Назовите себя и цель звонка",
  "Дайте человеку рассказать",
  "Долги, доходы, имущество, взыскание",
  "Объясните варианты и ограничения",
  "Выслушайте главное опасение",
  "Согласуйте документы и действия",
  "Подведите итог и договоритесь",
];

export function CallWorkspace({
  name,
  age,
  portrait,
  lines,
  draft,
  previewUnavailable,
  recording,
  processing,
  status,
  stage,
  onStage,
  onSpeak,
  onEnd,
  disabled,
  ending,
  micBusy,
  audioLevel,
  notice,
  unlockAudio,
}: {
  name: string;
  age?: number | null;
  portrait?: string | null;
  lines: CallLine[];
  draft: string;
  previewUnavailable: boolean;
  recording: boolean;
  processing: boolean;
  status: string;
  stage: number;
  onStage: (stage: number) => void;
  onSpeak: () => void;
  onEnd: () => void;
  disabled: boolean;
  ending: boolean;
  micBusy: boolean;
  audioLevel: number;
  notice?: ReactNode;
  unlockAudio?: () => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const liveDraft = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (liveDraft.current)
      liveDraft.current.scrollTop = liveDraft.current.scrollHeight;
  }, [draft]);
  useEffect(() => {
    const el = scroll.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (follow.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [unread, setUnread] = useState(false);
  const [mobilePlan, setMobilePlan] = useState(false);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const latest = () => {
    if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
    follow.current = true;
    setUnread(false);
  };
  useEffect(() => {
    if (follow.current) latest();
    else setUnread(true);
  }, [lines]);
  const guide = STAGE_GUIDANCE[stage - 1];
  return (
    <main className="call-workspace">
      <header className="call-workspace-header">
        <span className="call-brand">
          LegalHunter <span>/ Звонок</span>
        </span>
        <span className="call-session-label">Учебная консультация</span>
        <time aria-label="Время на экране звонка">
          {Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}
          :{(seconds % 60).toString().padStart(2, "0")}
        </time>
      </header>
      <div className="call-mobile-tabs" aria-label="Область звонка">
        <button aria-pressed={!mobilePlan} onClick={() => setMobilePlan(false)}>
          Разговор
        </button>
        <button aria-pressed={mobilePlan} onClick={() => setMobilePlan(true)}>
          План · 7 этапов
        </button>
      </div>
      <div className={`call-workspace-grid${mobilePlan ? " show-plan" : ""}`}>
        <section className="call-conversation" aria-label="Разговор с клиентом">
          <header className="call-client-header">
            <ClientPortrait key={portrait} name={name} src={portrait} />
            <div>
              <h1>
                {name}
                {age
                  ? `, ${age} ${age % 10 === 1 && age % 100 !== 11 ? "год" : age % 10 >= 2 && age % 10 <= 4 && (age % 100 < 12 || age % 100 > 14) ? "года" : "лет"}`
                  : ""}
              </h1>
              <p role="status">{status}</p>
            </div>
          </header>
          <div
            ref={scroll}
            className="call-transcript"
            role="region"
            aria-label="Текст разговора"
            tabIndex={0}
            onScroll={() => {
              const el = scroll.current;
              if (!el) return;
              follow.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 64;
              if (follow.current) setUnread(false);
            }}
          >
            {lines.length === 0 ? (
              <div className="call-empty">
                <Mic size={26} aria-hidden="true" />
                <p>Начните с приветствия</p>
                <span>
                  Нажмите «Говорить». Ваши слова появятся над кнопкой, ответ
                  клиента — здесь.
                </span>
              </div>
            ) : (
              lines.map((line, i) => (
                <div
                  key={i}
                  className={`call-message call-message-${line.role}`}
                >
                  <span>{line.role === "user" ? "Вы" : name}</span>
                  <p>{line.content}</p>
                </div>
              ))
            )}
          </div>
          {unread && (
            <button className="call-latest" onClick={latest}>
              <ArrowDown size={16} />К последней реплике
            </button>
          )}
          <div className="call-draft" aria-label="Ваша текущая реплика">
            <div className="call-draft-label">
              {recording
                ? "Ваша речь · предварительный текст"
                : processing
                  ? "Уточняю распознанную реплику…"
                  : "Ваша текущая реплика"}
              {recording && (
                <meter
                  min={0}
                  max={100}
                  value={audioLevel}
                  aria-label="Уровень микрофона"
                />
              )}
            </div>
            <p ref={liveDraft}>
              {draft ||
                (recording
                  ? previewUnavailable
                    ? "Предварительное распознавание недоступно. Текст появится после остановки записи."
                    : "Слушаю… Текст появляется по мере распознавания."
                  : "Нажмите «Говорить», чтобы записать реплику.")}
            </p>
          </div>
          {notice && <div className="call-feedback">{notice}</div>}
          <footer className="call-controls">
            <button
              onClick={() => {
                setMobilePlan(false);
                onSpeak();
              }}
              disabled={disabled}
              aria-pressed={recording}
              className="call-primary"
            >
              {micBusy ? (
                <Loader2 size={20} className="animate-spin" />
              ) : recording ? (
                <Square size={20} />
              ) : (
                <Mic size={20} />
              )}
              {recording ? "Стоп и отправить" : "Говорить"}
            </button>
            <button
              onClick={onEnd}
              disabled={ending}
              className="call-secondary"
            >
              <PhoneOff size={20} />
              {ending ? "Завершаю…" : "Завершить"}
            </button>
            {unlockAudio ? (
              <button onClick={unlockAudio} className="call-secondary">
                <Volume2 size={18} />
                Включить звук
              </button>
            ) : (
              <span>
                Чтобы перебить клиента,
                <br />
                нажмите «Говорить»
              </span>
            )}
          </footer>
        </section>
        <aside className="call-plan" aria-label="План разговора">
          <header>
            <h2>План разговора</h2>
            <p>Выберите этап для подсказки</p>
          </header>
          <ol>
            {STAGE_GUIDANCE.map((g, i) => (
              <li key={g.key}>
                <button
                  aria-pressed={stage === i + 1}
                  onClick={() => onStage(i + 1)}
                >
                  <span className="call-step-number">{i + 1}</span>
                  <span>
                    <strong>{g.label_ru}</strong>
                    <small>{GOALS[i]}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="call-stage-hint">
            <h3>{guide.label_ru}</h3>
            <p>«{guide.examples[0].text}»</p>
            <span>Выбор этапа меняет подсказку. Оценка — после звонка.</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
