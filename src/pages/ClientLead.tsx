import { Link } from "react-router-dom";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BackButton } from "@/components/BackButton";
import { BrandLogo } from "@/components/BrandLogo";
import { CheckCircle2, Send } from "lucide-react";

export default function ClientLead() {
  const [done, setDone] = useState(false);
  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <header className="h-14 border-b border-border bg-card px-4 sm:px-6 flex items-center justify-between">
        <Link to="/client" className="flex items-center gap-2.5">
          <BrandLogo className="h-8 w-8" />
          <div className="text-sm font-bold tracking-tight text-primary">HUNTERLITE</div>
        </Link>
        <BackButton label="Назад к чату" fallback="/client" />
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <Card className="max-w-md w-full p-6 sm:p-8 shadow-elevated">
          {done ? (
            <div className="text-center py-6">
              <div className="h-14 w-14 rounded-full bg-success-soft text-success-soft-foreground flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="font-display text-2xl font-bold text-primary mt-4">Заявка отправлена</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Юрист свяжется с вами в течение рабочего дня для бесплатной консультации.
              </p>
              <Button asChild className="mt-6 bg-primary hover:bg-primary/90"><Link to="/client">Вернуться к чату</Link></Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-ai flex items-center justify-center text-white">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-primary">Заявка на консультацию</h1>
                  <p className="text-sm text-muted-foreground mt-1.5">Бесплатно. Без обязательств.</p>
                </div>
              </div>
              <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
                <div className="space-y-1.5"><Label htmlFor="n">Ваше имя</Label><Input id="n" required defaultValue="" placeholder="Иван" /></div>
                <div className="space-y-1.5"><Label htmlFor="p">Телефон</Label><Input id="p" required type="tel" placeholder="+7 (___) ___-__-__" /></div>
                <div className="space-y-1.5">
                  <Label htmlFor="d">Кратко опишите ситуацию</Label>
                  <Textarea id="d" rows={4} placeholder="Сумма долгов, кредиторы, наличие имущества…" />
                </div>
                <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90"><Send className="h-4 w-4 mr-1.5" /> Оставить заявку</Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Отправляя форму, вы соглашаетесь с обработкой персональных данных.
                </p>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
