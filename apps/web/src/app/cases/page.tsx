"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  ArrowRight,
  Clock,
  Users,
  Scale,
  AlertTriangle,
  ChevronRight,
  FileText,
  TrendingUp,
  Shield,
  Zap,
  Lock,
  Star,
  Bug,
  EyeOff,
  Timer,
  Search,
  Award,
  GraduationCap,
  Building2,
  User,
  Landmark,
  Network,
  Eye,
  HelpCircle,
  Info,
} from "lucide-react";
import AuthLayout from "@/components/layout/AuthLayout";

/* ── Case difficulty config ──────────────────────────────── */
function getDiffConfig(level: 1 | 2 | 3) {
  switch (level) {
    case 1:
      return { label: "Базовый", color: "var(--success)", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)" };
    case 2:
      return { label: "Продвинутый", color: "var(--warning)", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" };
    case 3:
      return { label: "Экспертный", color: "var(--danger)", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" };
  }
}

/* ── Butterfly SVG icon (inline, small) ──────────────────── */
function ButterflyIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 21c0 0-8-4.5-8-11.8C4 5.5 7.6 2 12 2c4.4 0 8 3.5 8 7.2C20 16.5 12 21 12 21z" />
      <path d="M12 2v19" />
      <path d="M4.9 7.5C2 9.2 2 14 5.1 15.7" />
      <path d="M19.1 7.5C22 9.2 22 14 18.9 15.7" />
    </svg>
  );
}

/* ── Case data (will be API-driven later) ────────────────── */
interface CaseItem {
  id: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3;
  category: string;
  estimatedMinutes: number;
  branchCount: number;
  tags: string[];
  locked: boolean;
  completedByUser: boolean;
  blindMode?: boolean;
  timerMode?: boolean;
  hiddenFacts?: number;
  benchmarkPercentile?: number;
}

const SAMPLE_CASES: CaseItem[] = [
  {
    id: "case-1",
    title: "Дольщики против застройщика-банкрота",
    description:
      "Застройщик признан банкротом. 340 дольщиков требуют передачи квартир, но конкурсной массы недостаточно. Выстройте стратегию защиты интересов дольщиков через реестр и Фонд развития территорий.",
    difficulty: 1,
    category: "Застройщик-банкрот",
    estimatedMinutes: 20,
    branchCount: 5,
    tags: ["ФЗ-127 §7", "Дольщики", "Фонд развития"],
    locked: false,
    completedByUser: false,
    hiddenFacts: 3,
    benchmarkPercentile: 72,
  },
  {
    id: "case-2",
    title: "Личное банкротство предпринимателя",
    description:
      "ИП с долгами в 18 млн подал на банкротство. Кредиторы подозревают преднамеренность. Проведите анализ финансового состояния и определите, реальное ли это банкротство или попытка списать долги.",
    difficulty: 1,
    category: "Банкротство физлица",
    estimatedMinutes: 15,
    branchCount: 4,
    tags: ["ФЗ-127", "Физлицо", "Преднамеренность"],
    locked: false,
    completedByUser: false,
    blindMode: true,
    hiddenFacts: 4,
    benchmarkPercentile: 65,
  },
  {
    id: "case-3",
    title: "Ликвидация кредитного кооператива",
    description:
      "Кредитный потребительский кооператив с 1200 пайщиками входит в банкротство. Средства вкладчиков не застрахованы АСВ. Определите приоритет требований и стратегию максимального возврата.",
    difficulty: 2,
    category: "Финансовая организация",
    estimatedMinutes: 25,
    branchCount: 6,
    tags: ["Кооператив", "АСВ", "Реестр"],
    locked: false,
    completedByUser: false,
    timerMode: true,
    hiddenFacts: 5,
    benchmarkPercentile: 58,
  },
  {
    id: "case-4",
    title: "Холдинг: консолидация банкротств",
    description:
      "Группа из 7 компаний, связанных через бенефициара, банкротится по отдельности. Кредиторы просят объединить дела. Оцените основания для консолидации и риски для каждой стороны.",
    difficulty: 2,
    category: "Группа компаний",
    estimatedMinutes: 30,
    branchCount: 7,
    tags: ["Консолидация", "Аффилированность", "ГК"],
    locked: false,
    completedByUser: false,
    hiddenFacts: 6,
    benchmarkPercentile: 51,
  },
  {
    id: "case-5",
    title: "Должник скрывает имущество за рубежом",
    description:
      "В ходе банкротства обнаружены признаки вывода активов в зарубежные юрисдикции. Недвижимость на Кипре, счета в ОАЭ. Постройте стратегию розыска и возврата активов.",
    difficulty: 3,
    category: "Сокрытие активов",
    estimatedMinutes: 35,
    branchCount: 8,
    tags: ["Зарубежные активы", "Розыск", "Кипр"],
    locked: false,
    completedByUser: false,
    blindMode: true,
    timerMode: true,
    hiddenFacts: 7,
    benchmarkPercentile: 44,
  },
  {
    id: "case-6",
    title: "Цепочка сделок: вывод через подставных",
    description:
      "Должник за год до банкротства продал производственный комплекс. Покупатель перепродал его дважды. Последний приобретатель — добросовестный. Оцените перспективы оспаривания всей цепочки.",
    difficulty: 2,
    category: "Оспаривание сделок",
    estimatedMinutes: 25,
    branchCount: 6,
    tags: ["Ст.61.2", "Цепочка сделок", "Добросовестность"],
    locked: false,
    completedByUser: false,
    hiddenFacts: 4,
    benchmarkPercentile: 63,
  },
  {
    id: "case-7",
    title: "Субсидиарная ответственность директора и бухгалтера",
    description:
      "Компания-банкрот. Директор утверждает, что все решения принимал бухгалтер. Бухгалтер ссылается на указания директора. Определите контролирующих лиц и распределите ответственность.",
    difficulty: 3,
    category: "Субсидиарная ответственность",
    estimatedMinutes: 35,
    branchCount: 8,
    tags: ["Ст.61.11", "КДЛ", "Бухгалтер"],
    locked: false,
    completedByUser: false,
    timerMode: true,
    hiddenFacts: 5,
    benchmarkPercentile: 47,
  },
  {
    id: "case-8",
    title: "Застройщик-банкрот: незавершённый ЖК",
    description:
      "Строительство ЖК остановлено на 70%. Появился инвестор, готовый достроить, но его условия ущемляют часть дольщиков. Найдите баланс интересов и проведите собрание.",
    difficulty: 2,
    category: "Застройщик-банкрот",
    estimatedMinutes: 25,
    branchCount: 6,
    tags: ["Достройка", "Инвестор", "Собрание"],
    locked: true,
    completedByUser: false,
    hiddenFacts: 4,
    benchmarkPercentile: 55,
  },
  {
    id: "case-9",
    title: "Банкротство: сокрытие через доверительное управление",
    description:
      "Должник передал бизнес в доверительное управление родственнику за 2 года до банкротства. Формально активы ему не принадлежат. Докажите мнимость сделки.",
    difficulty: 3,
    category: "Сокрытие активов",
    estimatedMinutes: 30,
    branchCount: 7,
    tags: ["Мнимость", "Доверительное управление", "Родственники"],
    locked: true,
    completedByUser: false,
    blindMode: true,
    hiddenFacts: 6,
    benchmarkPercentile: 39,
  },
  {
    id: "case-10",
    title: "Привлечение теневого бенефициара",
    description:
      "Номинальный директор — подставное лицо. Реальный бенефициар управлял через мессенджеры. Постройте доказательную базу для привлечения к субсидиарной ответственности фактического контролирующего лица.",
    difficulty: 3,
    category: "Субсидиарная ответственность",
    estimatedMinutes: 40,
    branchCount: 9,
    tags: ["Теневой бенефициар", "Мессенджеры", "Доказательства"],
    locked: true,
    completedByUser: false,
    timerMode: true,
    blindMode: true,
    hiddenFacts: 8,
    benchmarkPercentile: 33,
  },
  {
    id: "case-11",
    title: "Микрофинансовая организация: крах пирамиды",
    description:
      "МФО привлекала вклады под 30% годовых. Признана банкротом с дырой в 2 млрд. 5000 вкладчиков. Определите квалификацию требований и очерёдность удовлетворения.",
    difficulty: 2,
    category: "Финансовая организация",
    estimatedMinutes: 25,
    branchCount: 5,
    tags: ["МФО", "Пирамида", "Очерёдность"],
    locked: true,
    completedByUser: false,
    hiddenFacts: 5,
    benchmarkPercentile: 52,
  },
  {
    id: "case-12",
    title: "Группа компаний: субординация внутригрупповых требований",
    description:
      "Компания из группы предъявляет требования к банкротящейся «сестре». Независимые кредиторы требуют субординации. Разберите, какие требования понизить, а какие оставить.",
    difficulty: 3,
    category: "Группа компаний",
    estimatedMinutes: 30,
    branchCount: 7,
    tags: ["Субординация", "Внутригрупповые", "Компенсационное"],
    locked: true,
    completedByUser: false,
    hiddenFacts: 5,
    benchmarkPercentile: 41,
  },
];

const CATEGORIES = [
  "Все",
  "Застройщик-банкрот",
  "Банкротство физлица",
  "Финансовая организация",
  "Группа компаний",
  "Сокрытие активов",
  "Оспаривание сделок",
  "Субсидиарная ответственность",
];

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`;

const PREMIUM_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ── Page Component ──────────────────────────────────────── */
export default function CasesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [hoveredCase, setHoveredCase] = useState<string | null>(null);

  const filteredCases =
    selectedCategory === "Все"
      ? SAMPLE_CASES
      : SAMPLE_CASES.filter((c) => c.category === selectedCategory);

  const completedCount = SAMPLE_CASES.filter((c) => c.completedByUser).length;
  const totalCount = SAMPLE_CASES.length;
  const unlockedCount = SAMPLE_CASES.filter((c) => !c.locked).length;

  return (
    <AuthLayout>
      <div className="min-h-screen relative" style={{ background: "var(--bg-primary)" }}>
        {/* Pulsing glow animation */}
        <style>{`
          @keyframes pulse-glow {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.75); }
          }
        `}</style>
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div
            className="absolute -top-40 left-[20%] w-[900px] h-[900px] rounded-full opacity-[0.035]"
            style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-[60%] -right-32 w-[700px] h-[700px] rounded-full opacity-[0.025]"
            style={{ background: "radial-gradient(circle, #2563EB 0%, transparent 70%)" }}
          />
          <div
            className="absolute top-[30%] left-[60%] w-[500px] h-[500px] rounded-full opacity-[0.02]"
            style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }}
          />
        </div>
        {/* Noise texture overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE_SVG }} aria-hidden />

        <div className="relative z-10 max-w-[1100px] mx-auto px-5 sm:px-8 py-8 sm:py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: PREMIUM_EASE }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(139, 92, 246, 0.12)",
                    boxShadow: "0 0 0 1px rgba(139, 92, 246, 0.2)",
                  }}
                >
                  <Briefcase size={22} style={{ color: "#8B5CF6" }} />
                </div>
                <div>
                  <h1
                    className="text-2xl sm:text-3xl font-bold tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Кейсы
                  </h1>
                  <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                    Интерактивные сценарии с ветвлением решений
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-6 grid grid-cols-3 gap-3"
          >
            {[
              { label: "Доступно", value: unlockedCount, icon: Briefcase, color: "#8B5CF6" },
              { label: "Пройдено", value: `${completedCount}/${totalCount}`, icon: Star, color: "var(--success)" },
              { label: "Всего кейсов", value: totalCount, icon: FileText, color: "var(--info)" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl p-4 text-center relative"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                  }}
                >
                  {/* Pulsing glow dot */}
                  <span
                    className="absolute top-3 right-3 block w-[6px] h-[6px] rounded-full"
                    style={{
                      background: stat.color,
                      boxShadow: `0 0 6px ${stat.color}`,
                      animation: "pulse-glow 2s ease-in-out infinite",
                    }}
                  />
                  <Icon size={16} className="mx-auto mb-1.5" style={{ color: stat.color }} />
                  <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {stat.value}
                  </div>
                  <div
                    className="text-[10px] font-semibold uppercase tracking-wider mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Hidden facts info card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-5 rounded-xl p-4 flex items-start gap-3 relative"
            style={{
              background: "rgba(139, 92, 246, 0.06)",
              border: "1px solid rgba(139, 92, 246, 0.15)",
            }}
          >
            {/* Corner bracket — top-left */}
            <div
              className="absolute top-0 left-0 pointer-events-none"
              aria-hidden
              style={{
                width: 16,
                height: 16,
                borderTop: "2px solid rgba(139,92,246,0.5)",
                borderLeft: "2px solid rgba(139,92,246,0.5)",
                borderRadius: "4px 0 0 0",
              }}
            />
            {/* Corner bracket — bottom-right */}
            <div
              className="absolute bottom-0 right-0 pointer-events-none"
              aria-hidden
              style={{
                width: 16,
                height: 16,
                borderBottom: "2px solid rgba(139,92,246,0.5)",
                borderRight: "2px solid rgba(139,92,246,0.5)",
                borderRadius: "0 0 4px 0",
              }}
            />
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "rgba(139, 92, 246, 0.12)" }}
            >
              <Search size={15} style={{ color: "#8B5CF6" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#8B5CF6" }}>
                Скрытые факты
              </p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                В каждом кейсе есть скрытые факты. Найдите их, задавая правильные вопросы.
                Чем больше фактов раскроете — тем точнее будет ваше решение.
              </p>
            </div>
          </motion.div>

          {/* Category filter */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-5 flex gap-2 overflow-x-auto pb-1"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap"
                style={{
                  background:
                    selectedCategory === cat ? "rgba(139, 92, 246, 0.12)" : "var(--surface-card)",
                  border: `1px solid ${selectedCategory === cat ? "rgba(139, 92, 246, 0.4)" : "var(--border-color)"}`,
                  color: selectedCategory === cat ? "#8B5CF6" : "var(--text-muted)",
                }}
              >
                {cat}
              </button>
            ))}
          </motion.div>

          {/* Butterfly Effect hero card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className="mt-6 rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(88, 28, 235, 0.08) 100%)",
              border: "1px solid",
              borderImage: "linear-gradient(135deg, #8B5CF6, #7C3AED, #6D28D9, #8B5CF6) 1",
              boxShadow: "0 0 30px rgba(139,92,246,0.1)",
            }}
          >
            <div className="p-5 sm:p-6 flex items-start gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                  boxShadow: "0 4px 16px rgba(139, 92, 246, 0.3)",
                }}
              >
                <ButterflyIcon size={20} className="text-white" />
              </div>
              <div>
                <h2
                  className="text-base sm:text-lg font-bold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  Эффект бабочки
                </h2>
                <p
                  className="text-sm mt-1 leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Интерактивные кейсы из реальной арбитражной практики. Каждое ваше решение ведёт
                  к разным последствиям — как в жизни. Нет правильных ответов, есть стратегия.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Cases grid */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {filteredCases.map((caseItem, i) => {
                const diff = getDiffConfig(caseItem.difficulty);
                const isHovered = hoveredCase === caseItem.id;

                return (
                  <motion.div
                    key={caseItem.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.4, delay: 0.02 + i * 0.04 }}
                    layout
                    className="group relative rounded-2xl overflow-hidden transition-all duration-300"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      border: `1px solid ${isHovered && !caseItem.locked ? "rgba(139, 92, 246, 0.3)" : "rgba(255,255,255,0.06)"}`,
                      cursor: caseItem.locked ? "default" : "pointer",
                      opacity: caseItem.locked ? 0.6 : 1,
                      boxShadow: isHovered && !caseItem.locked ? "0 8px 32px rgba(139,92,246,0.12)" : "none",
                      transition: `all 0.4s cubic-bezier(${PREMIUM_EASE.join(",")})`,
                    }}
                    onMouseEnter={() => setHoveredCase(caseItem.id)}
                    onMouseLeave={() => setHoveredCase(null)}
                    onClick={() => {
                      if (!caseItem.locked) {
                        // Will route to case player when implemented
                        // router.push(`/cases/${caseItem.id}`);
                      }
                    }}
                  >
                    {/* Top accent line */}
                    <div
                      className="h-[2px]"
                      style={{ background: `linear-gradient(90deg, ${diff.color}, transparent 80%)` }}
                    />

                    <div className="p-5">
                      {/* Header row: badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            background: diff.bg,
                            color: diff.color,
                            border: `1px solid ${diff.border}`,
                          }}
                        >
                          {diff.label}
                        </span>
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                          style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                        >
                          {caseItem.category}
                        </span>

                        {/* Blind mode badge */}
                        {caseItem.blindMode && (
                          <span
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                            style={{
                              background: "rgba(239, 68, 68, 0.1)",
                              color: "var(--danger)",
                              border: "1px solid rgba(239, 68, 68, 0.2)",
                            }}
                            title="Минимум вводных — как в реальной жизни"
                          >
                            <EyeOff size={10} />
                            Слепой кейс
                          </span>
                        )}

                        {/* Timer mode badge */}
                        {caseItem.timerMode && (
                          <span
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
                            style={{
                              background: "rgba(245, 158, 11, 0.1)",
                              color: "var(--warning)",
                              border: "1px solid rgba(245, 158, 11, 0.2)",
                            }}
                            title="Ограничение по времени"
                          >
                            <Timer size={10} />
                            Таймер
                          </span>
                        )}

                        {/* Lock icon on the right */}
                        {caseItem.locked && (
                          <Lock size={14} className="ml-auto" style={{ color: "var(--text-muted)" }} />
                        )}
                      </div>

                      {/* Title & description */}
                      <h3
                        className="text-base font-bold tracking-tight leading-snug mb-2"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {caseItem.title}
                      </h3>
                      <p
                        className="text-sm leading-relaxed line-clamp-2 mb-3"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {caseItem.description}
                      </p>

                      {/* Expert analysis teaser */}
                      <div
                        className="flex items-center gap-1.5 text-[11px] mb-3"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <GraduationCap size={12} style={{ color: "#8B5CF6" }} />
                        По завершении — разбор эксперта
                      </div>

                      {/* Meta row */}
                      <div
                        className="flex items-center gap-4 text-xs mb-3"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className="flex items-center gap-1">
                          <Clock size={12} />~{caseItem.estimatedMinutes} мин
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp size={12} />
                          {caseItem.branchCount} развилок
                        </span>
                        {caseItem.hiddenFacts && (
                          <span className="flex items-center gap-1">
                            <Search size={12} />
                            {caseItem.hiddenFacts} скрытых фактов
                          </span>
                        )}
                      </div>

                      {/* Butterfly effect + benchmark row */}
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className="flex items-center gap-1.5 text-[11px]"
                          style={{ color: "rgba(139, 92, 246, 0.7)" }}
                        >
                          <ButterflyIcon size={13} />
                          <span>Каждое решение меняет ход дела</span>
                        </div>
                        {caseItem.benchmarkPercentile && (
                          <div
                            className="flex items-center gap-1 text-[11px] font-medium"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Award size={11} style={{ color: "#8B5CF6" }} />
                            <span>
                              Лучше {caseItem.benchmarkPercentile}% участников
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {caseItem.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[11px] px-2 py-0.5 rounded-md"
                            style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Action */}
                      {caseItem.locked ? (
                        <div
                          className="flex items-center gap-2 text-xs font-medium py-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Lock size={12} />
                          Пройдите предыдущие кейсы для разблокировки
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1.5 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ color: "#8B5CF6" }}
                        >
                          Начать кейс
                          <ArrowRight size={14} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Coming soon note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Новые кейсы добавляются еженедельно на основе реальной арбитражной практики
            </p>
          </motion.div>
        </div>
      </div>
    </AuthLayout>
  );
}
