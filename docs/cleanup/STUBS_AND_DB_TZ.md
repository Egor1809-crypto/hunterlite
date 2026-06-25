# ТЗ: Чистка заглушек + нормализация БД

> Статус: **план**. Дата: 2026-06-19. Источник — аудит кодовой базы 2026-06-19.
> Принцип: **ничего не дропать на проде без проверки `SELECT count(*)`**. Удаления
> идут тирами по возрастанию риска. Tier-1 безопасен и делается сразу.

---

## ЧАСТЬ A — ЗАГЛУШКИ

### A.1 Видимые пользователю (решение: реализовать / честно пометить / убрать)

| # | Где | Что видит пользователь | Действие |
|---|---|---|---|
| 1 | `apps/web/src/app/(landing)/pricing/page.tsx` | `/pricing` = «свяжитесь с нами» вместо тарифов (реальные тарифы — на лендинге) | редирект `/pricing → /#pricing` ИЛИ вынести реальные тарифы сюда |
| 2 | `apps/web/src/app/(landing)/page.tsx:490-534` | Кнопка платного тарифа «Эксперт» (120 000 ₽) → нет оплаты; сноска «оплата скоро» | блокировано платежами (см. A.3); пока — честная формулировка + TG-контакт |
| 3 | `apps/web/src/app/(landing)/page.tsx:53-66,356` | Бегущая строка «12 направлений в разработке» — 12 непостроенных фич | решение владельца: оставить как roadmap (честно помечено) или убрать |
| 4 | `apps/api/app/api/training_map.py:119-131` | Выдача попыток через TG-бота **бесплатно** (платежи не подключены) | блокировано платежами |

### A.2 Хардкод маркетинговых чисел (проверить, не «заглушка»)
`(landing)/page.tsx:15-22` — «18 000+ юристов», «17 000+ процедур», «11 лет»,
«800+ партнёров», «80+ специалистов»; `product/page.tsx` — «100+ архетипов»,
«60+ сценариев». Это копирайт. **Действие:** владелец подтверждает цифры (юр-риск
недостоверной рекламы) — оставляем как статinclude или выносим в CMS-конфиг.

### A.3 Интеграции: заглушка vs реальность

| Интеграция | Статус | Граница |
|---|---|---|
| **Платежи (ЮKassa/Stripe)** | **кода нет совсем**, только `config.py:781-793` | требует полной реализации: клиент провайдера + роут + webhook + запись в `subscription` |
| OAuth (Yandex) | реален, нужны ключи | см. AUTH_REBUILD_TZ §2 |
| SMTP | реален; без ключей пишет ссылку в лог (`auth.py`) | нужны ключи |
| `course_schedule.py:19` | `COURSE_DRIP_START = 2026-04-02` — хардкод «Placeholder for the real launch» | обновить дату старта дрипа под реальный запуск сезона |

### A.4 Внутренние/мёртвые заглушки — Tier-1 (удалить сразу, 0 импортеров)

| Файл | Примечание |
|---|---|
| `apps/web/src/components/ui/Confetti.tsx` | `return null`, нет импортеров |
| `apps/web/src/components/training/BootSequence.tsx` | `return null`, нет импортеров |
| `apps/web/src/components/ui/ScreenShake.tsx` | стаб, не используется |
| `apps/api/app/services/quiz_v2/answer_keys.py:70` | `NotImplementedError`, 0 вызовов, флаг `quiz_v2_grader_enabled=False` |
| `apps/api/app/services/quiz_v2/events.py:51` | `NotImplementedError`, 0 вызовов |
| `apps/api/app/services/lorebook.py:5` | `return ""` на sync-def, `await`-ится → `TypeError` глотается; префикс lorebook молча не применяется. **Починить или удалить** |

> Примечание: задача из памяти «кнопка Позвонить» — **не заглушка**: звонок
> полностью реализован (`/training/[id]/call/page.tsx`, 336 строк). Стаб-кнопки в
> коде нет — задача в MEMORY не соответствует коду.

---

## ЧАСТЬ B — НОРМАЛИЗАЦИЯ БД

Масштаб: ~140 таблиц, 56 model-файлов. **Одна alembic-голова** (`20260610_002`) —
схема деплоится. Косметическая аномалия: 2 базы (`reviews_use_deleted` имеет
`down_revision=None`, но не initial; пере-привязан следующей миграцией — `upgrade
head` работает).

### B.1 Tier-1 — без миграций (удалить файлы dead-code)
FE: `Confetti.tsx`, `BootSequence.tsx`, `ScreenShake.tsx`.
BE: `quiz_v2/answer_keys.py` + `events.py` (скелеты `NotImplementedError`),
починить `lorebook.py`.

### B.2 Tier-2 — DROP TABLE миграция (СНАЧАЛА `SELECT count(*)` на проде!)
Мёртвые целиком (0 ссылок в коде + 0 сидов):
- **Целые model-файлы:** `models/emotion.py` (EmotionTransition, ArchetypeEmotionConfig,
  FakeTransitionDef, EmotionSessionLog), `models/traps.py` (TrapDefinition,
  ObjectionChainDef, ChainStep, TrapCascadeDef, CascadeLevel, TrapSessionLog —
  legacy, заменены на `roleplay.Trap`/`roleplay.ObjectionChain`).
- **Orphan-таблицы:** `manager_kpi_targets`, `call_records`, `session_reports`,
  `leaderboard_snapshots`, `progress_leaderboard_snapshots`, `client_consents`,
  `cross_recommendation_cache`, `objections` (в character.py), `couple_voice_profiles`,
  `script_embeddings`, `analytics_events`, `team_quiz_teams`, `knowledge_answer_reports`,
  `quiz_v2_answer_keys`, `emotion_profiles`, `trap_cascades`, `personality_profiles`.

**Risk-gate (обязательно):** для каждой `SELECT count(*)` на проде. Если есть
исторические строки, которые жалко — экспортировать перед дропом. Дроп — одной
**reversible** миграцией, модели удалить в том же PR. ⚠️ `analytics_events` —
проверить, не планируется ли под персистентный auth-журнал (см. AUTH_REBUILD §4).

### B.3 Tier-3 — нужно решение, НЕ дропать сейчас
- **`exam_questions`** — НЕ трогать. Сознательный `mcq`-bridge (DECISION-A,
  `exam.py:170`), ещё сидится `seed_exam_questions` (в `seed_all.py:25`). Сначала
  убедиться, что bridge реально не нужен, отвязать сид — потом думать о дропе.
- **Achievement split-brain (реальный долг):** `analytics.Achievement`/`UserAchievement`
  (каноничный движок) vs `progress.AchievementDefinition`/`EarnedAchievement`
  (вторичный). `hunter_score.py` читает **обе**. Консолидировать в одну (миграция
  + репойнт `hunter_score.py`), это не дроп.
- **`persona_snapshots`** (singular) — legacy, read-only хвост в `history.py`,
  живого писателя нет. Каноника: `MemoryPersona` + `SessionPersonaSnapshot`.
- `reviews_use_deleted` 2-я база — пере-укоренить на реального родителя 2026-04-23.
  Косметика, делать вместе с другой alembic-работой.

### B.4 Tier-4 — РИСК, блокировано продуктовым решением
**PvP-таблицы** (`pvp_ratings`, `pvp_duels`, `pvp_anti_cheat_logs`, `user_fingerprints`,
`ap_purchases`) — живые и **вплетены в скоринг** (`pvp_ratings` в 8 файлах:
`hunter_score.py`, `manager_progress.py`, `weekly_report.py` и др.). По памяти PvP —
«срезаемый» слой, НО резать нужно **из сервис-слоя** (распутать call-sites), а не
из БД. ⚠️ Любой дроп PvP-таблиц — только после распутывания скоринга. Флагнуть
владельцу до начала.

### B.5 Не дубликаты (НЕ трогать — активны)
`Character`/`CustomCharacter`/`ReferencePersona` (3 разных концепта); `XPLog`
(legacy-аудит) vs `XPEvent` (happy-hour); TZ-1 CRM-стек (RealClient → LeadClient →
ClientInteraction через DomainEvent → Outbox/projector — событийный дизайн);
`correlation_id` `nullable=False` (инвариант §3.4 соблюдён, НЕ дефект).

---

## Порядок
1. **PR-Tier1:** удалить FE/BE dead-code (B.1) — без миграций, 0 риска.
2. **PR-Tier2:** после `count(*)`-проверки на проде — reversible DROP-миграция (B.2).
3. Tier-3/4 — отдельные продуктовые решения и миграции, каждая со своим risk-gate.
4. Платежи — отдельный крупный эпик (не «чистка», а реализация).
