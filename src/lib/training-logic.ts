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
