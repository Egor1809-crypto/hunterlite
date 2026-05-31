"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, FileCheck, GraduationCap, ShieldCheck } from "lucide-react";
import { useLandingAuth } from "@/components/landing/LandingAuthContext";
import { BrandLogo } from "@/components/ui/BrandLogo";

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
    text: "Диалоги и звонки с AI-клиентами, которые ведут себя как реальные должники: спорят, сомневаются, давят и проверяют реакцию юриста.",
  },
  {
    title: "Кейсы и практика",
    text: "Интерактивные дела по банкротству: решения, последствия, скрытые факты и экспертный разбор после прохождения.",
  },
  {
    title: "Экзамен и сертификат",
    text: "Формальная проверка знаний, отчёт о результате и сертификат для подтверждения профессионального роста.",
  },
];

const proof = [
  "Обучаем юристов и специалистов банкротства с 2019 года.",
  "Соединяем опыт практиков, судебную логику и передовые технологии.",
  "Помогаем специалистам не просто учиться, а применять знания в реальной работе с людьми.",
];

export default function LandingPage() {
  const { openLogin, openRegister } = useLandingAuth();

  return (
    <main className="min-h-screen bg-[#F7F1E8] text-[#18131D]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1680px] grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside className="sticky top-0 z-20 flex h-auto flex-col border-b border-[#D9C9E8] bg-[#F7F1E8]/95 px-5 py-5 backdrop-blur lg:h-screen lg:border-b-0 lg:border-r lg:px-7 lg:py-7">
          <div className="flex items-center justify-between gap-4 lg:block">
            <Link href="/" className="inline-flex" aria-label="LegalHunter">
              <BrandLogo size="lg" />
            </Link>
            <div className="flex items-center gap-2 lg:hidden">
              <button
                onClick={openLogin}
                className="rounded-full border border-[#C6A7DD] px-4 py-2 text-sm font-semibold text-[#7C3AED]"
              >
                Войти
              </button>
              <button
                onClick={openRegister}
                className="rounded-full bg-[#8B5CF6] px-4 py-2 text-sm font-semibold text-white"
              >
                Регистрация
              </button>
            </div>
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

          <div className="mt-6 hidden gap-2 lg:flex">
            <button
              onClick={openLogin}
              className="flex-1 rounded-full border border-[#C6A7DD] px-4 py-3 text-sm font-semibold text-[#7C3AED] transition hover:bg-white"
            >
              Войти
            </button>
            <button
              onClick={openRegister}
              className="flex-1 rounded-full bg-[#8B5CF6] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7C3AED]"
            >
              Регистрация
            </button>
          </div>

          <div className="mt-auto hidden space-y-3 pt-8 lg:block">
            <a
              href="/landing/certificates/certificate-bfl.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-2xl border border-[#D9C9E8] bg-white/55 px-4 py-4 text-sm font-semibold text-[#18131D] transition hover:border-[#B98CDA]"
            >
              <span className="flex items-center gap-2">
                <FileCheck size={17} />
                Сертификат
              </span>
              <ArrowRight size={16} />
            </a>
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

        <section className="px-5 py-10 sm:px-8 lg:px-14 lg:py-12">
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
                  Не просто обучение. Это профессиональная среда, где технологии, практика и эксперты превращают знания в уверенные действия.
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

          <section id="products" className="border-b border-[#D9C9E8] py-14 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-sm uppercase tracking-[0.16em] text-[#9B7DB4]">Наши продукты</p>
                <h2 className="mt-3 text-[clamp(3rem,6vw,7rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-[#18131D]">
                  Обучение, практика, аттестация.
                </h2>
              </div>
              <div className="divide-y divide-[#D9C9E8] border-y border-[#D9C9E8]">
                {products.map((product, index) => (
                  <article key={product.title} className="grid gap-6 py-8 sm:grid-cols-[90px_1fr]">
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
          </section>

          <section id="certificate" className="grid gap-8 border-b border-[#D9C9E8] py-14 lg:grid-cols-[1fr_1fr] lg:py-20">
            <div className="rounded-[28px] border border-[#D9C9E8] bg-[#FFFDF8] p-8">
              <ShieldCheck size={30} className="text-[#7C3AED]" />
              <h2 className="mt-8 text-[clamp(2.6rem,5vw,5.8rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-[#18131D]">
                Сертификат, который подтверждает рост.
              </h2>
            </div>
            <div id="tariffs" className="rounded-[28px] border border-[#D9C9E8] bg-[#18131D] p-8 text-white">
              <p className="text-sm uppercase tracking-[0.16em] text-[#D8B4FE]">Тарифы</p>
              <h3 className="mt-6 text-4xl font-semibold tracking-[-0.05em]">Для юристов, команд и партнёров</h3>
              <ul className="mt-8 space-y-4 text-lg text-[#EFE7F6]">
                {proof.map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="mt-1 shrink-0 text-[#D8B4FE]" size={18} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={openRegister}
                className="mt-10 inline-flex items-center gap-3 rounded-full bg-[#D8B4FE] px-6 py-4 text-sm font-semibold text-[#18131D] transition hover:bg-white"
              >
                Получить доступ
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
