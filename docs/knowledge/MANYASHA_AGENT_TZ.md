# ТЗ-3 — Маняша-агент в «Базе знаний» (страница `/knowledge`)

> Статус: **детализация (Фаза 2)**, границы согласованы 2026-06-02. Формат — как
> `docs/cases/SCALING_TZ.md`. Документ самодостаточный.
> LLM: **`deepseek-v4-pro` через `https://api.navy/v1`** (env уже есть:
> `NAVY_LLM_*`, `KNOWLEDGE_AI_MODEL=deepseek-v4-pro`). Работа агента — через `/ultracode`.

---

## 0. Контекст и цель

`/knowledge` = три вкладки: **Справочник** (RAG-обзор `LegalKnowledgeChunk`, 629 чанков),
**Радар** (`LegalUpdate`), **AI-помощник** (сейчас — безликий одношот).

**Цель:** заменить «AI-помощник» на **Маняшу-агента** — полноценный диалоговый агент
по базе знаний (RAG + Радар) с **серверной памятью**, **tool-use** и **снятыми
лимитами токенов**, на `deepseek-v4-pro`. Маняша = маскот платформы (видео/персона/TTS).

**Решение заказчика:** **полный агент** (память + tool-use + без лимитов).

---

## 1. Что есть сейчас (факты, file:line)

- **Surface A** — вкладка «AI-помощник»: `apps/web/src/app/knowledge/page.tsx`
  (`handleAsk` `:177`, одно поле + «Спросить»; «история» — фейковая, sessionStorage
  `:163-175`, модель не видит прошлых ходов). Бэк: `POST /knowledge-ai/ask`
  (`apps/api/app/api/knowledge_ai.py:78`, rate-limit `20/hour`, вход `max_length=1000`)
  → `knowledge_assistant.ask()` (`apps/api/app/services/knowledge_assistant.py:84`,
  **stateless**, RAG top_k=12, `_MAX_TOKENS=4096` floor `:38`, ad-hoc OpenAI-клиент `:77`).
- **Surface B** — плавающий `apps/web/src/components/ManyashaChat.tsx` (готовый чат-UX:
  маскот-видео, перетаскивание, typing, quick-questions, TTS-хук, **клиентская память**
  последних N сообщений). Сейчас бьёт в Next-route `app/api/chat/route.ts` (персона
  Маняши + `max_tokens:2000`, **без RAG**, без бэкенд-памяти).
- **RAG**: `retrieve_legal_context(query, db, top_k, prefer_embedding)`
  (`apps/api/app/services/rag_legal.py:505`). **Радар**: `legal_radar.py` +
  `/knowledge-ai/radar*`.
- **Провайдер**: navy-only (`config.py:47-151`). Пуловый клиент с retry/health/
  streaming/tool-use — `apps/api/app/services/llm.py` (`_get_local_client` `:432`,
  `generate_response` `:2173`); инфра tools — `app/services/llm_tools.py`, `app/mcp/`.

---

## 2. Целевая архитектура

**Слить лицо B (персона/маскот/TTS) на мозг A (RAG `ask`), добавить серверную память
и агентность.** Маняша живёт **в самой вкладке** «AI-помощник» как чат (а не одношот);
плавающий `ManyashaChat` на `/knowledge` отключить, чтобы не было двух Маняш
(**DECISION-A**, реком.: in-tab чат на `/knowledge`, плавающий скрыть на этой странице).

### 2.1 Серверная память (новое)
Новые таблицы (alembic-миграция, `sa.text` для raw SQL):
```
assistant_conversation:
  id (uuid pk), user_id (fk users, idx), title (str, авто из 1-го вопроса),
  created_at, updated_at, last_message_at, is_archived (bool)
assistant_message:
  id (uuid pk), conversation_id (fk, idx), role (enum: system|user|assistant|tool),
  content (text), tool_name (str?), tool_args (jsonb?), rag_chunk_ids (jsonb?),
  tokens (int?), created_at (idx)
```
Модель: одна **rolling-нить на пользователя** по умолчанию + возможность нескольких
именованных бесед (**DECISION-B**, реком.: несколько именованных бесед, дефолтная =
последняя). Хранилище — **Postgres** (не Redis: нужны история/заголовки/восстановление).

### 2.2 Агент (tool-use)
`ask()` → агентный цикл на `llm.py` (пуловый клиент, не ad-hoc). Инструменты
(реестр `app/mcp/` / `llm_tools.py`):
- `search_knowledge_base(query, category?, top_k)` → RAG-чанки (обёртка `retrieve_legal_context`).
- `get_radar_updates(category?, since?)` → `LegalUpdate`.
- `fetch_chunk(chunk_id)` / `fetch_article(law_article)` → конкретный чанк/статья.
Цикл: до `MAX_STEPS` (реком. 4) шагов tool-call → финальный ответ. Каждый ход
сохраняется в `assistant_message` (включая tool-вызовы и использованные `rag_chunk_ids`).

### 2.3 Снятие лимитов
- Убрать вход `max_length=1000` (`knowledge_ai.py:26`) → разумный потолок (реком. 8000).
- `_MAX_TOKENS` → высокий потолок ответа (реком. 8–16K; «без лимитов» = высокий
  cap, провайдерский предел всё равно есть). **Обязательно**: фолбэк
  `content`→`reasoning_content` на бэке (deepseek — reasoning-модель; сейчас бэк читает
  только `message.content` `:127`, а Next-route уже фолбэчит — перенести фолбэк в бэк).
- Rate-limit `20/hour` (`:79`) поднять/переосмыслить под многоходовый агент
  (реком. лимит по conversation/в минуту, не 20/час).

### 2.4 Персона (унификация)
Единый серверный системный промпт «Маняша, БФЛ/ФЗ-127» (взять из `route.ts:26-36`,
положить в бэк `knowledge_assistant`). Убрать расхождение с генерик-«наставником».

### 2.5 Провайдер
Маршрутизировать ассистента через **`llm.py` пуловый клиент** (`deepseek-v4-pro`
override), убрать ad-hoc `AsyncOpenAI` из `knowledge_assistant.py:77` (и по
возможности `legal_radar.py:47`). Streaming — опционально (реком. включить: `llm.py`
умеет `_stream_navy`, `ManyashaChat` имеет typing-индикатор).

---

## 3. API-контракт (новый/изменённый)
```
POST /knowledge-ai/conversations                 → создать беседу {id, title}
GET  /knowledge-ai/conversations                 → список бесед пользователя
GET  /knowledge-ai/conversations/{id}            → беседа + сообщения
POST /knowledge-ai/conversations/{id}/messages   → {message} → агентный ответ
       (стрим SSE или один ответ); пишет user+assistant(+tool) в БД
DELETE /knowledge-ai/conversations/{id}          → архивировать
GET  /knowledge-ai/radar...                      → без изменений
```
Старый `POST /knowledge-ai/ask` — оставить как тонкую обёртку над дефолтной беседой
(обратная совместимость) или удалить (**DECISION-C**, реком.: заменить на conversations).

Ответ сообщения: `{ message_id, content, used_chunks:[{id,category,law_article}],
radar_refs?, tool_trace?, conversation_id }`. Фронт показывает ответ + ссылки на
источники (как требует персона «со ссылками на источники»).

---

## 4. Фронт
- Вкладка «AI-помощник» → **чат Маняши** (переиспользовать UX `ManyashaChat`:
  маскот-видео-аватар, typing, пузыри, quick-questions из `POPULAR_QUESTIONS`,
  опц. TTS). Сообщения грузятся из беседы (серверная память), не sessionStorage.
- Список бесед (свернётся в «Новый диалог» + история бесед).
- Ответы рендерят **ссылки на источники** (used_chunks → клик открывает чанк в
  Справочнике).
- Плавающий `ManyashaChat` на `/knowledge` — скрыть (один экземпляр Маняши на странице).

---

## 5. Обработка ошибок / edge cases
- LLM/navy недоступен → graceful: сообщение «Маняша недоступна, попробуйте позже»,
  user-сообщение сохранено, assistant-сообщение помечено `failed` (не падаем).
- Reasoning-модель вернула пустой `content` → фолбэк на `reasoning_content`.
- Tool-цикл зациклился → лимит `MAX_STEPS`, затем финальный ответ из набранного контекста.
- RAG пусто → агент честно говорит, что в базе нет, предлагает Радар/переформулировку.
- Память: усечение контекста по бюджету токенов (окно 128K, `config.py:113`) —
  свежие ходы + RAG, старые суммаризировать или обрезать.
- **Не зависеть** от `KnowledgeQuizSession`/`knowledge_quiz` (quiz-подсистема — мусор).

## 6. Критерии готовности (DoD)
1. Вкладка «AI-помощник» = чат Маняши с лицом/персоной; многоходовый диалог реально
   помнит контекст (серверная память, проверка: задать уточняющий вопрос — учитывает
   предыдущий).
2. Агент использует tool-use (виден `used_chunks`/источники в ответе); ответы
   заземлены на RAG + Радар.
3. Лимиты сняты: длинный вход проходит, длинный ответ генерится, reasoning-фолбэк
   работает, rate-limit не режет нормальный диалог.
4. Провайдер = `deepseek-v4-pro` через `llm.py` пуловый клиент (retry/health).
5. Один экземпляр Маняши на `/knowledge`; источники кликабельны.
6. `app.main` импортируется, миграция `upgrade head` проходит, `tsc --noEmit` чисто,
   CI blocking зелёный, §1.

## 7. Приёмка качества (состязательная, `/ultracode`)
Скептики проверяют: (а) ответы юридически достоверны по ФЗ-127 (физлица), заземлены
на реальные чанки, без галлюцинаций; (б) память реально работает (мультиход); (в) нет
утечки в банкротство юрлиц; (г) деградация при падении navy. Прогон пачками →
зелёный валидатор + браузерная проверка.

## 8. Порядок + git §1
Ветка `claude/manyasha-agent`, ребейз на origin/main, коммит только своих файлов,
`git diff origin/main..HEAD --stat` перед push. Этапы: (1) миграция+модели памяти;
(2) агентный `ask` через llm.py + tools; (3) API conversations; (4) FE-чат;
(5) браузерная проверка. См. `/CLAUDE.md §1`.

## 9. Открытые DECISION (заказчику)
- **DECISION-A:** in-tab чат на `/knowledge` + скрыть плавающий (реком.) — или сделать плавающего Маняшу основным?
- **DECISION-B:** несколько именованных бесед (реком.) или одна rolling-нить?
- **DECISION-C:** заменить `POST /ask` на conversations (реком.) или оставить для совместимости?

## Ключевые файлы
`apps/web/src/app/knowledge/page.tsx`, `apps/web/src/components/ManyashaChat.tsx`,
`apps/web/src/components/layout/AuthLayout.tsx` (`:126`/`:302` mount),
`apps/api/app/api/knowledge_ai.py`, `apps/api/app/services/knowledge_assistant.py`
(`:37-39`,`:118-126`), `apps/api/app/services/rag_legal.py:505`,
`apps/api/app/services/legal_radar.py`, `apps/api/app/services/llm.py:432`,
`app/services/llm_tools.py`, `app/mcp/`, `apps/api/app/config.py`, `apps/api/.env`.
