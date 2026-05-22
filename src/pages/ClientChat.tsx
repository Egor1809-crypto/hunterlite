import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { ShieldAlert, Send, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { from: "ai" | "user"; text: string };

const aiAnswers = [
  "Здравствуйте! Я ИИ-помощник по вопросам банкротства физических лиц. Опишите вашу ситуацию — какие долги и за какой период.",
  "Спасибо. В вашей ситуации возможны судебная и внесудебная процедуры. Точный выбор зависит от размера долга и наличия имущества. Это требует консультации юриста.",
  "Единственное жильё, не находящееся в ипотеке, как правило, защищено законом. Однако в каждом случае нужен анализ документов. Я могу помочь записаться на бесплатную консультацию.",
];

export default function ClientChat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([{ from: "ai", text: aiAnswers[0] }]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(1);

  const send = () => {
    const t = input.trim();
    if (!t) return;
    setMessages((m) => [...m, { from: "user", text: t }, { from: "ai", text: aiAnswers[Math.min(step, aiAnswers.length - 1)] }]);
    setInput("");
    setStep((s) => s + 1);
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
              placeholder="Ваш вопрос…"
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
