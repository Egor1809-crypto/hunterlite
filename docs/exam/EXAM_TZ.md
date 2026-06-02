# ТЗ-4 — Экзамены (страница `/exam`): 5 разных механик + AI-грейдинг

> Статус: **детализация (Фаза 2)**, границы согласованы 2026-06-02. Формат — как
> `docs/cases/SCALING_TZ.md`. Документ самодостаточный. Работа агента — через `/ultracode`.
> LLM: **`deepseek-v4-pro` через `https://api.navy/v1`** (env: `NAVY_LLM_*`,
> `exam_model=deepseek-v4-pro` в `config.py`). Только **банкротство ФИЗЛИЦ / ФЗ-127**.

---

## 0. Контекст и проблема

Сейчас экзамен = **обеднённый тест**: статичный банк MCQ (`ExamQuestion`, 201 шт),
сравнение ответа на равенство, фиксированные 88%, таймер, сертификат. 5 экзаменов
отличаются **только фильтром категорий и числом вопросов** — механика одна. При этом
knowledge-тест (`KnowledgeQuizSession`) **богаче** экзамена (LLM-грейдинг free-text,
RAG, режимы). Экзамен ощущается как «тест попроще».

**Цель:** сделать экзамен **отдельным, реально сложным, продуманным** действием со
**своей БД учебного контента** (не игрового), где **каждый из 5 экзаменов — своя
механика**, и где сложные ответы оцениваются **AI (deepseek)**.

**Решение заказчика:** **5 разных механик + AI-грейдинг.** Сначала — **1 эталонный
экзамен** (планка качества), затем масштаб через `/ultracode`.

---

## 1. Что есть сейчас (факты, file:line)

- Модели `apps/api/app/models/exam.py`: `ExamDefinition` (id `exam-1..5`, categories,
  question_count, time_limit, pass_threshold=88, unlock_condition, order_index),
  `ExamQuestion` (MCQ: options jsonb, correct_option_id, explanation, article_reference;
  `exam_id` **nullable, сеется None** — вопросы пулятся по `category`), `ExamAttempt`
  (answers jsonb, score_percent, passed, certificate_code, question_ids), `ExamCertificate`.
- Сид `apps/api/scripts/seed_exam_questions.py`: 5 определений + 201 MCQ, 10 категорий.
- API `apps/api/app/api/exams.py`: `GET /exams/`, `POST /{id}/start` (5/hour,
  random.sample по категориям, шафл), `POST /{id}/submit` (equality-грейдинг, percent vs
  88, генерация cert `HL-EXAM{n}-{year}-{hex}`, upsert `TrainingMapProgress.exams`),
  `GET /{id}/results`, `GET /certificate/{code}`.
- FE `apps/web/src/app/exam/`: `page.tsx` (список+степпер), `[examId]/page.tsx` (плеер,
  клиентский таймер, авто-сабмит), `certificate/[examId]`, `certificate/verify/[code]`.
- **AI-грейдинг — отсутствует** в экзамене. Готовый паттерн free-text грейдинга:
  `apps/api/app/services/warmup_grader.py` (`grade()` `:154` → `{score 0-100, ok,
  covered[], missed[], feedback}`, strict JSON, Redis-кэш, graceful fallback). RAG-
  заземление: `knowledge_assistant`/`rag_legal`.
- Шаблон богатой модели: `apps/api/app/models/case_scenario.py` (optimal_path,
  expert_analysis, steps jsonb, stage1/stage2, max_score; двухстадийный `CaseAttempt`).

---

## 2. Своя БД учебного контента (новое — отдельно от `ExamQuestion`)

Новые таблицы (alembic, `sa.text`), **независимые от quiz/knowledge** (та подсистема —
мусор) и от `ExamQuestion` (его можно оставить как один MCQ-тип):
```
exam_item:
  id (uuid pk), exam_id (fk exam_definition, idx), order_index (int),
  type (enum: mcq | multi_select | sequencing | matching | numeric |
        case_analysis | document_drafting | multi_step),
  prompt (text), payload (jsonb)        # зависит от type (варианты/пары/факт-паттерн/...)
  answer_key (jsonb)                    # ключ ИЛИ рубрика (для AI-грейда: key_points/веса)
  rubric (jsonb?)                       # критерии AI-оценки (covered/missed/веса)
  points (int)                          # вес сложности (а не flat percent)
  rag_chunk_refs (jsonb?)               # чанки для заземления AI-грейда
  difficulty (int), article_reference (str?), explanation (text), is_active (bool)
exam_item_attempt:                      # пер-итем результат в рамках попытки
  id, attempt_id (fk exam_attempt, idx), item_id (fk, idx),
  raw_answer (jsonb/text), score (float), max_score (float), passed (bool),
  ai_feedback (jsonb?: covered/missed/feedback), graded_by (enum: rule|ai), created_at
```
`ExamDefinition` дополнить: `blueprint` (jsonb — состав типов/числа итемов на экзамен),
per-exam `pass_threshold` (убрать хардкод 88 из 3 мест), `mechanic` (enum — основная
механика экзамена). `ExamAttempt` расширить весовым скором (sum(score)/sum(max)).

> **DECISION-A:** оставить `ExamQuestion` как один из item-типов (mcq) или
> мигрировать всё в `exam_item`? Реком.: новые типы в `exam_item`; `ExamQuestion`
> постепенно поглотить (на старте — мост: экзамен-1 может частично читать MCQ-банк).

Сид: `apps/api/scripts/seed_exam_content.py` (контент для эталонного экзамена сначала).

---

## 3. Пять механик (по одной на экзамен, всё ФЗ-127 физлица)

1. **exam-1 «Основы» — Hard-MCQ + числа/сроки.** MCQ, но глубоко: 5 вариантов,
   жёсткие дистракторы, числовые/датовые итемы (сроки наблюдения/публикаций,
   прожиточный минимум, госпошлина). Весовой скоринг. Грейд — rule-based.
2. **exam-2 «Процедура» — Sequencing/Matching.** Расставить этапы процедуры в
   правильном порядке (подача → проверка обоснованности → реструктуризация/реализация
   → завершение); сопоставить статьи ↔ действия/последствия. Грейд — rule (порядок/пары).
3. **exam-3 «Анализ дела» — Case-analysis (AI free-text).** Дан факт-паттерн (доходы,
   имущество, сделки за 3 года, иждивенцы) → юрист пишет анализ (единственное жильё,
   оспоримые сделки, реструктуризация vs реализация). **AI-грейд** (deepseek) по рубрике
   (covered/missed key points), RAG-заземление.
4. **exam-4 «Документ» — Document-drafting (AI).** Составить реальный документ
   (заявление о банкротстве / опись имущества / ходатайство об исключении прожит.
   минимума). **AI-грейд**: полнота, обязательные поля, юр-корректность, ссылки на статьи.
5. **exam-5 «Капстоун» — Multi-step adaptive (мок-дело).** Полное симулированное дело
   с ветвящимися шагами, смешивает типы из 1-4, тайм-прессинг, высокий весовой порог —
   настоящий финал. AI-грейд на свободных шагах.

**Эталон (делаем первым):** **exam-3 «Анализ дела»** (или exam-1 — **DECISION-B**,
реком. exam-3: на нём виден весь AI-грейд-конвейер). Один идеальный экзамен со всеми
итемами, рубриками, RAG-рефами — планка качества.

---

## 4. AI-грейдинг (deepseek-v4-pro)

Сервис `apps/api/app/services/exam_grader.py` по образцу `warmup_grader.py`, но:
- модель `settings.exam_model` (`deepseek-v4-pro`), `temperature ~0.2`, strict JSON;
- **без «это разминка»-снисхождения**, строгая рубрика, RAG-заземление (передавать
  `rag_chunk_refs` итема в контекст);
- Redis-кэш по `sha1(model|item_id|normalized_answer)` (детерминизм для апелляций);
- graceful fallback при падении navy: **не выдавать сертификат**, пометить попытку
  `grading_pending`, дать пере-грейд (см. §5).
- Возврат `{score 0..max, covered[], missed[], feedback}` → `exam_item_attempt`.

## 5. Контракт API (изменения)
- `POST /{id}/start` → выдаёт `exam_item[]` по `blueprint` (без ключей/рубрик).
- `POST /{id}/submit` → грейдит: rule-итемы синхронно, AI-итемы через `exam_grader`
  (возможно async/очередь при долгой генерации). Итог = взвешенный скор vs per-exam
  `pass_threshold`. Сертификат — только при полном грейде и проходе.
- Новое: `POST /exams/attempts/{id}/regrade` (апелляция/повтор AI-грейда),
  `GET /exams/attempts/{id}` (детальный разбор по итемам с covered/missed).
- **Серверная валидация таймера** в submit (сейчас таймер только клиентский,
  `[examId]/page.tsx:97`) — для сертифицируемого экзамена обязательно.

## 6. Фронт
- Плеер `[examId]/page.tsx` рендерит итемы по `type` (MCQ / drag-sequencing /
  matching / текстовое поле для case_analysis/drafting / numeric / multi-step).
- Результаты: по AI-итемам показать covered/missed/feedback (учебная ценность).
- Убрать хардкод `PASS_THRESHOLD=88` (FE `:34`, results `:244`) → брать из определения.
- Сертификат — без изменений (но выдаётся только при пройденном полном грейде).

## 7. Обработка ошибок / edge cases
- navy недоступен при submit → попытка `grading_pending`, без сертификата, пере-грейд.
- AI-скор недетерминирован → Redis-кэш делает (item, answer) стабильным; апелляция = сброс кэша.
- Частичный грейд (часть AI-итемов упала) → не финализировать, дождаться/пере-грейдить.
- Не зависеть от quiz/knowledge таблиц (мусор). Свой контент в `exam_*`.
- Миграции `sa.text`, `upgrade head` зелёный; `models/__init__` без висячих экспортов
  (урок TZ-1: проверить `from app.models import *` + `configure_mappers()`).

## 8. Критерии готовности (DoD)
1. Своя БД `exam_item`/`exam_item_attempt` + `blueprint`/`mechanic`/per-exam threshold;
   миграция `upgrade head` проходит.
2. Эталонный экзамен (exam-3) полностью работает: итемы рендерятся, AI-грейд через
   deepseek возвращает covered/missed/feedback, взвешенный скор, сертификат при проходе.
3. AI-грейд деградирует безопасно (нет navy → нет ложного сертификата).
4. Серверная валидация таймера в submit.
5. 5 экзаменов имеют **разные** механики (хотя бы каркасно; контент эталона — глубокий).
6. `app.main` + `models import *` ОК, `tsc` чисто, CI blocking зелёный, §1.

## 9. Приёмка качества (состязательная, `/ultracode`)
Скептики: (а) юр-достоверность контента и рубрик (реальная практика ФЗ-127, физлица,
без юрлиц); (б) AI-грейд не завышает/занижает (тест-кейсы: эталонный ответ → высокий
скор, мусорный → низкий); (в) сложность реально выше теста; (г) детерминизм/апелляции;
(д) безопасная деградация. Пачками → зелёный валидатор + браузер.

## 10. Порядок + git §1
Ветка `claude/exam-rebuild`, ребейз, коммит только своих файлов, diff-проверка перед
push. Этапы: (1) модели/миграция `exam_*`; (2) `exam_grader` (deepseek) + тесты грейда;
(3) эталон exam-3 (контент+рубрики+RAG-рефы) + сид; (4) API submit/regrade + таймер;
(5) FE-плеер итем-типов; (6) браузерная проверка эталона; затем масштаб 5 механик.

## 11. Открытые DECISION (заказчику)
- **DECISION-A:** `ExamQuestion` поглотить в `exam_item` или мост? (реком. новые типы в exam_item, MCQ-банк как мост)
- **DECISION-B:** эталон — exam-3 (AI-анализ, реком.) или exam-1 (hard-MCQ, проще)?
- **DECISION-C:** AI-грейд синхронно в submit или async-очередь? (реком.: синхронно для эталона, async если долго)
- **DECISION-D:** per-exam пороги — какие? (сейчас flat 88; реком. задать на этапе контента)

## Ключевые файлы
`apps/api/app/models/exam.py`, `apps/api/app/models/case_scenario.py` (шаблон),
`apps/api/app/api/exams.py`, `apps/api/scripts/seed_exam_questions.py`,
`apps/api/app/services/warmup_grader.py` (шаблон грейда), `apps/api/app/services/llm.py`,
`apps/api/app/config.py` (`exam_model`), `apps/api/app/services/knowledge_assistant.py`
(RAG-заземление), `apps/web/src/app/exam/*`.
