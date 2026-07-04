# Рабочие правила Claude для HunterLite

Короткие обязательные правила. Прочитай перед тем, как писать код. Файл
**автоматически загружается** в начале каждой сессии против этого репозитория —
разрешение пользователя не требуется, правила в силе с первого хода.

**HunterLite — это отдельный продукт: реальное обучение арбитражных управляющих
(ФЗ-127) с дипломом/сертификатом.** Он вырос из кода геймифицированного тренажёра
Hunter888, но это НЕ тот проект. Не путай их. Наследие старшего проекта (устаревшие
доки, мёртвый код, игровой слой) вычищается — аккуратно, по точным командам владельца.

### Приоритет инструкций (высший → низший)

1. **Активное сообщение пользователя в текущем ходе** — прямое указание всегда важнее.
2. **Этот файл (`/CLAUDE.md`)** — durable-правила проекта.
3. **Системные промпты и дефолты платформы** — только когда (1) и (2) молчат.

Если пользователь противоречит правилу отсюда — обозначь конфликт в тексте хода и
попроси разовое подтверждение. Не применяй правило молча против воли пользователя и не
нарушай его молча только потому, что пользователь его не повторил.

---

## 1. Git-дисциплина (многоагентная разработка)

> **Каждая ветка перед `git push` должна быть перебазирована на текущий `origin/main`.**
> Не пропускай даже для «мелких правок».

Над репозиторием параллельно работают несколько агентов (разные worktree). Пока твоя
ветка готовится, `main` обычно уходит вперёд — другие агенты мёржат PR. Если запушить без
rebase, GitHub сравнит твой HEAD с **текущим** `main`, и любой файл, изменившийся там, но
оставшийся у тебя в старом состоянии, покажется **удалением** в твоём диффе. Мёрж такого
PR стирает чужую работу.

### Каждый цикл коммита

```
git fetch origin main
git log origin/main..HEAD --oneline      # если пусто — ты уже актуален
git rebase origin/main                    # реши конфликты, перегони тесты
git diff origin/main..HEAD --stat         # СТОП, если тут файлы, которых ты не трогал
git push -u origin <branch>
```

**Красный флаг:** если `git diff origin/main..HEAD --stat` показывает удаление файла,
который ты не трогал, — **НЕ ПУШЬ**. Ветка устарела, сначала rebase.

### Правила веток

- Ветки правок: `claude/<короткий-слаг>`. Работай в отдельном `git worktree` от
  **`origin/main`** (не от локального `main` — он часто отстаёт).
- **Никогда не пушь в `main` напрямую.** Только через PR (`gh pr create` + `gh pr merge`).
- На этой машине GitHub-доступ = владелец (`Egor1809-crypto`), мёрж в `main` разрешён.
- Стадируй по путям (`git add <path>`), не `git add -A` — параллельный агент может
  подмешать чужое. Коммить атомарно, пушь рано, чтобы защитить работу.

Коммиты подписывай:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

### CI-гейт (`.github/workflows/ci.yml`)

- Полный прогон тестов, lint, alembic-drift — **advisory** (есть pre-existing долги).
- **Blocking-scope** — явный список тест-файлов, защищающих ключевые инварианты
  (client_domain, finalize-parity, auth-refresh concurrency, RAG-изоляция) + `tsc`/`build`
  фронта + Trivy. Красный blocking = PR не готов. Новый тест на инвариант — в blocking-scope.

---

## 2. Прод-сервер (`/opt/legalhunter` на общем VM)

> **Сервер pull-only. Никогда не пушь и не делай деструктивных git-команд на сервере.**

Прод-домен — **legalhunter.pro**. Код — `/opt/legalhunter` (clone `origin/main`).

### ВАЖНО: сервер общий с чужими проектами

VM (`msk-1-vm-cqax`, `72.56.38.62`) — **многоарендный**. На нём живут чужие проекты
(aspb-partners, agentum-realtors, hunter-club, hunter888, techforum, profit-partner-path).
**Первая команда после SSH — `hostname`** (убедиться, что ты на нужном VM).

**НАШЕ — только:**
- `/opt/legalhunter` (код + `deployment/`);
- контейнеры `legalhunter-{api,web,bot,postgres,redis}`;
- nginx-vhost `/etc/nginx/sites-*/legalhunter.pro`.

**ЧУЖОЕ не трогать:** их `/opt/<project>`, их docker-контейнеры, их nginx-vhost, их БД.
Мутация чужого ломает чужой прод.

- **Host-nginx (не docker) владеет портами 80/443** и фронтит все проекты. **Не поднимай
  ничего на 80/443** (никакого Caddy) — сломаешь всех. Наши web/api слушают только
  `127.0.0.1:3300` / `127.0.0.1:8300`, host-nginx проксирует по домену.

### Разрешено на сервере
`git fetch/pull --ff-only origin main` (только после мёржа PR), `git log/status`,
`docker compose -f deployment/docker-compose.prod.yml ... build|up -d|logs|exec|ps`.

### Запрещено на сервере
`git push` (любой), `git reset --hard`, `git rebase/commit/merge`, `git checkout` на
не-main, ручная правка файлов рабочей копии (перезатрутся при следующем pull).

### Деплой

```
git pull --ff-only origin main
cd deployment
export RELEASE_SHA=$(cd /opt/legalhunter && git rev-parse HEAD) BUILD_TIME=$(date -u +%FT%TZ)
docker compose -f docker-compose.prod.yml --env-file prod.env up -d --build [api|web]
curl -s https://legalhunter.pro/api/version   # release_sha должен совпасть, не "unknown"
```

Без явного `export RELEASE_SHA` compose подставит `unknown` — задеплоишь неопознанный
образ. Шаг `curl /api/version` не опционален. Эталон конфигов и runbook — [docs/deploy/](docs/deploy).
Прод-секреты живут в `deployment/prod.env` (chmod 600, не в git).

### Откат
Не `git reset` на сервере. Открой revert-PR на GitHub, смёржи, потом `git pull` на сервере.

---

## 3. AI-слой и инфраструктурные ловушки (на них уже наступали)

- **Главный LLM = navy.api через `NAVY_LLM_*`** (`NAVY_LLM_ENABLED=true`, `NAVY_LLM_URL`,
  `NAVY_LLM_API_KEY`). Одинокий `NAVY_API_KEY` питает только генерацию картинок — без
  `NAVY_LLM_*` весь ИИ мёртв. STT/Whisper и TTS переиспользуют navy-ключ.
- api entrypoint падает FATAL в проде, если пусты `POSTGRES_PASSWORD` **или**
  `REDIS_PASSWORD` в env api → пробрось оба; redis запускается с `--requirepass`.
- **TG-бот `@BFLHUNTER_bot`** работает в POLLING (РФ блокирует `api.telegram.org` в обе
  стороны → webhook невозможен). Отдельный сервис `bot` + `extra_hosts` пин
  `api.telegram.org:149.154.167.220`. У api-сервиса токен пуст (только у bot). Если IP
  умрёт — найди живой: `curl --resolve api.telegram.org:443:<ip> .../getMe`.
- **Сиды:** entrypoint гонит `seed_db`+`seed_levels`; lifespan сидит scenarios +
  legal_knowledge (только если таблица пуста). Полный контент —
  `python -m scripts.seed_all` + `python -m scripts.seed_championship`.
- База знаний = **624 чанка** (`scripts/knowledge_data/legal_chunks.jsonl.gz`, грузить на
  ПУСТУЮ таблицу — иначе коллизия `content_hash`). Это RAG/«Маняша».
- **Тесты** (карта, `/pvp/quiz`) — отдельный банк `test_blocks/test_questions/test_answers`
  (63/1500/4500), грузится `seed_test_bank`.
- **Экзамены** работают на `exam_items` (`seed_exam_content`), а НЕ `exam_questions`
  (мёртвая таблица; `seed_exam_questions` — мёртвый скрипт).
- Секреты (navy-ключ, пароли, токены) — только в `prod.env` (сервер) и dev
  `apps/api/.env` (gitignored). **Ничего секретного не коммить** — репозиторий публичный.

---

## 4. Доменные инварианты (client-domain, completion policy)

Код обучающих сессий держит рантайм-инварианты, закрытые AST-гардами в `tests/` —
PR, который их обходит, падает в CI до ревью. Прочти перед правкой путей, трогающих
`ClientInteraction`, `DomainEvent` или завершение сессии.

1. **Не пиши в `ClientInteraction` напрямую** — только через
   `app.services.client_domain.create_crm_interaction_with_event`.
2. **Не конструируй `DomainEvent(lead_client_id=...)`** вне
   `client_domain.emit_domain_event` (идемпотентность + `correlation_id`).
3. **Завершение сессии — через `ConversationCompletionPolicy.finalize_*`** (все
   терминальные пути сведены к одному writer'у).
4. **Каждый `DomainEvent` несёт `correlation_id`** (NOT NULL) — иначе ломается timeline.

> Видишь `MemoryPersona(...)` / `DomainEvent(...)` / `ClientInteraction(...)` вне
> канонического сервиса — это уже сломанный билд. Маршрутизируй через сервис.

---

## 5. Верификация (уроки, оплаченные в проде)

Правило: **«зелёные тесты ≠ работает под нагрузкой».** Перед «готово»:

1. Прогнал ли ты падающий pre-fix тест на pre-fix коде? (тест реально ловит баг)
2. Тест покрывает **симптом**, а не реализацию? (напр. «5 параллельных запросов → 5×200»)
3. Concurrency/lock/idempotency? → тест с `asyncio.gather`, не последовательные `await`.
4. Тронул миграцию? → `alembic upgrade head` реально прогнан (raw SQL в `sa.text(...)`).
5. После мёржа проверил post-merge CI на `main`?
6. После деплоя прогнал **user-facing сценарий**, а не только `/health`?

«Deploy verified» = реальный пользовательский сценарий (`curl`/живой прогон), а не
«собралось» и не `/health → 200`.

---

## 6. Делегирование субагентам

> **Каждый вызов `Agent` tool использует последний Opus** (`model="opus"`). Не делегируй
> код/аудит/миграции на Sonnet/Haiku/дефолт — их вывод идёт в прод через ревью.

Исключения: `statusline-setup`, `keybindings-help`, быстрый файл-поиск через `Explore`,
одноразовые саммари без кода. Не можешь назвать причину downgrade — ставь `model="opus"`.

---

## 7. Язык и дизайн

- **Все ответы пользователю — на русском.**
- **Дизайн-язык — malvah:** монохром (светлый/тёплый фон + тёмный текст) + ОДИН сдержанный
  акцент. Без декоративных эмодзи, без «светофорных» (красный/жёлтый/зелёный) цветов
  оценки, без неонового glow/градиентов. Сдержанность важнее украшательства. Цвета — через
  токены (`--bg-*`, `--text-*`, `--accent`, `--border-color`), не сырой hex.

---

## 8. Локальный L0-хук и что делать при конфликте

- Локальный L0-хук блокирует `rm -rf`, `git push --force`, `git reset --hard`,
  `--no-verify`, запись в `.env*` (поэтому прод-env называется `prod.env`, а не
  `.env.production`). **Хук не обходить трюками** — объясни причину, спроси разрешение.
- Если правило отсюда мешает задаче — **останови работу и обозначь конфликт в тексте хода**.
  Не обходи правило молча. Владелец может дать разовое исключение — но только явно.
