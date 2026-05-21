# Блок 3. Backend-основание

Цель блока: подготовить основу backend-части модульного монолита, чтобы дальше можно было подключить PostgreSQL, миграции, auth, protected routes и API для frontend.

## Что сделано

- Создана папка `apps/api`.
- Заложен единый формат API-ответов.
- Заложен env-конфиг backend-приложения.
- Зафиксирован список backend-модулей.
- Добавлен health contract для будущего `/api/health`.
- Подключена Prisma-схема для PostgreSQL.
- Добавлена initial migration.
- Добавлен seed-скрипт для demo-данных.
- Добавлен Docker Compose для локального PostgreSQL.
- Добавлены npm-скрипты для работы с базой.
- Добавлены unit-тесты для проверки backend-фундамента.

## Инструменты блока

- **TypeScript** — единый язык для frontend и backend.
- **Zod** — валидация env-конфига и будущих входных данных API.
- **PostgreSQL** — выбранная основная реляционная база данных.
- **Prisma** — ORM, миграции, генерация типизированного клиента и seed.
- **Docker Compose** — локальный PostgreSQL для разработки.
- **Vitest** — unit-тесты контрактов backend-основания.
- **ESLint** — проверка качества кода.

## Почему пока не NestJS

На этом шаге мы не подключаем тяжелый backend-фреймворк, чтобы не смешивать две задачи:

1. Зафиксировать архитектуру, модули и контракты.
2. Затем выбрать и подключить runtime-фреймворк.

Целевой вариант для production: **NestJS** или легкий HTTP-runtime на TypeScript. Для HUNTERLITE логичнее двигаться к NestJS, потому что у нас будут модули, роли, guards, middleware, services и repositories.

## Структура

```text
apps/api
  src
    config
      env.ts
    health
      health-contract.ts
    http
      api-response.ts
    modules
      module-registry.ts
    index.ts
prisma
  schema.prisma
  seed.mjs
  migrations
    000_init
      migration.sql
infra
  docker-compose.yml
```

## Backend-модули первой версии

- `auth` — вход, logout, OAuth, сессии, согласия.
- `users` — пользователи, профиль, статусы.
- `organizations` — компании, настройки организации.
- `roles` — роли и права доступа.
- `trainings` — тренировки, темы, сообщения, слабые темы.
- `exams` — экзамены, попытки, статусы допуска.
- `notifications` — уведомления и статусы прочтения.
- `admin` — админка, настройки, аудит.
- `analytics` — отчеты и динамика.
- `ai` — AI-клиент, разбор ответов, будущий RAG.

## Единый формат API-ответов

Успешный ответ:

```ts
{
  ok: true,
  data: { ... },
  meta?: { ... }
}
```

Ошибка:

```ts
{
  ok: false,
  error: {
    code: "UNAUTHORIZED",
    message: "Authentication required",
    details?: { ... }
  }
}
```

## Env-переменные первой версии

- `NODE_ENV` — development, test, production.
- `API_PORT` — порт backend.
- `DATABASE_URL` — строка подключения PostgreSQL.
- `SESSION_COOKIE_NAME` — имя session cookie.
- `CORS_ORIGINS` — whitelist frontend origins.

## Что делать следующим шагом

- Запустить Docker Desktop.
- Выполнить `npm run db:up`.
- Выполнить `npm run db:migrate`.
- Выполнить `npm run db:seed`.
- После этого переходить к Блоку 4: auth и безопасные сессии.

## Команды блока

```bash
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
npm run db:down
```

## Статус локальной БД

Prisma schema validation и Prisma Client generation проходят успешно.

Миграция создана как SQL-файл через `prisma migrate diff`, потому что Docker daemon на текущей машине в момент настройки не был запущен. Когда Docker Desktop будет запущен, миграцию можно применить командой `npm run db:migrate`.
