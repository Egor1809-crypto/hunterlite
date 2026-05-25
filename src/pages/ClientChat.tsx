import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { ShieldAlert, Send, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { from: "ai" | "user"; text: string };

const faqPairs: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ["условия", "подать", "заявлен", "начать", "основания"],
    answer: "Подать на банкротство можно при долге от 500 000 рублей и просрочке от 3 месяцев. Также возможно внесудебное банкротство при долге от 25 000 до 1 000 000 рублей через МФЦ, если исполнительное производство окончено по п.4 ч.1 ст.46 ФЗ-229.",
  },
  {
    keywords: ["сколько", "стоит", "цена", "стоимость", "расход"],
    answer: "Стоимость процедуры зависит от пути. Внесудебное банкротство через МФЦ бесплатно. Судебная процедура включает госпошлину (300 руб.), вознаграждение арбитражного управляющего (25 000 руб.) и расходы на публикации. Услуги юриста оплачиваются отдельно.",
  },
  {
    keywords: ["жильё", "квартир", "дом", "ипотек", "единствен"],
    answer: "Единственное жилье, не находящееся в ипотеке, защищено исполнительским иммунитетом и не включается в конкурсную массу. Если жилье в ипотеке, оно может быть реализовано для погашения залогового кредитора.",
  },
  {
    keywords: ["автомобиль", "машин", "авто", "транспорт"],
    answer: "Автомобиль, как правило, включается в конкурсную массу и подлежит реализации. Исключение — если авто необходимо для работы (такси, перевозки) и его стоимость не превышает 10 000 рублей.",
  },
  {
    keywords: ["списа", "какие долги", "нельзя списать", "не спиш"],
    answer: "Не списываются: алименты, возмещение вреда жизни/здоровью, субсидиарная ответственность, долги по зарплате (если вы были работодателем), требования о возмещении морального вреда и требования по текущим платежам.",
  },
  {
    keywords: ["последств", "после банкротств", "ограничен", "кредит"],
    answer: "После завершения процедуры: 5 лет нужно сообщать о банкротстве при обращении за кредитом, 3 года нельзя занимать руководящие должности в юрлицах, 5 лет — в банках/страховых, повторное банкротство возможно через 5 лет.",
  },
  {
    keywords: ["срок", "длительность", "сколько длит", "время"],
    answer: "Внесудебное банкротство длится 6 месяцев. Судебная процедура реструктуризации — до 3 лет, реализация имущества — обычно 6 месяцев, но может быть продлена. В среднем судебное банкротство занимает 8-12 месяцев.",
  },
  {
    keywords: ["документ", "какие нужны", "справк", "собрать"],
    answer: "Основные документы: паспорт, СНИЛС, ИНН, справка о задолженности, выписки по счетам за 3 года, справка 2-НДФЛ за 3 года, выписка из ЕГРН, копии кредитных договоров, опись имущества и список кредиторов.",
  },
  {
    keywords: ["зарплат", "доход", "работа", "трудоустро"],
    answer: "Во время процедуры реализации имущества должнику выделяется прожиточный минимум на него и иждивенцев. Остальная часть дохода направляется в конкурсную массу. При реструктуризации зарплата остается у должника, но он платит по плану.",
  },
  {
    keywords: ["внесудебн", "мфц", "бесплатн"],
    answer: "Внесудебное банкротство подается через МФЦ бесплатно при долге от 25 000 до 1 000 000 рублей. Условие: приставы должны окончить исполнительное производство из-за отсутствия имущества (п.4 ч.1 ст.46 ФЗ-229).",
  },
  {
    keywords: ["управляющ", "арбитражн", "финансов"],
    answer: "Финансовый управляющий — обязательный участник судебной процедуры. Его вознаграждение: 25 000 руб. фиксированно + 7% от реализованного имущества. Управляющего выбирает суд из указанной вами СРО.",
  },
  {
    keywords: ["кредитор", "банк", "коллектор", "звонят", "угрожа"],
    answer: "После подачи заявления о банкротстве и введения процедуры все требования кредиторов прекращаются, звонки и претензии должны прекратиться. Если коллекторы продолжают беспокоить, это можно обжаловать.",
  },
  {
    keywords: ["сделк", "продал", "подарил", "перевел"],
    answer: "Сделки за последние 3 года могут быть оспорены управляющим: дарение, продажа по заниженной цене, перевод имущества на родственников. Если суд признает сделку недействительной, имущество вернут в конкурсную массу.",
  },
  {
    keywords: ["супруг", "муж", "жена", "совместн"],
    answer: "При банкротстве одного из супругов совместное имущество может быть реализовано с выделением доли второго супруга. Супруг получает свою долю деньгами. Личное имущество супруга не затрагивается.",
  },
  {
    keywords: ["ип", "предпринимат", "бизнес"],
    answer: "ИП может пройти банкротство как физическое лицо. Статус ИП будет прекращен, повторная регистрация возможна через 5 лет. Долги по бизнесу списываются наравне с личными (кроме несписываемых).",
  },
  {
    keywords: ["консультац", "помощь", "юрист", "записать"],
    answer: "Для детального разбора вашей ситуации рекомендую записаться на бесплатную консультацию с юристом. Он проанализирует документы и подберет оптимальную стратегию. Нажмите кнопку «Оставить заявку» выше.",
  },
];

const defaultAnswer = "К сожалению, я не могу точно ответить на этот вопрос. Для детального разбора вашей ситуации рекомендую записаться на бесплатную консультацию с юристом. Нажмите «Оставить заявку» в шапке страницы.";
const greetingMessage = "Здравствуйте! Я ИИ-помощник по вопросам банкротства физических лиц. Задайте вопрос — я постараюсь помочь. Например: условия банкротства, защита жилья, стоимость процедуры, последствия.";

function findAnswer(userText: string): string {
  const lower = userText.toLowerCase();
  let bestMatch: { answer: string; score: number } = { answer: defaultAnswer, score: 0 };

  for (const faq of faqPairs) {
    const score = faq.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestMatch.score) {
      bestMatch = { answer: faq.answer, score };
    }
  }

  return bestMatch.answer;
}

export default function ClientChat() {
  const [messages, setMessages] = useState<Msg[]>([{ from: "ai", text: greetingMessage }]);
  const [input, setInput] = useState("");

  const send = () => {
    const t = input.trim();
    if (!t) return;
    const answer = findAnswer(t);
    setMessages((m) => [...m, { from: "user", text: t }, { from: "ai", text: answer }]);
    setInput("");
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <header className="h-14 border-b border-border bg-card px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <Link to="/client" className="flex items-center gap-2.5">
          <BrandLogo className="h-8 w-8" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight text-primary">HUNTERLITE</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Помощь клиентам</div>
          </div>
        </Link>
        <Button asChild className="bg-primary hover:bg-primary/90"><Link to="/client/lead">Оставить заявку</Link></Button>
      </header>

      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="font-display text-3xl font-bold text-primary tracking-tight">
            Задайте вопрос по банкротству физических лиц
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            ИИ-помощник ответит на типовые вопросы. Для детального разбора оставьте заявку — с вами свяжется юрист.
          </p>
        </div>

        <Card className="p-3 mb-4 bg-warning-soft border-warning/30 flex gap-2.5">
          <ShieldAlert className="h-4 w-4 text-warning-soft-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-warning-soft-foreground">
            <span className="font-semibold">ИИ-помощник не заменяет консультацию юриста.</span>{" "}
            Ответ носит информационный характер и не является юридической рекомендацией.
          </div>
        </Card>

        <Card className="flex-1 flex flex-col shadow-card overflow-hidden">
          <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-3 max-w-xl", m.from === "user" && "ml-auto flex-row-reverse")}>
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  m.from === "ai" ? "bg-ai-soft text-ai-soft-foreground" : "bg-primary text-primary-foreground")}>
                  {m.from === "ai" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className={cn("rounded-2xl px-4 py-2.5 text-sm shadow-card",
                  m.from === "ai" ? "bg-muted/50 rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm")}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-3 flex gap-2">
            <Input
              placeholder="Ваш вопрос..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="h-11"
            />
            <Button onClick={send} className="h-11 bg-primary hover:bg-primary/90 px-4"><Send className="h-4 w-4 mr-1.5" /> Задать вопрос</Button>
          </div>
        </Card>

        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link to="/client/lead">Оставить заявку на бесплатную консультацию</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
