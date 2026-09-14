"use client";

import Link from "next/link";
import { Award, Check, Lock } from "@/components/ui/RuneIcons";
import styles from "./CertificatePath.module.css";

interface PathExam {
  id: string;
  title: string;
  passed: boolean;
  is_locked: boolean;
}

export function CertificatePath({ exams, finalPassed, onCertificate }: {
  exams: PathExam[];
  finalPassed: boolean;
  onCertificate: () => void;
}) {
  const modules = exams.filter((exam) => exam.id !== "exam-5");
  const currentId = modules.find((exam) => !exam.passed && !exam.is_locked)?.id;
  const finalOpen = exams.some((exam) => exam.id === "exam-5" && !exam.is_locked);

  return (
    <ol className={styles.path} aria-label="Этапы получения сертификата">
      {modules.map((exam, index) => {
        const state = exam.passed ? "passed" : exam.is_locked ? "locked" : "available";
        const label = exam.passed ? "Сдано" : exam.is_locked ? "Закрыто" : "Доступно";
        const content = <>
          <span className={styles.node}>
            {exam.passed ? <Check size={19} /> : <span aria-hidden="true">{index + 1}</span>}
          </span>
          <span className={styles.label}>Модуль {index + 1}</span>
          <span className={styles.status}>{label}</span>
        </>;
        return (
          <li key={exam.id} className={styles.step} data-state={state}>
            {exam.is_locked && !exam.passed ? (
              <span className={styles.control} aria-label={`${exam.title}. ${label}`}>{content}</span>
            ) : (
              <Link href={`/exam/${exam.id}`} className={styles.control}
                aria-label={`Модуль ${index + 1}: ${exam.title}. ${label}`}
                aria-current={exam.id === currentId ? "step" : undefined}>
                {content}
              </Link>
            )}
          </li>
        );
      })}
      <li className={styles.step} data-state={finalPassed ? "passed" : finalOpen ? "available" : "locked"}>
        <button type="button" className={styles.control} onClick={onCertificate}
          aria-label="Посмотреть сертификат и условия получения">
          <span className={styles.node}>
            {finalPassed || finalOpen ? <Award size={21} /> : <Lock size={18} />}
          </span>
          <span className={styles.label}>Сертификат</span>
          <span className={styles.status}>{finalPassed ? "Получен" : finalOpen ? "Финал" : "После сдачи"}</span>
        </button>
      </li>
    </ol>
  );
}
