export type ArenaQuestion = {
  id: string;
  sourceQuestionNumber: number;
  topic: string;
  question: string;
  law: string;
  source: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
};

export const arenaQuestions: ArenaQuestion[] = [
  {
    id: "bfl-court-jurisdiction",
    sourceQuestionNumber: 5,
    topic: "Подсудность",
    question: "Какой суд рассматривает дела о банкротстве граждан?",
    law: "Пленум ВС РФ N 45 п. 3; 127-ФЗ ст. 213.4 п. 1",
    source: "Hunter888: advanced_court_practice.py",
    options: [
      {
        text: "Дела рассматривает арбитражный суд по месту жительства гражданина-должника.",
        isCorrect: true,
      },
      { text: "Юрист не знает о дистанционном участии.", isCorrect: false },
      { text: "Не использует «Мой арбитр» для подачи документов.", isCorrect: false },
      { text: "Не учитывает подсудность при выборе стратегии.", isCorrect: false },
    ],
  },
  {
    id: "bfl-realization-term",
    sourceQuestionNumber: 46,
    topic: "Реализация имущества",
    question: "Каков срок процедуры реализации имущества гражданина?",
    law: "127-ФЗ ст. 213.24",
    source: "Hunter888: facts_remaining.py",
    options: [
      { text: "Путаница срока реализации с общим сроком банкротства.", isCorrect: false },
      {
        text: "Реализация имущества вводится на срок не более шести месяцев и может продлеваться в установленном порядке.",
        isCorrect: true,
      },
      { text: "Незнание о возможности продления.", isCorrect: false },
      { text: "Непонимание действий управляющего в этот период.", isCorrect: false },
    ],
  },
  {
    id: "bfl-publications",
    sourceQuestionNumber: 85,
    topic: "Публикации",
    question: "Где публикуются сведения о банкротстве гражданина?",
    law: "127-ФЗ ст. 213.7",
    source: "Hunter888: facts_eligibility_procedure.py",
    options: [
      { text: "Не предупреждают клиентов о расходах на публикации.", isCorrect: false },
      { text: "Забывают о необходимости публикации и в газете, и в ЕФРСБ.", isCorrect: false },
      {
        text: "Сведения публикуются в ЕФРСБ, а также в газете «Коммерсантъ» в предусмотренных законом случаях.",
        isCorrect: true,
      },
      { text: "Не учитывают стоимость публикаций в общей смете расходов на банкротство.", isCorrect: false },
    ],
  },
  {
    id: "bfl-out-of-court-term",
    sourceQuestionNumber: 90,
    topic: "Внесудебное банкротство",
    question: "Каков срок процедуры внесудебного банкротства гражданина?",
    law: "127-ФЗ ст. 223.2, 223.6",
    source: "Hunter888: extrajudicial_bankruptcy.py",
    options: [
      { text: "Менеджеры не знают о внесудебном банкротстве и предлагают только судебное.", isCorrect: false },
      { text: "Путают сроки — говорят 12 месяцев вместо 6.", isCorrect: false },
      { text: "Утверждают, что внесудебное банкротство платное.", isCorrect: false },
      {
        text: "Процедура длится шесть месяцев со дня включения сведений о её возбуждении в ЕФРСБ.",
        isCorrect: true,
      },
    ],
  },
  {
    id: "bfl-settlement-effects",
    sourceQuestionNumber: 207,
    topic: "Мировое соглашение",
    question: "Каковы последствия утверждения мирового соглашения в банкротстве гражданина?",
    law: "127-ФЗ ст. 213.31",
    source: "Hunter888: facts_eligibility_procedure.py",
    options: [
      {
        text: "Утверждение мирового соглашения прекращает производство по делу, а обязательства исполняются на его условиях.",
        isCorrect: true,
      },
      { text: "Считают, что мировое соглашение возможно только на стадии реструктуризации.", isCorrect: false },
      { text: "Не знают порядок утверждения мирового соглашения.", isCorrect: false },
      { text: "Путают мировое соглашение при банкротстве с мировым соглашением в обычном процессе.", isCorrect: false },
    ],
  },
];
