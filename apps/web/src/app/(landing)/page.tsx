"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, GraduationCap, ShieldCheck, Send } from "lucide-react";
import { useLandingAuth } from "@/components/landing/LandingAuthContext";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { CertificatePreview } from "@/components/certificate/CertificatePreview";

const stats = [
  { value: "18 000+", label: "квалифицированных юристов вышли из наших программ" },
  { value: "17 000+", label: "завершённых процедур в профессиональной практике" },
  { value: "11 лет", label: "опыта на рынке банкротства физических лиц" },
  { value: "800+", label: "партнёров доверяют нашей методологии" },
  { value: "80+", label: "специалистов в экспертной команде" },
  { value: "По всей России", label: "работаем удалённо и очно" },
];

const experts = [
  {
    name: "Василий Артин",
    role: "Эксперт по банкротству физических лиц",
    image: "/landing/experts/expert-2.jpeg",
  },
  {
    name: "Андрей Абукаев",
    role: "Практик переговоров и сопровождения процедур",
    image: "/landing/experts/expert-1.jpeg",
  },
  {
    name: "Елена Лященко",
    role: "Методолог программ повышения квалификации",
    image: "/landing/experts/expert-3.png",
  },
  {
    name: "Александр Герасимов",
    role: "Юрист по судебной практике и кейсам",
    image: "/landing/experts/expert-4.jpeg",
  },
];

const products = [
  {
    title: "AI-тренировки",
    text: "Диалоги и звонки с AI-клиентами, которые ведут себя как реальные должники: спорят, сомневаются, давят и проверяют на прочность. Ошибиться можно здесь — не с живым человеком.",
  },
  {
    title: "Кейсы и практика",
    text: "Интерактивные дела по банкротству: решения, последствия, скрытые факты и разбор от практиков. Видно, как выбор юриста отражается на судьбе человека.",
  },
  {
    title: "Экзамен и сертификат",
    text: "Объективная проверка знаний, отчёт о результате и сертификат — подтверждение, что вам можно доверить дело.",
  },
];

// Лента продуктов экосистемы (AI + право) — бегущая строка в стиле биржевого тикера.
const ecosystem = [
  "AI-ассистент юриста",
  "Анализ судебной практики",
  "Проверка контрагентов",
  "Генерация процессуальных документов",
  "Правовой поиск по 127-ФЗ",
  "Прогноз исхода дела",
  "Радар изменений в праве",
  "База знаний по банкротству",
  "AI-разбор кейсов",
  "Голосовые тренировки звонков",
  "Автоматизация документооборота",
  "Калькулятор процедур банкротства",
];

const tiers = [
  {
    tag: "Тариф 1 · старт",
    name: "Безоплатный",
    price: "0 ₽",
    per: "",
    note: "Войдите в профессию и попробуйте платформу без оплаты.",
    cta: "Начать безоплатно",
    featured: false,
    features: [
      "Тесты: 1500 вопросов по ФЗ-127 («острова»)",
      "База знаний (RAG) + Радар изменений",
      "Маняша — AI-помощник по базе знаний",
      "Конструктор клиента (после 1-го региона тестов)",
    ],
  },
  {
    tag: "Тариф 2 · эксперт",
    name: "Эксперт БФЛ",
    price: "по запросу",
    per: "",
    note: "Полный путь: обучение → практика → аттестация и сертификат.",
    cta: "Начать обучение",
    featured: true,
    features: [
      "Всё из «Безоплатного»",
      "Интерактивные кейсы БФЛ (реальная практика)",
      "AI-тренировки: чат и звонок с клиентом-должником",
      "Экзамены (5 механик) + сертификат аттестации",
      "История с разбором слабых мест от Маняши",
    ],
  },
  {
    tag: "Тариф 3 · команда",
    name: "Команда и партнёры",
    price: "по запросу",
    per: "",
    note: "Для бюро и партнёров: рост команды под контролем РОП.",
    cta: "Обсудить внедрение",
    featured: false,
    features: [
      "Всё из «Эксперта» для каждого сотрудника",
      "Командные KPI и аналитика РОП",
      "Назначение программ и контроль прогресса",
      "Приоритетная поддержка и онбординг",
    ],
  },
];

export default function LandingPage() {
  const { openRegister } = useLandingAuth();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7F1E8] text-[#18131D]">
      {/* Decorative backdrop — soft brand glows + faint grid, in the landing palette
          (echoes the subtle backdrop on the exam screen). Static, behind content. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute -left-[12%] -top-[8%] h-[46rem] w-[46rem] rounded-full opacity-[0.5] blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.16), transparent 70%)" }}
        />
        <div
          className="absolute right-[-10%] top-[28%] h-[40rem] w-[40rem] rounded-full opacity-[0.45] blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)" }}
        />
        <div
          className="absolute bottom-[-6%] left-[35%] h-[38rem] w-[38rem] rounded-full opacity-[0.4] blur-[130px]"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.10), transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(#D9C9E8 1px, transparent 1px), linear-gradient(90deg, #D9C9E8 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)",
          }}
        />
      </div>
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1680px] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="sticky top-0 z-20 flex h-auto flex-col border-b border-[#D9C9E8] bg-[#F7F1E8]/95 px-5 py-5 backdrop-blur lg:h-screen lg:border-b-0 lg:border-r lg:px-7 lg:py-7">
          <div className="flex items-center justify-between gap-4 lg:block">
            <Link href="/" className="inline-flex" aria-label="LegalHunter">
              <BrandLogo size="lg" />
            </Link>
          </div>

          <nav className="mt-8 hidden space-y-2 text-[15px] font-medium text-[#7B7084] lg:block" aria-label="Разделы лендинга">
            <a className="block rounded-full px-4 py-2 transition hover:bg-white hover:text-[#7C3AED]" href="#about">
              О нас
            </a>
            <a className="block rounded-full px-4 py-2 transition hover:bg-white hover:text-[#7C3AED]" href="#experts">
              Эксперты
            </a>
            <a className="block rounded-full px-4 py-2 transition hover:bg-white hover:text-[#7C3AED]" href="#products">
              Наши продукты
            </a>
          </nav>

          <div className="mt-auto hidden space-y-3 pt-8 lg:block">
            <a
              href="#tariffs"
              className="flex items-center justify-between rounded-2xl border border-[#D9C9E8] bg-white/55 px-4 py-4 text-sm font-semibold text-[#18131D] transition hover:border-[#B98CDA]"
            >
              <span className="flex items-center gap-2">
                <GraduationCap size={17} />
                Тарифы
              </span>
              <ArrowRight size={16} />
            </a>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-10 sm:px-8 lg:px-14 lg:py-12">
          <section id="about" className="grid min-h-[calc(100vh-6rem)] content-between border-b border-[#D9C9E8] pb-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <div>
                <p className="mb-8 max-w-[720px] text-[clamp(1.35rem,2.2vw,2.25rem)] leading-[1.12] text-[#7C3AED]">
                  LegalHunter - платформа номер 1 в России для подготовки юристов в сфере банкротства физических лиц.
                </p>
                <h1 className="max-w-[980px] text-[clamp(4.2rem,10vw,11.5rem)] font-semibold leading-[0.82] tracking-[-0.08em] text-[#18131D]">
                  Учим юристов помогать людям.
                </h1>
              </div>

              <div className="rounded-[28px] border border-[#D9C9E8] bg-[#FFFDF8] p-6">
                <p className="text-sm uppercase tracking-[0.16em] text-[#9B7DB4]">с 2019 года</p>
                <p className="mt-6 text-2xl leading-tight text-[#18131D]">
                  Не курс, а профессиональная среда: практика, эксперты и технологии превращают знание закона в уверенные действия рядом с человеком в долговой яме.
                </p>
                <button
                  onClick={openRegister}
                  className="mt-8 inline-flex w-full items-center justify-between rounded-full bg-[#18131D] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#7C3AED]"
                >
                  Начать обучение
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>

            <div className="mt-14 grid border-t border-[#D9C9E8] pt-8 sm:grid-cols-2 xl:grid-cols-3">
              {stats.map((item) => (
                <div key={item.value} className="border-b border-[#D9C9E8] py-7 pr-7 sm:border-r xl:border-r">
                  <div className="text-[clamp(2.4rem,4.2vw,4.8rem)] font-semibold leading-none tracking-[-0.06em] text-[#7C3AED]">
                    {item.value}
                  </div>
                  <p className="mt-3 max-w-[320px] text-base leading-snug text-[#5F5367]">{item.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="experts" className="border-b border-[#D9C9E8] py-14 lg:py-20">
            <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <p className="text-sm uppercase tracking-[0.16em] text-[#9B7DB4]">Эксперты</p>
                <h2 className="mt-3 max-w-4xl text-[clamp(3rem,6vw,7rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-[#18131D]">
                  Практики, которые учат на реальных процедурах.
                </h2>
              </div>
              <p className="max-w-md text-lg leading-snug text-[#7C3AED]">
                Команда объединяет юристов, методологов и специалистов по сопровождению банкротства по всей России.
              </p>
            </div>

            <div className="grid gap-px overflow-hidden rounded-[28px] border border-[#D9C9E8] bg-[#D9C9E8] sm:grid-cols-2 xl:grid-cols-4">
              {experts.map((expert) => (
                <article key={expert.name} className="bg-[#FFFDF8]">
                  <div className="aspect-[4/5] overflow-hidden bg-[#EDE2F4]">
                    <Image
                      src={expert.image}
                      alt={expert.name}
                      width={520}
                      height={650}
                      className="h-full w-full object-cover grayscale-[12%]"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#18131D]">{expert.name}</h3>
                    <p className="mt-2 text-sm leading-snug text-[#7C3AED]">{expert.role}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="products" className="border-b border-[#D9C9E8] py-20 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-sm uppercase tracking-[0.16em] text-[#9B7DB4]">
                  Наши продукты{" "}
                  <span className="text-[#C9B8D8]">&amp;</span>{" "}
                  <a
                    href="https://pravotech.pro/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="ТехнологИИ Права — pravotech.pro"
                    className="relative z-20 inline-block cursor-pointer bg-gradient-to-r from-[#22D3EE] via-[#7C3AED] to-[#EC4899] bg-clip-text font-semibold text-transparent transition-opacity hover:opacity-80"
                  >
                    ТехнологИИ Права
                  </a>
                </p>
                <h2 className="mt-3 text-[clamp(3rem,6vw,7rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-[#18131D]">
                  Обучение, практика, аттестация.
                </h2>
              </div>
              <div className="divide-y divide-[#D9C9E8] border-y border-[#D9C9E8]">
                {products.map((product, index) => (
                  <article key={product.title} className="grid gap-6 py-9 sm:grid-cols-[90px_1fr]">
                    <div className="text-5xl font-semibold tracking-[-0.07em] text-[#B98CDA]">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <h3 className="text-3xl font-semibold tracking-[-0.05em] text-[#18131D]">{product.title}</h3>
                      <p className="mt-3 max-w-2xl text-lg leading-snug text-[#5F5367]">{product.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* Экосистема AI + право — бегущая лента в стиле биржевого тикера */}
            <div className="mt-16 lg:mt-20">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.16em] text-[#9B7DB4]">Экосистема AI &amp; право</p>
                <span className="hidden text-sm text-[#9B8AA8] sm:block">12 направлений в разработке</span>
              </div>
              <div
                className="group relative overflow-hidden rounded-[24px] border border-[#D9C9E8] bg-[#FFFDF8] py-5"
                style={{
                  maskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
                  WebkitMaskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
                }}
              >
                <div className="flex w-max animate-[ticker_42s_linear_infinite] gap-3 group-hover:[animation-play-state:paused]">
                  {[...ecosystem, ...ecosystem].map((item, i) => (
                    <span
                      key={`${item}-${i}`}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#E4D7EF] bg-[#F7F1E8] px-5 py-2.5 text-base font-medium text-[#3C3344]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#22D3EE] to-[#EC4899]" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 5.1 — the certificate as the destination: a blurred, locked diploma
                    the visitor is invited to earn. Editorial band, hero object breathes. */}
          <section id="certificate" className="border-b border-[#D9C9E8] py-20 lg:py-28">
            <div className="mx-auto max-w-2xl text-center">
              <ShieldCheck size={30} className="mx-auto text-[#7C3AED]" />
              <h2 className="mt-6 text-[clamp(2.6rem,5vw,5.8rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-[#18131D]">
                Сертификат, которому доверяют.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-snug text-[#5F5367]">
                Документ эксперта по банкротству физических лиц, заверенный практикующими юристами РФ.
                Его получают только те, кто прошёл курс и сдал экзамен.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={openRegister}
                  className="inline-flex items-center gap-3 rounded-full bg-[#18131D] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#7C3AED]"
                >
                  Начать обучение
                  <ArrowRight size={18} />
                </button>
                <a
                  href="https://t.me/legalhunter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2.5 rounded-full border border-[#D9C9E8] bg-white/70 px-6 py-4 text-sm font-semibold text-[#18131D] backdrop-blur transition hover:border-[#22D3EE] hover:bg-white"
                >
                  <Send size={17} className="text-[#7C3AED] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  Задать вопрос в Telegram
                </a>
              </div>
            </div>

            <div className="mt-14">
              <CertificatePreview
                variant="locked"
                lockTitle="Пройдите курс экспертов по банкротству физических лиц — и получите сертификат."
                ctaLabel="Начать обучение"
                onCta={openRegister}
              />
            </div>
          </section>

          <section id="tariffs" className="border-b border-[#D9C9E8] py-20 lg:py-28">
            <p className="text-sm uppercase tracking-[0.16em] text-[#9B7DB4]">Тарифы</p>
            <h2 className="mt-3 max-w-3xl text-[clamp(2.4rem,5vw,5rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-[#18131D]">
              Начните бесплатно — растите по мере практики.
            </h2>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {tiers.map((t) => (
                <div
                  key={t.name}
                  className={`flex flex-col rounded-[28px] border p-8 ${
                    t.featured
                      ? "border-transparent bg-[#18131D] text-white"
                      : "border-[#D9C9E8] bg-[#FFFDF8] text-[#18131D]"
                  }`}
                >
                  <p className={`text-sm uppercase tracking-[0.16em] ${t.featured ? "text-[#D8B4FE]" : "text-[#9B7DB4]"}`}>
                    {t.tag}
                  </p>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">{t.name}</h3>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold tracking-[-0.05em]">{t.price}</span>
                    {t.per && <span className={t.featured ? "text-[#B9A8C9]" : "text-[#9B8AA8]"}>{t.per}</span>}
                  </div>
                  <p className={`mt-3 text-sm leading-snug ${t.featured ? "text-[#CFC3DE]" : "text-[#5F5367]"}`}>{t.note}</p>
                  <ul className="mt-6 space-y-3 text-[15px]">
                    {t.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check className={`mt-0.5 shrink-0 ${t.featured ? "text-[#D8B4FE]" : "text-[#7C3AED]"}`} size={17} />
                        <span className={t.featured ? "text-[#EFE7F6]" : "text-[#3C3344]"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={openRegister}
                    className={`mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold transition ${
                      t.featured
                        ? "bg-[#D8B4FE] text-[#18131D] hover:bg-white"
                        : "bg-[#18131D] text-white hover:bg-[#7C3AED]"
                    }`}
                  >
                    {t.cta}
                    <ArrowRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
