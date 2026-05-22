export const trainingModes = ["talk", "exam", "chat_test"] as const;
export type TrainingMode = (typeof trainingModes)[number];

export const trainingDifficulties = ["basic", "medium", "hard"] as const;
export type TrainingDifficulty = (typeof trainingDifficulties)[number];

export const aiClientCharacters = [
  "anxious",
  "aggressive",
  "skeptical",
  "distrustful",
  "rushed",
] as const;
export type AiClientCharacter = (typeof aiClientCharacters)[number];

export const trainingEvaluationCriteria = [
  "legal_accuracy",
  "answer_structure",
  "safe_wording",
  "empathy",
  "objection_handling",
] as const;
export type TrainingEvaluationCriterion = (typeof trainingEvaluationCriteria)[number];

export const passingScore = 88;

export const maxQuestionsByDifficulty = {
  basic: 20,
  medium: 50,
  hard: 100,
} as const satisfies Record<TrainingDifficulty, number>;

export const bankruptcyTopics = [
  "Условия банкротства физического лица",
  "Последствия банкротства",
  "Имущество должника",
  "Процедура и сроки",
  "Стоимость и риски",
  "Возражения клиента",
  "Безопасные формулировки юриста",
  "Ипотечное жильё при банкротстве",
  "Долги, которые не списываются",
] as const;

export type EvaluationScore = {
  criterion: TrainingEvaluationCriterion;
  score: number;
  comment: string;
};

export type TrainingResult = {
  score: number;
  passed: boolean;
  criteria: EvaluationScore[];
  mistakes: string[];
  recommendations: string[];
};

export type TrainingScoringInput = {
  score: number;
  mistakes?: string[];
  recommendations?: string[];
  answeredSteps?: number;
  totalSteps?: number;
};

export type BankruptcyProcedureStep = {
  id: string;
  title: string;
  order: number;
};

export type SequenceTask = {
  id: string;
  topic: string;
  prompt: string;
  steps: BankruptcyProcedureStep[];
};

export const validateScore = (score: number) =>
  Number.isInteger(score) && score >= 0 && score <= 100;

export const isPassingScore = (score: number) =>
  validateScore(score) && score >= passingScore;

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

const hasAny = (text: string, keywords: readonly string[]) =>
  keywords.some((keyword) => text.includes(keyword));

const countByKeywords = (mistakes: readonly string[], keywords: readonly string[]) =>
  mistakes.filter((mistake) => hasAny(mistake.toLowerCase(), keywords)).length;

export const calculateTrainingResult = ({
  score,
  mistakes = [],
  recommendations = [],
  answeredSteps = 0,
  totalSteps = 0,
}: TrainingScoringInput): TrainingResult => {
  const normalizedScore = clampScore(score);
  const cleanMistakes = mistakes.filter((mistake) => mistake.trim().length > 0);
  const cleanRecommendations = recommendations.filter((recommendation) => recommendation.trim().length > 0);
  const completionPenalty =
    totalSteps > 0 ? Math.max(0, Math.round(((totalSteps - answeredSteps) / totalSteps) * 14)) : 0;

  const legalIssues = countByKeywords(cleanMistakes, ["закон", "срок", "суд", "имуще", "долг", "ипотек", "спис"]);
  const structureIssues = countByKeywords(cleanMistakes, ["структур", "шаг", "логик", "непол", "пропущ"]);
  const safeWordingIssues = countByKeywords(cleanMistakes, ["гарант", "обещ", "точно", "100%", "без риск", "опасн"]);
  const empathyIssues = countByKeywords(cleanMistakes, ["эмпат", "тон", "груб", "давлен", "тревог"]);
  const objectionIssues = countByKeywords(cleanMistakes, ["возраж", "сомнен", "дорог", "подума", "недовер"]);

  const criteria: EvaluationScore[] = [
    {
      criterion: "legal_accuracy",
      score: clampScore(normalizedScore - legalIssues * 9),
      comment: legalIssues ? "Есть юридические неточности или неполные пояснения." : "Юридическая логика выдержана.",
    },
    {
      criterion: "answer_structure",
      score: clampScore(normalizedScore - structureIssues * 7 - completionPenalty),
      comment: structureIssues || completionPenalty ? "Ответ нужно вести по более полной последовательности шагов." : "Ответ структурирован и понятен клиенту.",
    },
    {
      criterion: "safe_wording",
      score: clampScore(normalizedScore - safeWordingIssues * 12),
      comment: safeWordingIssues ? "Есть рискованные обещания, их нужно заменить безопасными формулировками." : "Формулировки юридически безопасны.",
    },
    {
      criterion: "empathy",
      score: clampScore(normalizedScore - empathyIssues * 8),
      comment: empathyIssues ? "Нужно мягче отработать тревогу клиента и подтвердить понимание ситуации." : "Тон консультации спокойный и поддерживающий.",
    },
    {
      criterion: "objection_handling",
      score: clampScore(normalizedScore - objectionIssues * 8),
      comment: objectionIssues ? "Возражение клиента раскрыто не полностью." : "Возражения обработаны без давления.",
    },
  ];

  const weights: Record<TrainingEvaluationCriterion, number> = {
    legal_accuracy: 0.3,
    answer_structure: 0.2,
    safe_wording: 0.2,
    empathy: 0.15,
    objection_handling: 0.15,
  };
  const finalScore = clampScore(criteria.reduce((sum, item) => sum + item.score * weights[item.criterion], 0));
  const lowCriteria = criteria.filter((item) => item.score < 80).map((item) => item.criterion);
  const generatedRecommendations = [
    lowCriteria.includes("legal_accuracy") ? "Повторить юридические условия, сроки и последствия процедуры банкротства." : undefined,
    lowCriteria.includes("answer_structure") ? "Тренировать ответ по схеме: ситуация клиента, закон, риски, следующий шаг." : undefined,
    lowCriteria.includes("safe_wording") ? "Заменять гарантии на безопасные формулировки с условиями и оговорками." : undefined,
    lowCriteria.includes("empathy") ? "Добавлять короткое подтверждение тревоги клиента перед юридическим блоком." : undefined,
    lowCriteria.includes("objection_handling") ? "Отработать возражения клиента через уточнение причины и спокойный разбор риска." : undefined,
  ].filter((item): item is string => Boolean(item));

  return {
    score: finalScore,
    passed: isPassingScore(finalScore),
    criteria,
    mistakes: cleanMistakes.length ? cleanMistakes : ["Ошибок не обнаружено"],
    recommendations: cleanRecommendations.length
      ? cleanRecommendations
      : generatedRecommendations.length
        ? generatedRecommendations
        : ["Отличная работа: сохраните структуру ответа и безопасные формулировки."],
  };
};

export const getMaxQuestionCount = (difficulty: TrainingDifficulty) =>
  maxQuestionsByDifficulty[difficulty];

export const isCorrectProcedureSequence = (
  task: SequenceTask,
  submittedStepIds: readonly string[],
) => {
  const correctStepIds = [...task.steps]
    .sort((left, right) => left.order - right.order)
    .map((step) => step.id);

  return (
    correctStepIds.length === submittedStepIds.length &&
    correctStepIds.every((stepId, index) => stepId === submittedStepIds[index])
  );
};
