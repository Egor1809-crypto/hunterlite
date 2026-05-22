import type {
  AiTrainingReplyDto,
  AiTrainingReplyRequestDto,
  CallScriptDto,
} from "@/lib/api-contracts";

export const defaultCallScripts: CallScriptDto[] = [
  {
    id: "default-debtor-property",
    title: "Симуляция звонка",
    clientProfile: {
      name: "Алексей",
      character: "anxious",
      situation: "Есть единственная квартира, автомобиль и опасение потерять имущество.",
    },
    firstNodeId: "default-property-1",
    nodes: [
      {
        id: "default-property-1",
        scriptId: "default-debtor-property",
        clientReplica:
          "Здравствуйте! Я бы хотел узнать, что произойдет с моим имуществом, если я начну процедуру банкротства? У меня есть квартира и машина.",
        answerFormat: "voice",
        keywordRules: ["единственное жильё", "автомобиль", "реализация имущества", "исключения"],
        isSuccessEnd: false,
        isFailEnd: false,
      },
      {
        id: "default-property-2",
        scriptId: "default-debtor-property",
        clientReplica:
          "То есть квартиру точно не заберут, если это моё единственное жильё? А если она в ипотеке?",
        answerFormat: "voice",
        keywordRules: ["единственное жильё", "ипотека", "залог", "суд"],
        isSuccessEnd: false,
        isFailEnd: false,
      },
      {
        id: "default-property-3",
        scriptId: "default-debtor-property",
        clientReplica:
          "Понял. А машина нужна мне для работы. Есть шанс её сохранить?",
        answerFormat: "voice",
        keywordRules: ["доход", "работа", "ходатайство", "финансовый управляющий"],
        isSuccessEnd: false,
        isFailEnd: false,
      },
      {
        id: "default-property-4",
        scriptId: "default-debtor-property",
        clientReplica:
          "А что мне нельзя делать с имуществом перед подачей заявления, чтобы потом не было проблем?",
        answerFormat: "voice",
        keywordRules: ["сделки", "оспаривание", "дарение", "продажа ниже рынка"],
        isSuccessEnd: false,
        isFailEnd: false,
      },
      {
        id: "default-property-5",
        scriptId: "default-debtor-property",
        clientReplica:
          "Спасибо. Тогда какие документы по имуществу мне подготовить для первой консультации?",
        answerFormat: "voice",
        keywordRules: ["выписки", "ПТС", "договоры", "справки", "реестр имущества"],
        isSuccessEnd: true,
        isFailEnd: false,
      },
    ],
  },
];

const riskyPromisePattern = /(точно|гарантир|100%|никогда|ничего не заберут|всё сохранят)/i;
const empathyPattern = /(понимаю|давайте разбер|важно уточнить|ситуац|проверим)/i;

export const createLocalTrainingReply = ({
  step,
  totalSteps,
  userMessage,
  scriptContext,
}: AiTrainingReplyRequestDto): AiTrainingReplyDto => {
  const nextReplica = scriptContext?.nextClientReplica?.trim();
  const isLastStep = step + 1 >= totalSteps || !nextReplica;
  const mistakes: string[] = [];
  const recommendations: string[] = [];
  let scoreDelta = 0;

  if (riskyPromisePattern.test(userMessage)) {
    scoreDelta += 12;
    mistakes.push("Есть рискованное обещание без оговорки о проверке документов и позиции суда.");
    recommendations.push("Избегайте гарантий: объясняйте общий порядок и фиксируйте, что итог зависит от документов.");
  }

  if (!empathyPattern.test(userMessage) && userMessage.length < 120) {
    scoreDelta += 5;
    recommendations.push("Добавьте короткую эмпатию и уточняющий вопрос, чтобы клиенту было спокойнее.");
  }

  return {
    reply: isLastStep
      ? "Спасибо, стало понятнее. Я подготовлю документы и хочу записаться на консультацию, чтобы разобрать мою ситуацию подробно."
      : nextReplica,
    scoreDelta,
    mistakes,
    recommendations,
    sessionEnded: isLastStep,
  };
};
