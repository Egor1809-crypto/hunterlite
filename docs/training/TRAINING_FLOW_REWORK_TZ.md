# ТЗ — Переработка потока тренировки (training → results)

**Контекст.** Продукт — спокойная B2B/B2C обучалка юристов по банкротству физлиц
(ФЗ-127). Дизайн-ориентир: malvah.co / abstract.com (редакторская сдержанность,
один акцент, без гейм-эстетики). Аудит (2026-06-04) показал: слой
`training → results` — это почти не переделанный старый симулятор **холодных
продаж** Hunter888. Цель ТЗ — привести его к юридической обучалке.

## Что УЖЕ хорошо (не трогать)
- Досье персонажа доходит до LLM: `app/ws/training.py:3641-3650`
  (`persona_brief` префиксится как авторитетный блок). Персонаж ведёт диалог.
- L10 «Юр. точность» — единственное настоящее юридическое измерение
  (вектор + regex по чанкам ФЗ-127), `app/services/scoring.py`.
- «Слабые места по ФЗ-127» → ссылка в Базу знаний (`results/[id]/page.tsx:973-1009`).
- Транскрипт диалога, «Навыки общения» (тайминги/talk-ratio/имя/перебивания),
  `CallDroppedCard` (уже спокойный — эталон тона), База знаний/Маняша.

## Что СТАРОЕ / неправильное (3 уровня)

### Уровень A — UI-остатки (удалить/успокоить, низкий риск)
- Кнопка **«Клиент»** (`LinkClientButton`) + **скрепка** (`SessionAttachmentButton`)
  в инпуте чата и звонка — CRM-функции. `training/[id]/page.tsx:1997-2004,2190-2197`,
  `call/page.tsx:1785-1794`.
- Карточка **«ДОБАВИТЬ В CRM»** + бейдж «ИСТОРИЯ CRM» + `ClientReveal` на результатах.
  `results/[id]/page.tsx:477-571,1148-1183`.
- **XP/уровни/ачивки/конфетти/звуки**: `page.tsx:589-620,166-173`, completion-modal
  `training/[id]/page.tsx:2590-2611` + `session.xp_update`.
- **Ловушки / стрики / «режим босса» / personal-challenge ⚔️ / story-mode «звонки N/M»**:
  `training/[id]/page.tsx:311-321,816-906,954-1052,1719-1851,2461-2516`.
- **Verdict-оверлей «ПОТЕРЯЛ КОНТРОЛЬ / ДОМИНИРУЮЩИЙ» + «Разбор полёта»**:
  `components/results/PostSessionVerdict.tsx` (glitch-шрифт, флэш, конфетти, звук).
- **Гейм-стилистика**: «pixel game style» HUD, жёсткие тени `4px 4px 0`, неон-бордеры,
  `global-mic-glow`, `btn-neon`, капс «ЗВОНОК АКТИВЕН»/«ТРЕНИРОВКА ЗАВЕРШЕНА».
- Исход звонка **«Договор согласован/не согласован»** + запись в карточку:
  `call/page.tsx:1603-1685`.

### Уровень B — интеграционный разрыв (двойная личность)
- На каждой сессии генерится случайный `ClientProfile` (`client_generator.generate_client_profile`,
  `ws/training.py:4085`) и тоже инъектится в промпт (имя/долг/доход/страхи),
  `ws/training.py:3534-3564`. Для persona-сессии это вторая, конфликтующая личность.
- **Решение:** если задан `reference_persona_slug` (есть `persona_brief`) — НЕ
  строить идентичность из сгенерированного `ClientProfile`; досье = единственный
  источник правды. ClientProfile оставить только как тех. строку (для FK/скоринга),
  но не как контент личности; либо заполнять его из персонажа.

### Уровень C — скоринг (концептуальная переработка, большой объём)
- `app/services/scoring.py` — это грейдер холодного звонка: L1 скрипт, L2 возражения,
  L5 «сделка/встреча», L6 цепочки возражений, L9 эмоция→`deal`, skill-radar
  (`closing/objection_handling/qualification`). Юридического — только L10.
- `ReferencePersona.scoring_rubric` (JSONB) — **не используется** скорингом.
- **Решение:** ввести юридическую рубрику оценки консультации вместо продажной:
  напр. правовая точность (ФЗ-127), полнота выяснения обстоятельств, корректность
  совета/рисков (red-flags из досье), ясность объяснения, эмпатия к должнику в
  стрессе. Потреблять `persona.scoring_rubric`. Перелейблить результаты
  (пентаграмма, L1-L10, базовые категории, `StageBreakdown`).

### Баг
- «AI-судья undefined»: `api/training.py:169-172` на тех-сбое пишет judge без
  `verdict`; фронт `JudgeVerdictCard.tsx:96` рисует `String(undefined)`.
  Фикс: добавить `verdict:"mixed"` + `rationale_ru` в fallback-словарь и/или
  заглушить default-ветку в `JudgeVerdictCard`.

## Фазы (предлагаемый порядок)
- **P0 (быстро, безопасно):** баг judge; убрать «Клиент»+скрепку из чата/звонка;
  убрать карточку «ДОБАВИТЬ В CRM» с результатов; заменить оверлей «ПОТЕРЯЛ
  КОНТРОЛЬ»/«Разбор полёта» на спокойную сводку (тон как `CallDroppedCard`).
- **P1 (де-геймификация/де-CRM):** убрать XP/ачивки/конфетти/звуки, ловушки,
  стрики, «режим босса», story-mode, исход-сделку; успокоить pixel/неон-стиль → токены.
- **P2 (интеграция):** при persona-сессии подавлять сгенерированную личность
  ClientProfile (досье — единственный источник); согласовать цифры в любых
  оставшихся карточках с персонажем.
- **P3 (скоринг → юридический):** новая рубрика консультации, потребление
  `persona.scoring_rubric`, перелейбл результатов. Самый крупный кусок;
  делать отдельной волной с регресс-тестами.

## Принцип
После очистки ядро сессии = диалог с AI-персонажем (досье ведёт его),
голос/текст-ввод, имя/эмоция/аватар, таймер, завершение → одна спокойная
страница результата с юридической обратной связью и ссылками в Базу знаний.

---

# Recon-аддендум (2026-06-04) — исправленные якоря + пропущенный объём

> Этот раздел добавлен после построчной ревизии origin/main (5 агентов).
> Он **дополняет и местами исправляет** диапазоны выше. При расхождении
> верить аддендуму — он сверен с кодом b9cec6c. ~30 якорей исходного ТЗ
> подтверждены точными; ниже только расхождения и пробелы.

## A. Исправленные якоря (дрейф/ошибка)
- `training/[id]/page.tsx:589-620` (XP) → **`session.xp_update` реально 594-604**;
  звуки — отдельный `useEffect` **311-321**. **Конфетти в этом файле НЕТ** (только
  `components/results/PostSessionVerdict.tsx`). Строка 589 = `router.replace('/results/...')`.
- Якорь **`166-173` (P1, «XP») — ОШИБОЧЕН**: там `story custom_params`. Удалить.
- `training/[id]/page.tsx:816-906` → traps реально **816-844** (`trap.triggered` 816,
  `trap.personal_challenge` 838); **846-906 = продажный коучинг** (`hint.*`/`whisper.coaching`),
  не ловушки. **Стрики/босс → `difficulty.update` 922-939** (вне исходного диапазона).
- completion-modal: caps-заголовок «ТРЕНИРОВКА ЗАВЕРШЕНА» — **2575** (модал с 2568),
  XP-бейджи 2590-2611 — точны.
- `ws/training.py:3534-3564` (инъекция ClientProfile) → блок стартует на **3532**
  (заголовок «## Контекст клиента»), имя на 3534, `def _build_client_profile_prompt` на **3519**.
- `ws/training.py:3641-3650` (persona_brief, НЕ ТРОГАТЬ) → реально **3633-3656**.

## B. P0 — дописать в объём
- **(HIGH) Гейт `showVerdict` на странице результата**: `results/[id]/page.tsx:97`
  (`useState(true)`), гейт рендера 382, и **главное — основной контент скрыт
  `display:none` на 390** пока показан оверлей. Замена `PostSessionVerdict` на спокойную
  сводку ОБЯЗАНА переработать этот гейт, иначе страница останется пустой. Эталон тона — `CallDroppedCard`.
- **(HIGH) +2 скрытые CRM-поверхности** сверх инпута: `LinkClientButton@results:1158-1176`
  (вторая, «cross-session память») и `InputBarMoreMenu.tsx:20,95` (kebab оборачивает
  `SessionAttachmentButton`). Удалять синхронно — иначе битый импорт.
- **(MED)** CRM CTA-блок (498-571) и второй LinkClientButton (1155-1183) делят семантику
  `/clients/from-session` + `real_client_id` — убирать синхронно (иначе полу-функционал).
- **(MED)** Импорты-сироты после P0: `results:50-61` (`ClientReveal/LinkClientButton/PostSessionVerdict`,
  иконки `Layers3/Users/RotateCcw`) → tsc/eslint упадёт, чистить в той же фазе.
- **(LOW)** Judge-фикс — **defense-in-depth**: backend `training.py:169` (`verdict:"mixed"`+`rationale_ru`)
  И заглушка default-ветки `JudgeVerdictCard.tsx:93-100`. Нормальный judge всегда даёт verdict
  (`scoring_llm_judge._default_verdict='mixed'`); баг изолирован одним путём (technical-disconnect fallback).
- **(LOW)** Бейдж «ИСТОРИЯ CRM» `results:477-484` гейтится по `story` → исчезнет сам в P1; решить судьбу.

## C. P1 — дописать в объём
- **(HIGH) Deal-outcome — это КОНТРАКТ, не UI.** Удаление 3 кнопок без отключения
  end-guard `terminal_outcome_required` → завершение падает 400. Цепочка: фронт
  `completeHangup('agreed'/'not_agreed'/'continue')` → `POST /sessions/{id}/end` →
  `runtime_guard_engine.evaluate_end_guards` (`allowed_outcomes`) → `state['call_outcome']`
  (`ws/training.py:2459,2647`) → `normalize_session_outcome` (`api/training.py:1744-1822`) →
  потребители: `completion_policy.py:374-377/593`, `scoring.py:1554-1581` (L5), `crm_followup.py:51-54`
  (создаёт ManagerReminder), `event_bus.py:604` ('deal'→DEAL_CLOSED). Менять фронт+guard синхронно,
  согласовать с P3.
- **(HIGH) XP — серверная под-фаза обязательна** (фронт не уберёт): `manager_progress.py:247-347`,
  emit `ws/training.py:6687`, REST `progress.py:574-575`, `runtime_finalizer.py:159-160`,
  схема `schemas/training.py:395-396`. + **XP-дубль на `/results:88,162,385,589-604`** (`+{grand_total} XP`,
  level_up, achievement-toast) — без чистки результата дегеймификация неполна.
- **(HIGH) Решение по XP-БД-персистентности**: `models/xp_{log,event}.py`,
  `services/{gamification,xp_events,xp_daily_cap}.py`, `api/gamification.py`. Вырезать запись
  (миграция) / убрать только показ / оставить. `settings/page.tsx:227` — хрупкий контракт.
- **(MED)** Не перечислено в ТЗ: **Script\* UI** (L1 скрипт продаж: `Script{Adherence,Drawer,Hints,Panel}.tsx`),
  inline «Принятие сделки» (`page:1584` «Готов к сделке» acceptanceScore≥80, `2335`),
  **TG-бот** (`telegram/bot.py:37-151,257`, копирайт «AI-тренировки», deeplink `buy_`),
  **3-я точка входа `training/page.tsx`+`TestWorldMap.tsx`** (гейм-метафора «карта мира»),
  профиль-стрики `ActivityHeatmap.tsx:37-38,246`.
- **(MED) Story-mode остаток** вне page: компоненты `StoryProgress/PreCallBrief/BetweenCalls/
  StoryCallReport/ConsequenceToast/HumanFactorIcons`, store `useSessionStore.ts:173-178`,
  бэк `_handle_story_start` `ws/training.py:6702`, маршрут `?mode=story`. Trap store:
  `TrapNotification/TrapLog/DifficultyIndicator`, `useSessionStore.ts:451-497`.
- **(MED) Эмиттеры бэка** ловушек/босса: `ws/training.py:961,3111-3137,5336-5503` —
  фронт-хендлеры удалять СИНХРОННО с emit.
- **(Шаред, не удалять глобально)** `useSound.ts` (нужен `useTTS.ts` для громкости AI-голоса —
  вырезать только пресеты `epic/fail/legendary/levelup`), `Confetti/ScreenShake` (живут и в pvp/quiz —
  снимать через импорты), `btn-neon`/`global-mic-glow`/`emotion-flash` (шаред-токены/функции —
  перекрашивать в токены, не удалять класс).

## D. P2 — дописать в объём
- **(HIGH) Точка вставки условия — ВНУТРИ `_build_client_profile_prompt` (`ws/training.py:3519`)**,
  не у каждого из **4 call-site** (`831,4006,4107,4368`; все передают `ambient_ctx=custom_params`).
- **(HIGH) ВТОРОЙ источник идентичности — пин имени `ws/training.py:1249-1259`**
  (`_build_extended_system_prompt` пиннит `state["client_name"]` из сгенерированного ClientProfile
  как «НЕИЗМЕНЯЕМЫЙ ФАКТ, игнорируй другое имя» — стоит ВЫШЕ досье). **Без правки этого пина
  подавление тела бесполезно** — случайное имя навяжется. Заполняется `829/4011/4099/4463`.
- **(HIGH)** `generate_client_profile` генерит СЛУЧАЙНЫЕ name/debt/fears (`client_generator.py:1490,1519,1561`),
  НЕ из `persona.cached_dossier`; у `ReferencePersona` структурированных чисел нет (кроме `debt_range/debt_stage`).
  2-я точка генерации — `ws/training.py:4340` (story next-call) + `build_profile_from_real_client:4038`.
- **(MED)** Детект persona — **только по непустому** `ambient_ctx.get("persona_brief")`;
  `reference_persona_slug` бывает без brief → по нему не подавлять. `get_crm_card`→`client_card`
  на фронт (call-sites `828,4011,4099,4363`).
- **(Не трогать)** Сохранить блок «## Атмосфера» (`3566-3623`) и persona-префикс; НЕ делать
  ранний return до ambient; создание записи ClientProfile в БД не убирать (FK/скоринг).

## E. P3 — дописать в объём
- **(HIGH) Слоёв реально 12, не 10.** Сверх L1-L10 ТЗ упустил: **L4** `anti_patterns`
  (`scoring.py:473-602`, продажные false_promises/intimidation/talk_ratio), **L7** `trap_handling`
  (`1604-1634`), **L11** `_score_adaptation` (`1080-1298`, продажные архетипы), **L12** `_score_time_management`.
  + **α LLM-judge** (`scoring_llm_judge.py:238-241`) добавляет `[-8,+5]` в total, промпт
  «наставник менеджера холодных звонков» — в перелейбл.
- **(HIGH) Cross-фаза L7/L9 ↔ радар.** Удаление ловушек(L7)/story(L9) в P1 требует
  **перебалансировки весов `skill_radar` в P3 в 3 местах**: `scoring.py:skill_radar (98-192)`,
  `analytics.py:compute_session_radar (209-230,937-954)`, FE `SKILL_LABELS`. Иначе оси
  knowledge/legal_knowledge/objection_handling схлопнутся на нулях. **Не отражено в исходном ТЗ.**
- **(HIGH) Рекомендации и тексты**: `_generate_rule_based_recommendations`/`generate_recommendations`
  (`scoring.py:1809-1947`, LLM-промпт «тренер по продажам»), layer_explanations RU
  (`scoring.py:1968-2215`, «клиент согласился на консультацию / встреча назначена»).
- **(HIGH) Фронт продажный** (перелейбл/замена): `StageBreakdown.tsx:8-16,39-111` (7-этапный
  скрипт продаж), `ScoreLayersBreakdown.tsx:47-58,302-311`, `{TrapResults,ScriptProgressReport}.tsx`,
  `VibeMeter.tsx:28` (`'Сделка'`), `EmotionTimeline.tsx:68,306,312`, пентаграмма
  `results/[id]/page.tsx:284-312` (5 продажных осей из `score_*`), `WeeklyReport/Benchmark/AICoachSection`
  (`SKILL_LABELS`), `dashboard/page.tsx:169` («Воронка продаж»).
- **(HIGH) `persona.scoring_rubric`** — потребление СЕРВЕРНОЕ (грузить `ReferencePersona` по
  `reference_persona_slug` сессии). Содержимое уже юридическое, но **ключи `metrics` = старые
  продажные имена** (`script_adherence/objection_handling`) — переименовать/маппить во всех
  **25 сидах `personas_data/`** + синхронно `validate_personas.py:69-74`.
- **(HIGH) Тесты в объёме** (сломаются): `test_scoring*.py` (7 файлов), `test_script_checker.py`,
  `test_gamification.py`, `test_judge_anchored_flags.py`, web `hangup-flow.test.tsx`.
- **(Инвариант) НЕ менять имена полей хранения** `ScoreBreakdown`/`session.score_*` (каскад миграций
  на API/FE/analytics/manager_progress) — менять только лейблы/criteria/веса.

## F. «НЕ ТРОГАТЬ» (продуктовое ядро — подтверждено ревизией)
- `JudgeVerdictCard` (разбор настоящего LLM-судьи, strengths/red_flags + jump-to-message) —
  P0 чинит только undefined в fallback, карточка остаётся.
- **L10** `_score_legal_accuracy` (`scoring.py:1014-1073`, вектор+regex ФЗ-127) +
  `legal_checker`/`rag_legal`/`legal_knowledge_chunks` + `weak_legal_categories→/knowledge`
  (`results:973-1011`) — единственное юр-измерение; P3-рубрику строить ВОКРУГ, не выпиливая.
- `persona_brief` префикс (`ws:3633-3656`), блок «## Атмосфера» (3566-3623), `SoftSkillsCard`
  («Навыки общения»), транскрипт, эмоция/аватар/таймер, `CallDroppedCard` (эталон тона).
- **Изолированные движки (не задеть wholesale по grep):** exam/quiz/knowledge скоринг
  (`exam_grader/exam_rule_grader/knowledge_quiz*/warmup_grader/wiki_quiz` — **НЕ импортируют
  `app.services.scoring`**), `ws/knowledge.py`, `models/knowledge*`, движок тестов.
- **Инварианты CLAUDE.md:** AST-guard `test_client_domain_invariants.py` (не обходить
  `client_domain` helpers при чистке CRM на бэке); завершение через `ConversationCompletionPolicy` (§3).
- Слои в try/except fail-soft→0: при перелейбле молчаливый ноль легко принять за «работает» (§4.4) —
  проверять user-facing, не только «тест зелёный».
