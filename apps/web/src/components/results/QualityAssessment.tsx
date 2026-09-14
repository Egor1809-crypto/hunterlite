"use client";

export interface QualityReport {
  criteria: { id: string; layer: string; label: string; max_score: number; score: number;
    explanation: string; evidence: Evidence | null }[];
  deductions: (Evidence & { category: string; label: string; penalty: number })[];
  positive: number; penalty: number; cap: number; total: number; summary: string;
  sources: { id: string; article: string | null; text: string }[];
}
interface Evidence { message_index: number; quote: string; explanation: string; source_id?: string | null; source_quote?: string | null }
const labels: Record<string, string> = {
  script_adherence: "Выяснение ситуации", objection_handling: "Работа с сомнениями",
  communication: "Ясность и уважение", result: "Рекомендация и следующий шаг",
  chain_traversal: "Глубина разбора", human_factor: "Поддержка клиента", legal_accuracy: "Правовая точность",
};
const number = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 1 });

export default function QualityAssessment({ report }: { report: QualityReport }) {
  function quote(evidence: Evidence) {
    const source = report.sources.find(s => s.id === evidence.source_id);
    return <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
      <p>Ваша реплика {evidence.message_index + 1}</p>
      <blockquote className="border-l-2 pl-3" style={{ borderColor: "var(--accent)" }}>«{evidence.quote}»</blockquote>
      {source && <details><summary className="cursor-pointer py-2">Основание: {source.article || "База знаний"}</summary><p>{evidence.source_quote}</p></details>}
    </div>;
  }
  return <section aria-labelledby="quality-title" className="glass-panel mb-8 rounded-2xl p-5 md:p-8">
    <h2 id="quality-title" className="font-display text-2xl">За что начислены баллы</h2>
    <p className="mt-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{report.summary}</p>
    <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>Полное выполнение — весь балл за действие, частичное — половина. Без подтверждения в разговоре — 0. Длина диалога баллов не добавляет.</p>
    <div className="mt-6 divide-y" style={{ borderColor: "var(--border-color)" }}>
      {Object.entries(labels).map(([key, label]) => {
        const rows = report.criteria.filter(c => c.layer === key);
        const earned = rows.reduce((s, r) => s + r.score, 0), max = rows.reduce((s, r) => s + r.max_score, 0);
        return <details key={key} className="py-1" style={{ borderColor: "var(--border-color)" }}>
          <summary className="cursor-pointer py-4"><span className="inline-flex w-[calc(100%-1.5rem)] flex-wrap justify-between gap-2 font-medium"><span>{label}</span><span className="tabular-nums">{number(earned)} / {max}</span></span></summary>
          <ul className="space-y-5 pb-5 pl-4">{rows.map(row => <li key={row.id}>
            <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{row.label}</span><strong className="tabular-nums">{number(row.score)} / {row.max_score}</strong></div>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{row.explanation}</p>
            {row.evidence && quote(row.evidence)}
          </li>)}</ul>
        </details>;
      })}
    </div>
    <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--border-color)" }}>
      <h3 className="font-semibold">Штрафы за ошибки</h3>
      {report.deductions.length === 0 ? <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>Подтверждённых нарушений нет. Дополнительные баллы за это не начисляются.</p> :
        <ul className="mt-3 space-y-5">{report.deductions.map(d => <li key={d.category}>
          <p className="flex flex-wrap justify-between gap-2"><strong>{d.label}</strong><strong className="tabular-nums">{number(d.penalty)}</strong></p>
          <p className="mt-1 text-sm">{d.explanation}</p>{quote(d)}
        </li>)}</ul>}
      <p className="mt-5 font-semibold tabular-nums">Начислено {number(report.positive)} · Штрафы {number(report.penalty)} · Итог {number(report.total)} / 100</p>
      {report.cap < 100 && <p className="mt-2 text-sm">Из-за критического нарушения итог ограничен {report.cap} баллами.</p>}
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>Итог не может быть ниже 0. Шкала качества · версия 1.</p>
    </div>
  </section>;
}
