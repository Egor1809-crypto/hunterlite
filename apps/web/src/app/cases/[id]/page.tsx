"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, Reorder } from "framer-motion";
import AuthLayout from "@/components/layout/AuthLayout";
import { api } from "@/lib/api";

/* ── Palette (editorial / malvah-abstract) — theme-aware via tokens, so the
   page follows light/dark like the rest of the app. ─────────────────────── */
const PAPER = "var(--bg-primary)";
const PAPER_RAISED = "var(--surface-card)";
const INK = "var(--text-primary)";
const INK_SOFT = "var(--text-secondary)";
const INK_FAINT = "var(--text-muted)";
const RULE = "var(--border-color)";
const RULE_SOFT = "var(--border-color)";
const BRAND = "var(--primary)"; // акцент — прогресс
const BRAND_SOFT = "var(--primary-muted)";
const RIGHT = "var(--success)"; // зелёный — верно
const WRONG = "var(--danger)"; // ошибка
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ── Types (mirror backend contract) ───────────────────────── */
interface PoolItem {
  id: string;
  text: string;
}
interface Fact {
  label: string;
  value: string;
}
interface Meta {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  category: string;
  estimated_minutes: number;
  max_score: number;
  stage1_intro: string;
  total_questions: number;
  stage2_prompt: string;
  stage2_pool: PoolItem[];
}
interface QuestionNode {
  id: string;
  type: "question";
  step: number;
  title: string;
  question: string;
  facts: Fact[];
  options: { id: string; text: string }[];
}
interface InfoNode {
  id: string;
  type: "info";
  step: number;
  title: string;
  body: string;
  facts: Fact[];
  next: Node | null;
}
interface OutcomeNode {
  id: string;
  type: "outcome";
  outcome: string;
  title: string;
  summary: string;
}
type Node = QuestionNode | InfoNode | OutcomeNode;
interface StartResponse {
  attempt_id: string;
  case_title: string;
  stage1_intro: string;
  total_questions: number;
  node: Node;
}
interface AnswerResponse {
  correct: boolean;
  explain: string;
  next: Node | null;
  is_outcome: boolean;
  stage1_score: number | null;
}
interface SubmitFeedback {
  id: string;
  text: string;
  placed_position: number;
  correct_position: number | null;
  is_distractor: boolean;
  placed_correctly: boolean;
  explain: string;
}
interface SubmitResponse {
  stage2_score: number;
  stage2_max: number;
  matched: number;
  total_correct: number;
  feedback: SubmitFeedback[];
}
interface CompleteResponse {
  stage1_score: number;
  stage2_score: number;
  score: number;
  score_percent: number;
  max_score: number;
  expert_analysis: string;
  sequence_review: { position: number; text: string; explain: string }[];
}

type Phase =
  | "loading"
  | "error"
  | "intro"
  | "stage1"
  | "outcome"
  | "stage2"
  | "stage2review"
  | "result";

/* ── Small primitives ──────────────────────────────────────── */
function MonoLabel({
  children,
  color = INK_FAINT,
  size = 12,
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="font-mono uppercase"
      style={{ fontSize: size, letterSpacing: "0.18em", color, lineHeight: 1.4 }}
    >
      {children}
    </span>
  );
}

function Rule({ soft = false }: { soft?: boolean }) {
  return <div style={{ height: 1, background: soft ? RULE_SOFT : RULE }} />;
}

/* Row of fact cards — data visualisation in the editorial grid. */
function FactRow({ facts }: { facts: Fact[] }) {
  if (!facts || facts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-px mt-8" style={{ background: RULE }}>
      {facts.map((f, i) => (
        <div
          key={i}
          className="flex-1 px-5 py-5"
          style={{ background: PAPER, minWidth: 150 }}
        >
          <MonoLabel size={10.5}>{f.label}</MonoLabel>
          <div
            className="font-display mt-2.5"
            style={{ fontSize: 22, lineHeight: 1.15, letterSpacing: "-0.02em", color: INK, fontWeight: 600 }}
          >
            {f.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Big arrow CTA — consistent button component. */
function ArrowButton({
  label,
  onClick,
  disabled,
  glyph = "→",
  size = 24,
  color = INK,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  glyph?: string;
  size?: number;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="case-focus group inline-flex items-center gap-3 disabled:opacity-40"
      style={{ color }}
    >
      <span
        className="font-display"
        style={{ fontSize: size, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1 }}
      >
        {label}
      </span>
      <span className="inline-block transition-transform group-hover:translate-x-1" style={{ fontSize: size }}>
        {glyph}
      </span>
    </button>
  );
}

/* ── Page ──────────────────────────────────────────────────── */
export default function CasePlayerPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = String(params?.id ?? "");

  const [phase, setPhase] = useState<Phase>("loading");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [errMsg, setErrMsg] = useState("");

  // stage 1
  const [attemptId, setAttemptId] = useState("");
  const [node, setNode] = useState<Node | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AnswerResponse | null>(null);
  const [stage1Score, setStage1Score] = useState(0);
  const [busy, setBusy] = useState(false);

  // stage 2
  const [sequence, setSequence] = useState<PoolItem[]>([]);
  const [submit, setSubmit] = useState<SubmitResponse | null>(null);

  // result
  const [result, setResult] = useState<CompleteResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Meta>(`/cases/${caseId}`)
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        setPhase("intro");
      })
      .catch(() => {
        if (cancelled) return;
        setErrMsg("Кейс не найден");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const pool = useMemo(() => meta?.stage2_pool ?? [], [meta]);
  const available = useMemo(
    () => pool.filter((p) => !sequence.some((s) => s.id === p.id)),
    [pool, sequence],
  );

  async function begin() {
    setBusy(true);
    try {
      const res = await api.post<StartResponse>(`/cases/${caseId}/start`, {});
      setAttemptId(res.attempt_id);
      setNode(res.node);
      setPicked(null);
      setAnswer(null);
      setSequence([]);
      setSubmit(null);
      setResult(null);
      setStage1Score(0);
      setPhase("stage1");
    } catch {
      setErrMsg("Не удалось начать кейс");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  async function pick(optionId: string) {
    if (busy || answer || !node || node.type !== "question") return;
    setPicked(optionId);
    setBusy(true);
    try {
      const res = await api.post<AnswerResponse>(`/cases/${caseId}/answer`, {
        attempt_id: attemptId,
        node_id: node.id,
        option_id: optionId,
      });
      setAnswer(res);
      if (res.stage1_score != null) setStage1Score(res.stage1_score);
    } catch {
      setPicked(null);
    } finally {
      setBusy(false);
    }
  }

  function goTo(next: Node | null) {
    if (!next) return;
    if (next.type === "outcome") {
      setNode(next);
      setPhase("outcome");
    } else {
      setNode(next);
      setPhase("stage1");
    }
  }

  // After answering a question: clear verdict, move to next (question | info | outcome).
  function advance() {
    if (!answer) return;
    const next = answer.next;
    setPicked(null);
    setAnswer(null);
    goTo(next);
  }

  // From an info "разбор" node → its embedded next (question | outcome).
  function continueFromInfo() {
    if (!node || node.type !== "info") return;
    goTo(node.next);
  }

  function addStep(item: PoolItem) {
    setSequence((s) => [...s, item]);
  }
  function removeStep(id: string) {
    setSequence((s) => s.filter((x) => x.id !== id));
  }

  async function submitOrder() {
    if (busy || sequence.length === 0) return;
    setBusy(true);
    try {
      const res = await api.post<SubmitResponse>(`/cases/${caseId}/submit-order`, {
        attempt_id: attemptId,
        order: sequence.map((s) => s.id),
      });
      setSubmit(res);
      setPhase("stage2review");
    } catch {
      /* keep on stage2 */
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post<CompleteResponse>(`/cases/${caseId}/complete`, {
        attempt_id: attemptId,
      });
      setResult(res);
      setPhase("result");
    } catch {
      /* stay */
    } finally {
      setBusy(false);
    }
  }

  const totalQuestions = meta?.total_questions ?? 5;
  const currentStep =
    node && (node.type === "question" || node.type === "info") ? node.step : 0;

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <AuthLayout showBreadcrumbs={false}>
      <style
        dangerouslySetInnerHTML={{
          __html: `.case-focus:focus{outline:none}.case-focus:focus-visible{outline:2px solid ${BRAND};outline-offset:3px;border-radius:3px}`,
        }}
      />
      <div style={{ background: PAPER, color: INK, minHeight: "100vh" }}>
        <div className="mx-auto max-w-[860px] px-6 sm:px-12 py-10 sm:py-16">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-12">
            <button
              type="button"
              onClick={() => router.push("/cases")}
              className="case-focus font-mono uppercase transition-opacity hover:opacity-60"
              style={{ fontSize: 12, letterSpacing: "0.18em", color: INK_SOFT }}
            >
              ← Кейсы
            </button>
            <MonoLabel>БФЛ · ФЗ-127</MonoLabel>
          </div>

          <div>
            {phase === "loading" && (
              <p className="font-mono" style={{ fontSize: 13, color: INK_FAINT }}>
                загрузка…
              </p>
            )}

            {phase === "error" && <p style={{ color: WRONG }}>{errMsg}</p>}

            {phase === "intro" && meta && <Intro key="intro" meta={meta} onBegin={begin} busy={busy} />}

            {phase === "stage1" && node && node.type === "question" && (
              <Stage1Question
                key={`q-${node.id}`}
                node={node}
                step={currentStep}
                total={totalQuestions}
                picked={picked}
                answer={answer}
                busy={busy}
                onPick={pick}
                onAdvance={advance}
              />
            )}

            {phase === "stage1" && node && node.type === "info" && (
              <InfoView
                key={`i-${node.id}`}
                node={node}
                step={currentStep}
                total={totalQuestions}
                onContinue={continueFromInfo}
              />
            )}

            {phase === "outcome" && node && node.type === "outcome" && (
              <Outcome key="outcome" node={node} stage1Score={stage1Score} onContinue={() => setPhase("stage2")} />
            )}

            {phase === "stage2" && meta && (
              <Stage2
                key="stage2"
                prompt={meta.stage2_prompt}
                available={available}
                sequence={sequence}
                onAdd={addStep}
                onRemove={removeStep}
                onReorder={setSequence}
                onSubmit={submitOrder}
                busy={busy}
              />
            )}

            {phase === "stage2review" && submit && (
              <Stage2Review key="s2r" submit={submit} onFinish={finish} busy={busy} />
            )}

            {phase === "result" && result && <Result key="result" result={result} onRestart={begin} />}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}

/* ── Intro ─────────────────────────────────────────────────── */
function Intro({ meta, onBegin, busy }: { meta: Meta; onBegin: () => void; busy: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
      <MonoLabel>Кейс · банкротство физлица</MonoLabel>
      <h1
        className="font-display mt-5"
        style={{ fontSize: "clamp(40px,7vw,72px)", lineHeight: 1.0, letterSpacing: "-0.045em", fontWeight: 600, paddingBottom: 4 }}
      >
        {meta.title}
      </h1>
      <div className="mt-7" style={{ fontSize: 19, lineHeight: 1.6, color: INK_SOFT, maxWidth: 640 }}>
        {meta.description}
      </div>

      <div className="mt-12 mb-12">
        <Rule />
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {[
            ["Этап 1", `Дерево решений · ${meta.total_questions} вопросов`],
            ["Этап 2", "Хронология процедуры"],
            ["≈ время", `${meta.estimated_minutes} минут`],
          ].map(([k, v], i) => (
            <div
              key={k}
              className="py-6 sm:px-6 sm:first:pl-0"
              style={{ borderBottom: i < 2 ? `1px solid ${RULE_SOFT}` : "none" }}
            >
              <MonoLabel>{k}</MonoLabel>
              <div className="mt-2" style={{ fontSize: 17, lineHeight: 1.4, color: INK }}>
                {v}
              </div>
            </div>
          ))}
        </div>
        <Rule />
      </div>

      <ArrowButton label={busy ? "Запуск…" : "Начать кейс"} onClick={onBegin} disabled={busy} size={26} />
    </motion.div>
  );
}

/* ── Stage 1 progress header (shared) ──────────────────────── */
function StageProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-9">
      <div className="flex items-center gap-3 mb-5">
        <MonoLabel color={BRAND}>Этап 1 — внесудебная оценка</MonoLabel>
        <div className="flex-1" />
        <MonoLabel color={INK}>
          {String(Math.min(Math.max(step, 1), total)).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </MonoLabel>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => {
          const done = i < step - 1;
          const current = i === step - 1;
          return (
            <div
              key={i}
              style={{
                height: 3,
                flex: 1,
                borderRadius: 2,
                background: done ? BRAND : current ? BRAND_SOFT : RULE_SOFT,
                outline: current ? `1px solid ${BRAND}` : "none",
                outlineOffset: -1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Stage 1: decision-tree question ───────────────────────── */
function Stage1Question({
  node,
  step,
  total,
  picked,
  answer,
  busy,
  onPick,
  onAdvance,
}: {
  node: QuestionNode;
  step: number;
  total: number;
  picked: string | null;
  answer: AnswerResponse | null;
  busy: boolean;
  onPick: (id: string) => void;
  onAdvance: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <StageProgress step={step} total={total} />

      <MonoLabel>{node.title}</MonoLabel>
      <h2
        className="font-display mt-4"
        style={{
          fontSize: "clamp(27px,4.4vw,44px)",
          lineHeight: 1.1,
          letterSpacing: "-0.035em",
          fontWeight: 600,
          paddingBottom: 2,
        }}
      >
        {node.question}
      </h2>

      <FactRow facts={node.facts} />

      {/* Options as cards */}
      <div className="mt-10 space-y-3">
        {node.options.map((o, i) => {
          const isPicked = picked === o.id;
          const revealed = !!answer && isPicked;
          const correct = revealed && answer!.correct;
          const tone = revealed ? (answer!.correct ? RIGHT : WRONG) : INK;
          const dim = !!answer && !isPicked;
          return (
            <button
              key={o.id}
              type="button"
              disabled={busy || !!answer}
              onClick={() => onPick(o.id)}
              className="case-focus w-full text-left transition-all disabled:cursor-default"
              style={{
                border: `1px solid ${revealed ? tone : RULE}`,
                background: isPicked ? (revealed ? (correct ? "rgba(31,92,70,0.06)" : "rgba(154,53,40,0.06)") : PAPER_RAISED) : PAPER_RAISED,
                borderRadius: 8,
                opacity: dim ? 0.45 : 1,
              }}
            >
              <div className="flex items-start gap-4 px-5 py-5">
                <span
                  className="font-mono shrink-0"
                  style={{
                    fontSize: 13,
                    color: revealed ? tone : INK_FAINT,
                    width: 26,
                    height: 26,
                    lineHeight: "26px",
                    textAlign: "center",
                    border: `1px solid ${revealed ? tone : RULE}`,
                    borderRadius: 5,
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span
                  style={{ fontSize: 18.5, lineHeight: 1.45, color: tone, fontWeight: revealed ? 500 : 400, flex: 1, paddingTop: 1 }}
                >
                  {o.text}
                </span>
                {revealed && (
                  <span className="font-mono shrink-0" style={{ fontSize: 12, color: tone, letterSpacing: "0.1em", paddingTop: 5 }}>
                    {answer!.correct ? "ВЕРНО" : "НЕВЕРНО"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Inline verdict + explanation + advance */}
      {answer && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="mt-8">
          <div
            className="pl-5 py-3"
            style={{ borderLeft: `3px solid ${answer.correct ? RIGHT : WRONG}` }}
          >
            <MonoLabel color={answer.correct ? RIGHT : WRONG}>
              {answer.correct ? "Верный ответ" : "Ошибка — разберём"}
            </MonoLabel>
            <p className="mt-2.5" style={{ fontSize: 17, lineHeight: 1.6, color: INK_SOFT }}>
              {answer.explain}
            </p>
          </div>
          <div className="mt-8">
            <ArrowButton
              label={answer.is_outcome && answer.correct ? "К результату этапа" : answer.correct ? "Следующий вопрос" : "Подробный разбор"}
              onClick={onAdvance}
              size={21}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── Stage 1: info "разбор" node ───────────────────────────── */
function InfoView({
  node,
  step,
  total,
  onContinue,
}: {
  node: InfoNode;
  step: number;
  total: number;
  onContinue: () => void;
}) {
  const toOutcome = node.next?.type === "outcome";
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
      <StageProgress step={step} total={total} />

      <div style={{ border: `1px solid ${RULE}`, borderRadius: 10, background: PAPER_RAISED }} className="p-6 sm:p-9">
        <MonoLabel color={WRONG}>Разбор · почему это неверно</MonoLabel>
        <h2
          className="font-display mt-4"
          style={{ fontSize: "clamp(25px,3.8vw,38px)", lineHeight: 1.12, letterSpacing: "-0.03em", fontWeight: 600, paddingBottom: 2 }}
        >
          {node.title}
        </h2>
        <p className="mt-5" style={{ fontSize: 18, lineHeight: 1.65, color: INK_SOFT }}>
          {node.body}
        </p>
        <FactRow facts={node.facts} />
      </div>

      <div className="mt-9">
        <ArrowButton label={toOutcome ? "К результату этапа" : "Продолжить"} onClick={onContinue} size={22} />
      </div>
    </motion.div>
  );
}

/* ── Outcome (between stages) ──────────────────────────────── */
function Outcome({ node, stage1Score, onContinue }: { node: OutcomeNode; stage1Score: number; onContinue: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
      <div className="flex items-center justify-between mb-8">
        <MonoLabel color={BRAND}>Этап 1 завершён</MonoLabel>
        <MonoLabel color={INK}>{stage1Score} / 50 баллов</MonoLabel>
      </div>
      <Rule />
      <h2
        className="font-display mt-9"
        style={{ fontSize: "clamp(28px,4.6vw,46px)", lineHeight: 1.08, letterSpacing: "-0.035em", fontWeight: 600, paddingBottom: 2 }}
      >
        {node.title}
      </h2>
      <div className="mt-7" style={{ fontSize: 18.5, lineHeight: 1.65, color: INK_SOFT, maxWidth: 660 }}>
        {node.summary}
      </div>
      <div className="mt-11">
        <ArrowButton label="Перейти ко 2 этапу" onClick={onContinue} size={26} />
      </div>
    </motion.div>
  );
}

/* ── Stage 2: chronology ───────────────────────────────────── */
function Stage2({
  prompt,
  available,
  sequence,
  onAdd,
  onRemove,
  onReorder,
  onSubmit,
  busy,
}: {
  prompt: string;
  available: PoolItem[];
  sequence: PoolItem[];
  onAdd: (i: PoolItem) => void;
  onRemove: (id: string) => void;
  onReorder: (s: PoolItem[]) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
      <MonoLabel color={BRAND}>Этап 2 — судебная процедура</MonoLabel>
      <h2
        className="font-display mt-4"
        style={{ fontSize: "clamp(27px,4.4vw,44px)", lineHeight: 1.1, letterSpacing: "-0.035em", fontWeight: 600, paddingBottom: 2 }}
      >
        Хронология
      </h2>
      <div className="mt-5" style={{ fontSize: 18, lineHeight: 1.6, color: INK_SOFT, maxWidth: 660 }}>
        {prompt}
      </div>

      {/* Sequence builder */}
      <div className="mt-11">
        <div className="flex items-center gap-3 mb-4">
          <MonoLabel color={INK}>Ваша последовательность</MonoLabel>
          <div className="flex-1" style={{ height: 1, background: RULE_SOFT }} />
          <MonoLabel>{sequence.length} шаг.</MonoLabel>
        </div>

        {sequence.length === 0 ? (
          <div
            className="py-10 text-center"
            style={{ border: `1px dashed ${RULE}`, borderRadius: 8, color: INK_FAINT, fontSize: 15 }}
          >
            Добавьте шаги из списка ниже и расположите их по порядку
          </div>
        ) : (
          <Reorder.Group axis="y" values={sequence} onReorder={onReorder} className="space-y-2.5">
            {sequence.map((item, i) => (
              <Reorder.Item
                key={item.id}
                value={item}
                className="cursor-grab active:cursor-grabbing"
                style={{ background: PAPER_RAISED, border: `1px solid ${RULE}`, borderRadius: 8 }}
                whileDrag={{ scale: 1.015, boxShadow: "var(--shadow-md)" }}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  <span
                    className="font-mono shrink-0"
                    style={{ fontSize: 13, color: BRAND, width: 26, textAlign: "center" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 16.5, lineHeight: 1.45, color: INK, flex: 1 }}>{item.text}</span>
                  <span className="font-mono select-none shrink-0" style={{ fontSize: 16, color: INK_FAINT }} aria-hidden>
                    ⠿
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="case-focus font-mono transition-opacity hover:opacity-100 shrink-0"
                    style={{ fontSize: 11, color: INK_FAINT, opacity: 0.6, letterSpacing: "0.1em" }}
                  >
                    УБРАТЬ
                  </button>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}
      </div>

      {/* Pool */}
      <div className="mt-11">
        <div className="flex items-center gap-3 mb-4">
          <MonoLabel>Доступные шаги</MonoLabel>
          <div className="flex-1" style={{ height: 1, background: RULE_SOFT }} />
        </div>
        <div className="space-y-2.5">
          {available.length === 0 && (
            <p className="py-4" style={{ fontSize: 15, color: INK_FAINT }}>
              Все шаги добавлены. Уберите лишние, если ошиблись.
            </p>
          )}
          {available.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onAdd(item)}
              className="case-focus w-full text-left group transition-colors"
              style={{ border: `1px solid ${RULE_SOFT}`, borderRadius: 8, background: PAPER }}
            >
              <div className="flex items-center gap-4 py-4 px-5">
                <span
                  className="font-mono shrink-0 transition-colors group-hover:text-[color:var(--brand)]"
                  style={{ fontSize: 17, color: INK_FAINT, width: 26, textAlign: "center", ["--brand" as string]: BRAND }}
                >
                  +
                </span>
                <span style={{ fontSize: 16.5, lineHeight: 1.45, color: INK_SOFT, flex: 1 }}>{item.text}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <ArrowButton label={busy ? "Проверка…" : "Проверить порядок"} onClick={onSubmit} disabled={busy || sequence.length === 0} size={24} />
      </div>
    </motion.div>
  );
}

/* ── Stage 2 review ────────────────────────────────────────── */
function Stage2Review({ submit, onFinish, busy }: { submit: SubmitResponse; onFinish: () => void; busy: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-2">
        <MonoLabel color={BRAND}>Этап 2 — проверка</MonoLabel>
        <MonoLabel color={INK}>
          {submit.stage2_score} / {submit.stage2_max} баллов · {submit.matched}/{submit.total_correct} на месте
        </MonoLabel>
      </div>
      <Rule />

      <div className="mt-3 space-y-px" style={{ background: RULE_SOFT }}>
        {submit.feedback.map((f) => {
          const tone = f.is_distractor ? WRONG : f.placed_correctly ? RIGHT : "var(--warning)";
          const tag = f.is_distractor ? "ЛИШНИЙ" : f.placed_correctly ? "ВЕРНО" : "НЕ ТА ПОЗИЦИЯ";
          return (
            <div key={f.id} style={{ background: PAPER }} className="py-5">
              <div className="flex items-start gap-4">
                <span className="font-mono shrink-0" style={{ fontSize: 13, color: tone, width: 28 }}>
                  {String(f.placed_position).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <span style={{ fontSize: 16.5, lineHeight: 1.45, color: INK, flex: 1 }}>{f.text}</span>
                    <span className="font-mono shrink-0" style={{ fontSize: 11, color: tone, letterSpacing: "0.12em", marginTop: 3 }}>
                      {tag}
                    </span>
                  </div>
                  <p className="mt-2" style={{ fontSize: 15, lineHeight: 1.55, color: INK_SOFT }}>
                    {f.explain}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <ArrowButton label={busy ? "Завершение…" : "Итоги и разбор"} onClick={onFinish} disabled={busy} size={24} />
      </div>
    </motion.div>
  );
}

/* ── Result ────────────────────────────────────────────────── */
function Result({ result, onRestart }: { result: CompleteResponse; onRestart: () => void }) {
  const router = useRouter();
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
      <MonoLabel color={BRAND}>Кейс завершён</MonoLabel>
      <div className="mt-5 flex items-end gap-4" style={{ paddingBottom: 6 }}>
        <span
          className="font-display"
          style={{ fontSize: "clamp(72px,14vw,132px)", lineHeight: 0.92, letterSpacing: "-0.05em", fontWeight: 600, color: BRAND }}
        >
          {result.score_percent}
        </span>
        <span className="font-display mb-4" style={{ fontSize: 36, color: INK_FAINT, fontWeight: 500 }}>
          %
        </span>
      </div>

      <div className="mt-8 mb-12">
        <Rule />
        <div className="grid grid-cols-3">
          {[
            ["Этап 1", `${result.stage1_score} / 50`],
            ["Этап 2", `${result.stage2_score} / 50`],
            ["Итого", `${result.score} / ${result.max_score}`],
          ].map(([k, v]) => (
            <div key={k} className="py-6">
              <MonoLabel>{k}</MonoLabel>
              <div className="mt-2 font-display" style={{ fontSize: 26, color: INK, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {v}
              </div>
            </div>
          ))}
        </div>
        <Rule />
      </div>

      {/* Correct chronology */}
      <MonoLabel color={INK}>Верная хронология процедуры</MonoLabel>
      <div className="mt-5 mb-12 space-y-px" style={{ background: RULE_SOFT }}>
        {result.sequence_review.map((s) => (
          <div key={s.position} style={{ background: PAPER }} className="py-5">
            <div className="flex items-start gap-4">
              <span className="font-mono shrink-0" style={{ fontSize: 13, color: BRAND, width: 28 }}>
                {String(s.position).padStart(2, "0")}
              </span>
              <div className="flex-1">
                <p style={{ fontSize: 16.5, lineHeight: 1.45, color: INK }}>{s.text}</p>
                <p className="mt-2" style={{ fontSize: 15, lineHeight: 1.55, color: INK_SOFT }}>
                  {s.explain}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expert analysis */}
      <div style={{ background: PAPER_RAISED, border: `1px solid ${RULE}`, borderRadius: 10 }} className="p-7 sm:p-9">
        <MonoLabel color={BRAND}>Экспертный разбор</MonoLabel>
        <p className="mt-4" style={{ fontSize: 17.5, lineHeight: 1.7, color: INK }}>
          {result.expert_analysis}
        </p>
      </div>

      <div className="mt-11 flex items-center gap-8 flex-wrap">
        <ArrowButton label="Пройти заново" glyph="↻" onClick={onRestart} size={20} />
        <button
          type="button"
          onClick={() => router.push("/cases")}
          className="case-focus font-mono uppercase transition-opacity hover:opacity-60"
          style={{ fontSize: 12, letterSpacing: "0.18em", color: INK_SOFT }}
        >
          ← Все кейсы
        </button>
      </div>
    </motion.div>
  );
}
