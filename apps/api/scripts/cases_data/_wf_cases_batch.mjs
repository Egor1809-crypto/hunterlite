export const meta = {
  name: 'bfl-cases-batch',
  description: 'Генерация и состязательная проверка кейсов БФЛ (ФЗ-127): генератор + скептики + фиксер, фан-аутом',
  phases: [
    { title: 'Generate', detail: 'агент-генератор пишет bfl_NN.py по контракту и эталону' },
    { title: 'Verify', detail: '3 скептика на кейс: ФЗ-127 / структура §9 / ЮЛ-путаница' },
    { title: 'Fix', detail: 'фиксер устраняет подтверждённые замечания' },
  ],
}

const DIR = '/Users/bubble3/Desktop/hunterlite/apps/api/scripts/cases_data'
const REF = `${DIR}/bfl_01.py`
const TZ = '/Users/bubble3/Desktop/hunterlite/docs/cases/SCALING_TZ.md'

// ── Общий блок контракта данных (копия §2/§9 ТЗ, для всех агентов) ──────────
const CONTRACT = `
КОНТРАКТ ДАННЫХ КЕЙСА (Python-файл с переменной CASE: dict). Эталон качества: ${REF}
Полное ТЗ: ${TZ} (разделы §2 контракт, §4 право, §9 валидатор).

Верхний уровень CASE (все поля обязательны):
  id (str ≤32, формат "bfl-NN"), title (str ≤256 "Имя: суть"),
  description (Text, 2-4 предложения: суммы, имущество, доход, семья),
  difficulty (int 1..5), category (str из таксономии §5),
  estimated_minutes (int 10..18), max_score = 100 (всегда),
  order_index (int, уникальный), optimal_path = [], steps = [],
  expert_analysis (Text 5-9 предложений, юридически точный итог),
  stage1 (dict), stage2 (dict).

stage1 = {intro, start:"q1", correct_path:[...], correct_outcome:"out-...", nodes:{...}}
  nodes — словарь по id. РОВНО 5 узлов type:"question" (q1..q5, step=1..5).
  У каждого вопроса: title, question, facts (2..4 карточки {label,value}),
  options — РОВНО 5, среди них РОВНО 1 correct:True.
  Каждый option: {id:"q<N>-<a..e>", text, correct:bool, next:"<node_id>", explain:"1 предложение"}.
  ВЕРНЫЙ option.next → следующий вопрос спины (q5 верный → исход out-...).
  КАЖДЫЙ неверный option.next → узел type:"info" (разбор), а info.next → вперёд
    (следующий вопрос спины или исход). Линейного "неверно→тот же вопрос" быть не должно.
  info-узел: {type:"info", step, title, body (2-4 предложения реальной практики),
    facts (0..3, можно []), next:"<вопрос или исход>"}.
  ПЕРЕСЕЧЕНИЯ ВЕТОК (обязательно): ≥3 info-узла, в каждый из которых ведут ≥2 разных
    неверных option (родственные заблуждения делят общий разбор).
    ⚠ КРИТИЧЕСКОЕ ПРАВИЛО (иначе обратное ребро/петля): общий info-узел разрешается делить
    ТОЛЬКО между неверными option ОДНОГО И ТОГО ЖЕ вопроса (одного step). НЕЛЬЗЯ делить один
    info между опциями РАЗНЫХ вопросов — у них разный «следующий вопрос», а info.next один.
    Правило: info.next ВСЕГДА = вопрос, идущий сразу после вопроса-источника (или исход для
    шага 5). Значит у info всех источников должен быть один и тот же step. Если соблазн
    «переиспользовать» разбор для другого вопроса — заведи ОТДЕЛЬНЫЙ info-узел с правильным
    next. Минимум 3 общих info на кейс — все внутри своего вопроса.
  Исход: {type:"outcome", outcome:"<slug>", title, summary (3-5 предложений, мост ко 2 этапу)}.
  Граф — DAG строго вперёд к исходу, без висячих ссылок и циклов.
  Скоринг stage1 = (верных ответов)×10; верный путь из 5 вопросов = 50 баллов.

stage2 = {prompt, correct_sequence:["s1".."s7"], pool:[...12...]}
  pool: 7 ВЕРНЫХ {id:"sN", text, is_correct:True, order:1..7, explain} +
        5 ДИСТРАКТОРОВ {id:"dN", text, is_correct:False, order:None, explain}.
  correct_sequence = id верных в порядке order (sorted by order == correct_sequence).
  Дистракторы — реальные заблуждения (МФЦ когда нельзя; "банк сам спишет"; переоформить
  на родню; новый кредит; ждать исковую давность; шаги банкротства ЮЛ с пометкой
  "это процедуры юрлиц"). Скоринг 7/7 = 50.

ЮРИДИЧЕСКИЕ ОПОРЫ (ФЗ-127, сверять, не выдумывать):
  • МФЦ (внесуд., ст.223.2): долг 25 000–1 000 000 ₽; базовое основание — оконченное ИП
    по "отсутствию имущества" (п.4 ч.1 ст.46 ФЗ-229); льготные (2023): пенсионер/получатель
    пособий с единственным доходом и взысканием >1 года, либо исполнение >7 лет; срок 6 мес;
    бесплатно, без финуправляющего.
  • Суд (арбитражный, по месту жительства): ОБЯЗАНность подать при долге ≥500 000 ₽ и
    просрочке >3 мес (30 раб.дней); ПРАВО — при любой сумме при очевидной неплатёжеспособности.
    Госпошлина + депозit на вознаграждение финуправляющего (фикс. 25 000 ₽ + 7%).
  • Реструктуризация: план до 5 лет, нужен подтверждённый регулярный доход.
  • Реализация имущества: конкурсная масса, опись/оценка, электронные торги; затем списание.
  • Мировое соглашение: на любой стадии, с согласия кредиторов, прекращает дело.
  • Исполнительский иммунитет (ст.446 ГПК): единственное жильё (НЕ ипотека/залог), личные вещи,
    проф.инструмент, прожиточный минимум. КС РФ 11-П/2021: "роскошное" жильё может замещаться.
  • Ипотечное/залоговое единственное жильё — иммунитета НЕТ, идёт залоговому (80% выручки).
    Закон 2024 — возможность сохранить ипотечное единственное жильё через мировое/локальный план.
  • Оспаривание: ст.61.2 (подозрительные — дарение/занижение за 1-3 года), ст.61.3
    (предпочтение одному кредитору за 1-6 мес) → возврат в массу.
  • Недобросовестность → НЕ освобождают (п.4 ст.213.28): сокрытие, ложь банку, злостное уклонение.
  • Несписываемые (п.5-6 ст.213.28): алименты; вред жизни/здоровью и моральный; зарплата
    работникам (если должник-работодатель); субсидиарная ответственность; текущие платежи.
  • Совместное имущество супругов: реализуется общее, доля супруга — деньгами; возможно
    совместное банкротство (практика ВС).
  • Последствия: 5 лет указывать на банкротство; 3 года нельзя руководить ЮЛ (10 — банк); повторное — через 5 лет.

ЗАПРЕЩЕНО как ВЕРНЫЕ шаги: термины банкротства ЮЛ (наблюдение, финансовое оздоровление,
  внешнее управление, конкурсное производство, собрание кредиторов "как у ЮЛ", КДЛ) — только
  как дистрактор с пометкой "это процедуры юрлиц". Не путать районный и арбитражный суд.
  Не обещать "суд сразу спишет без процедуры" или "банк сам спишет по просьбе".
`

function genPrompt(spec) {
  return `Ты — методист-юрист по банкротству физлиц (ФЗ-127). Создай ОДИН кейс БФЛ по контракту ниже.

СНАЧАЛА прочитай эталон ${REF} целиком — это планка качества, стиль и точная форма данных.
Копируй его структуру дословно, но НЕ копируй содержание — у тебя своя фабула.

${CONTRACT}

ТВОЙ КЕЙС:
  id: ${spec.id}
  order_index: ${spec.order_index}
  category: "${spec.category}"
  difficulty: ${spec.difficulty}
  Фабула/изюминка: ${spec.brief}

ТРЕБОВАНИЯ К ГЛУБИНЕ (не беднее эталона):
  • Реальная судебная практика БФЛ, конкретные нормы и цифры в facts.
  • 5 вопросов ведут логичную линию рассуждения к исходу "${spec.outcome}".
  • Info-разборы — содержательные (2-4 предложения), объясняют ПОЧЕМУ неверно, со ссылкой на норму.
  • ≥3 общих info-узла (пересечения). Проверь, что info.next ведёт строго вперёд.
  • expert_analysis — ёмкий вывод + предупреждение о добросовестности/нюанс кейса.
  • stage2: 7 реальных шагов именно ЭТОЙ процедуры в верном порядке + 5 правдоподобных дистракторов.

ДЕЙСТВИЯ:
  1. Прочитай эталон.
  2. Напиши файл ${spec.path} с docstring (1-2 строки) и переменной CASE: dict.
     Файл должен начинаться с: from __future__ import annotations
  3. Проверь синтаксис Python: запусти через Bash
     cd /Users/bubble3/Desktop/hunterlite/apps/api && uv run python -c "import ast,io; ast.parse(io.open('${spec.path}',encoding='utf-8').read()); print('SYNTAX_OK')"
  4. Самопроверка по чеклисту §9: 5 вопросов/step 1..5; по 5 опций/1 верная; неверные→info; ≥3 общих info;
     facts 2..4 на вопрос; 7 верных(order 1..7)+5 дистракторов; correct_sequence==sorted(order); max_score=100.
  Не запускай seed и общий валидатор (это сделает оркестратор).

Верни строго структуру: id, path, краткое summary исхода, syntax_ok, и notes (что проверил).`
}

const LENSES = {
  legal: (spec) => `Ты — состязательный СКЕПТИК-ЮРИСТ по ФЗ-127. Цель — ОПРОВЕРГНУТЬ юридическую достоверность кейса ${spec.id}.
Прочитай файл ${spec.path}. Проверь придирчиво на реальную практику БФЛ:
  • Верны ли нормы и цифры (лимит МФЦ 25k–1M, порог суда 500k/3мес, ст.446 ГПК, ст.61.2/61.3, ст.213.28, сроки, госпошлина/депозит)?
  • Логичен ли исход "${spec.outcome}" для фабулы? Нет ли фактических ошибок/устаревших данных/выдуманной практики?
  • Корректны ли explain и expert_analysis? Нет ли обещаний "банк сам спишет"/"суд спишет без процедуры"?
  • Адекватны ли дистракторы stage2 (правдоподобны, но реально неверны)?
По умолчанию настроен скептически: если сомневаешься в норме — отметь как issue с severity и предложением fix.
${CONTRACT}
Верни: dimension="legal", clean(bool), issues[] (severity high/med/low, where, problem, fix).`,

  structure: (spec) => `Ты — состязательный СКЕПТИК-СТРУКТУРЩИК. Цель — найти структурные нарушения §9 в кейсе ${spec.id}.
Прочитай файл ${spec.path} и сверь ПОБУКВЕННО с правилами:
  • РОВНО 5 type:"question" (q1..q5), step ровно 1..5 без дублей; start→вопрос step1.
  • У каждого вопроса РОВНО 5 options, РОВНО 1 correct:True; facts 2..4.
  • Верный option.next → вопрос/исход; КАЖДЫЙ неверный → существующий info; info.next → вопрос/исход.
  • Нет висячих ссылок (все next существуют в nodes); граф СТРОГО вперёд к исходу; нет циклов.
  • ⚠ Каждый info.next ведёт ВПЕРЁД: его step должен быть строго больше step ЛЮБОГО
    вопроса-источника (или это исход). Общий info, делимый между опциями РАЗНЫХ вопросов
    (разных step) — это БАГ (обратное ребро/петля): помечай как high. Общий info допустим
    только внутри одного вопроса.
  • ≥3 общих info (в которые ведут ≥2 разных неверных option ОДНОГО вопроса). Перечисли какие.
  • option.id уникальны (q<N>-<a..e>); верный путь из 5 вопросов даёт stage1=50.
  • stage2: 7 верных (order 1..7 без дыр) + 5 дистракторов(order None); correct_sequence==sorted(order); id уникальны; пул=12.
  • Все верхнеуровневые поля присутствуют; max_score=100; difficulty 1..5; estimated_minutes 10..18; category в таксономии.
Также при возможности запусти точечный синтаксис-чек:
  cd /Users/bubble3/Desktop/hunterlite/apps/api && uv run python -c "import ast,io; ast.parse(io.open('${spec.path}',encoding='utf-8').read()); print('OK')"
${CONTRACT}
Верни: dimension="structure", clean(bool), issues[] (severity, where, problem, fix).`,

  ul: (spec) => `Ты — состязательный СКЕПТИК по чистоте материала (БФЛ vs ЮЛ). Цель — найти путаницу с банкротством ЮЛИЦ и слабые места в кейсе ${spec.id}.
Прочитай файл ${spec.path}. Найди:
  • Любые термины/процедуры банкротства ЮЛ, используемые как ВЕРНЫЕ шаги или верные ответы:
    наблюдение, финансовое оздоровление, внешнее управление, конкурсное производство,
    собрание кредиторов "как у ЮЛ", КДЛ, субсидиарка как процедура должника-гражданина.
    (Допустимо ТОЛЬКО как дистрактор с явной пометкой "это процедуры юрлиц".)
  • Путаницу районный/арбитражный суд; путаницу ИП-гражданин (это БФЛ) с банкротством ЮЛ.
  • Присутствие ассистента "Маняша", breadcrumb, посторонних сущностей — их быть не должно.
  • Однообразие/неубедительность дистракторов и info; повторяющиеся формулировки.
${CONTRACT}
Верни: dimension="ul", clean(bool), issues[] (severity, where, problem, fix).`,
}

function fixPrompt(spec, issues) {
  return `Ты — методист-юрист по ФЗ-127. Исправь кейс ${spec.id} в файле ${spec.path} по подтверждённым замечаниям скептиков.
Замечания (JSON):
${JSON.stringify(issues, null, 2)}

Правила:
  • Прочитай файл, реши КАЖДОЕ замечание severity high/med (low — на усмотрение, если улучшает).
  • Сохрани контракт §9 (5×5 вопросов, 7+5 stage2, ≥3 общих info, max_score=100, DAG вперёд).
  • Не ломай то, что уже корректно. После правок проверь синтаксис:
    cd /Users/bubble3/Desktop/hunterlite/apps/api && uv run python -c "import ast,io; ast.parse(io.open('${spec.path}',encoding='utf-8').read()); print('OK')"
${CONTRACT}
Верни: id, path, edited(bool), changes[] (что изменил), resolved(bool — все high/med устранены), remaining[] (что не стал менять и почему).`
}

// ── Схемы структурированного вывода ─────────────────────────────────────────
const GEN_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, path: { type: 'string' },
    summary: { type: 'string' }, syntax_ok: { type: 'boolean' }, notes: { type: 'string' },
  }, required: ['id', 'path', 'syntax_ok'],
}
const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    dimension: { type: 'string' }, clean: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['high', 'med', 'low'] },
          where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' },
        }, required: ['severity', 'where', 'problem'],
      },
    },
  }, required: ['dimension', 'clean', 'issues'],
}
const FIX_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, path: { type: 'string' }, edited: { type: 'boolean' },
    changes: { type: 'array', items: { type: 'string' } },
    resolved: { type: 'boolean' },
    remaining: { type: 'array', items: { type: 'string' } },
  }, required: ['id', 'edited', 'resolved'],
}

// ── Оркестрация: pipeline на каждый кейс ────────────────────────────────────
let parsedArgs = args
if (typeof parsedArgs === 'string') parsedArgs = JSON.parse(parsedArgs)
if (!parsedArgs || !Array.isArray(parsedArgs.cases)) {
  throw new Error('args.cases отсутствует или не массив; передай {batch, cases:[...]}')
}
const specs = parsedArgs.cases

const results = await pipeline(
  specs,
  // STAGE 1: generate (или no-op для mode=verify, напр. эталон bfl-01)
  async (spec) => {
    if (spec.mode === 'verify') {
      log(`${spec.id}: verify-only (генерация пропущена)`)
      return { id: spec.id, path: spec.path, syntax_ok: true, summary: 'existing', notes: 'verify-only' }
    }
    return agent(genPrompt(spec), { label: `gen:${spec.id}`, phase: 'Generate', schema: GEN_SCHEMA })
  },
  // STAGE 2: verify — 3 скептика параллельно
  async (gen, spec) => {
    const verdicts = await parallel([
      () => agent(LENSES.legal(spec), { label: `legal:${spec.id}`, phase: 'Verify', schema: VERDICT_SCHEMA }),
      () => agent(LENSES.structure(spec), { label: `struct:${spec.id}`, phase: 'Verify', schema: VERDICT_SCHEMA }),
      () => agent(LENSES.ul(spec), { label: `ul:${spec.id}`, phase: 'Verify', schema: VERDICT_SCHEMA }),
    ])
    return { gen, spec, verdicts: verdicts.filter(Boolean) }
  },
  // STAGE 3: fix — только если есть high/med замечания и кейс не frozen
  async (vr, spec) => {
    const issues = vr.verdicts.flatMap(v => (v.issues || []).map(i => ({ ...i, dimension: v.dimension })))
    const actionable = issues.filter(i => i.severity === 'high' || i.severity === 'med')
    if (spec.mode === 'verify') {
      // эталон заморожен: не редактируем, только репортим
      return { id: spec.id, frozen: true, issues, fixed: null }
    }
    if (actionable.length === 0) {
      return { id: spec.id, frozen: false, issues, fixed: { edited: false, resolved: true, changes: [], remaining: [] } }
    }
    const fixed = await agent(fixPrompt(spec, actionable), { label: `fix:${spec.id}`, phase: 'Fix', schema: FIX_SCHEMA })
    return { id: spec.id, frozen: false, issues, fixed }
  },
)

return {
  batch: parsedArgs.batch,
  cases: results.filter(Boolean).map(r => ({
    id: r.id,
    frozen: r.frozen,
    total_issues: r.issues.length,
    high: r.issues.filter(i => i.severity === 'high').length,
    med: r.issues.filter(i => i.severity === 'med').length,
    resolved: r.fixed ? r.fixed.resolved : null,
    remaining: r.fixed ? r.fixed.remaining : r.issues,
  })),
}
