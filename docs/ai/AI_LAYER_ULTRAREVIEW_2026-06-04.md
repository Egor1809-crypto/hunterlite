# Ультраревью AI-слоя HunterLite (2026-06-04)

Состязательный аудит navy.api + всех AI-поверхностей (18 opus-агентов: ревью →
скептик-верификация → синтез, с живыми вызовами). Read-only. Ниже — только
confirmed-находки (refuted отброшены).

## Верхний вердикт: ЧАСТИЧНО
AI-слой работает на «тёплом счастливом пути», но НЕ штатно/идеально:
подтверждены 6 critical, где пользователь молча получает мусор или нулевую
оценку. Системные корни:
1. roleplay output-фильтр и scripted-заглушки применяются ко ВСЕМ task_type →
   ломают JSON судьи и подсовывают реплики должника в ответы коуча.
2. стриминговый roleplay вообще не фильтруется → сырые токены на экран и в TTS.
3. high-stakes пути (exam-grader, radar, history) минуют центральный
   fallback/circuit-breaker, а их закреплённые модели сейчас 500-ят.
4. LLM-классификатор сценариев мёртв на 100%; radar выдаёт 0 апдейтов.

## Таблица поверхностей
| Surface | Работает (live)? | Модель | Вердикт |
|---|---|---|---|
| navy-core | да | deepseek→gpt-5.5→gemini | резильентность ядра ОК; 2 major |
| roleplay | частично | gemini-3.5-flash | стрим не фильтруется (critical) |
| manyasha | да | gpt-5.5 | работает; env-дрейф, 2000-char truncation, gemini-fallback несовместим с tools |
| exam-grader | да | deepseek (raw httpx) | работает, но минует fallback; substring required-cap баг |
| judge | частично | gemini | ```json уничтожается фильтром (critical) |
| coach/report | частично | gemini | реплики должника в коуче при navy-down (critical) |
| radar/extractor | частично | classifier/extractor/radar | классификатор мёртв; radar 0 апдейтов (critical×2) |
| filters-rag | частично | gemini-embedding / haiku reranker | фильтры сильные; v2 RAG мёртв на чужих env-ключах (critical) |

## CRITICAL (confirmed)
- **C1.** Стриминговый roleplay отдаёт нефильтрованный вывод на экран+TTS, фильтр только логирует; персистится сырой текст. `llm.py:3168-3202`, `ws/training.py:1909-1939,2027-2037`.
- **C2.** ```json-обёртка ответа судьи режется reasoning-leak фильтром → подставляется roleplay-филлер → парс падает (score_adjust=0). `llm.py:2660-2666,471-473`, `content_filter.py:532-558`.
- **C3.** При navy-down scripted-фоллбэк подсовывает реплики ДОЛЖНИКА в ответы коуча / ideal-response / recommendations. `llm.py:2687`, `training.py:2642,2675,2984-3002`, `scoring.py:2431`, `ai_coach.py:96`.
- **C4.** LLM-классификатор сценариев мёртв на 100% (reasoning-модель `gemini-3.1-pro-preview` + max_tokens=300 → finish_reason=length); эвристика мисроутит. `scenario_extractor_llm.py:76,168`.
- **C5.** Radar refresh выдаёт 0 апдейтов (RSS relevance-gate + interlock: AI-fallback запускается при пустом `updates`, а не при пустом `relevant`). `legal_radar.py:228-241,94-95`.
- **C6.** v2 legal-RAG + reranker читают `os.environ['LOCAL_*']`, которых нет (проект задаёт `NAVY_*` только в settings) → embedding всегда None, 0 grounded чанков; в `rag_unified` нет fallback на legacy. `rag_legal_v2.py:74-78`, `rag_reranker.py:78-81`, `rag_unified.py:216-244`.

## MAJOR (confirmed) — кратко
- exam-grader минует CB+fallback (deepseek 500 → экзамены не грейдятся, хотя gpt-5.5 жив); substring required-cap (kp1∈kp10); нет reasoning_content-rescue. `exam_grader.py:298-354,385-386,341`.
- navy-core: `_stream_navy` шлёт temperature всегда → 400 на gpt-5.x; пустой content для judge/coach/report проходит молча. `llm.py:2874-2877,446-475`.
- roleplay: blocking-путь заменяет чистый ответ на филлер при любом benign-violation; mid-stream сбой → частичные токены + дубль blocking-fallback. `llm.py:471-475,3168-3240`.
- manyasha: молчаливая обрезка на 2000 символов (vs 12000 токенов); >4 tool-шагов → generic FAILURE + отброс добытых чанков; env-дрейф (.env=deepseek/2048 vs код gpt-5.5/12000); fallback=gemini несовместим с tools. `content_filter.py:164`, `knowledge_assistant.py:78,543-571,72-80`, `llm.py:252-301`.
- judge: max_tokens=600 обрезает rationale_ru → невалидный JSON; cold-timeout 8s → judge=0 блокирует /results; транскрипт не изолирован `[DATA_START]`. `scoring_llm_judge.py:434,47,241-272`.
- coach: эндпоинт без try/except → 500; create_task с request-scoped сессией; navy-200-empty → пустой ответ. `training.py:2667-2680`, `ai_coach.py:96-149`.
- radar: AI-генерация без retry/fallback фабрикует НЕзаземлённые юр-новости (source_url=None) как реальные; /radar/refresh неразличимо возвращает 0. `legal_radar.py:144-181`, `knowledge_ai.py:430-437`.
- filters: PII-regex переедает обычные числа → суммы/номера в legal-чанках бланкуются перед LLM; `filter_*(None)` падает TypeError → 500; pgvector через f-string. `content_filter.py:132-148,59-67`, `rag_legal_v2.py:128-135`.

## Сильные стороны
- Все основные промпты — полные, на русском, доменно-верные по ФЗ-127, без литеральных плейсхолдеров.
- Инъекция в основном защищена (exam-grader/manyasha live-устойчивы к джейлбрейку).
- navy-ядро: fallback-цепочка + circuit-breaker live-подтверждены (deepseek 500 → gpt-5.5 отработал).

## Рекомендованные фиксы по приоритету
1. Убрать roleplay-фильтр и scripted/FALLBACK_PHRASE для `task_type in ('judge','report','structured','coach')` — одним изменением чинит C2+C3+empty. `llm.py:471-473,2660-2666,2687`.
2. C1: фильтровать стрим (mid-stream hard-stop + filter_ai_output перед персистом). `llm.py:3168-3202`, `ws/training.py:1909-1939`.
3. C6: v2-RAG/reranker на `settings.*` ключи + try-v2-then-legacy в rag_unified.
4. C4+C5: оживить классификатор (non-reasoning/↑max_tokens) и radar interlock (AI при пустом `relevant`).
5. exam-grader: reasoning_content-rescue + set-equality required-cap + маршрут через `_call_with_backoff`.
6. judge: max_tokens 600→~1000 + salvage JSON; `[DATA_START]` на транскрипт; пересмотреть 8s timeout / увести с блокирующего /results.
7. manyasha: output-cap не 2000; ↑_MAX_STEPS + сохранять чанки при cap; исключить gemini из fallback при tools; .env vs код.
8. navy-core: temp-guard в `_stream_navy`; empty-content backstop для non-roleplay; model_not_found = non-retryable.
9. coach: try/except + свежая сессия в create_task; гейт на `model=='scripted'`, НЕ на `is_fallback`.
10. filters: `if not text: return ('',[])`; сузить PII-regex; вырезать role_break.
11. radar: AI через `generate_response` (CB+fallback); явный статус refresh; пометка AI-generated/unverified.
