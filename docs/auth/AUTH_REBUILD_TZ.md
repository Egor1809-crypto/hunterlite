# ТЗ: Перестройка авторизации под 149-ФЗ (Yandex ID + SMS)

> Статус: **в работе**. Дата: 2026-06-19.
> Решение владельца: метод входа — **Yandex ID + SMS** (плюс уже работающий
> собственный email/пароль). Google и любые иностранные OAuth — убрать.

Этот документ — единый источник правды по авторизации legalhunter.pro. Он
фиксирует (1) что уже сделано в PR удаления Google, (2) что осталось доделать
по Yandex ID, (3) полную реализацию SMS-входа, (4) требования ст.16 149-ФЗ,
(5) чек-лист «все поверхности входа, не только /login».

---

## 0. Контекст 149-ФЗ (зачем)

Иностранные провайдеры идентификации **запрещены**: Google, Apple, Facebook,
GitHub, Discord, Microsoft, Telegram Login Widget (зарегистрирован на BVI/Dubai).
**Разрешено:** собственный логин/пароль на своих серверах, SMS по российскому
номеру, российские OAuth (Yandex ID, VK ID, Сбер ID, Тинькофф ID, ВТБ ID,
Альфа ID).

Аудит кодовой базы (2026-06-19) показал: сторонних библиотек авторизации НЕТ
(Passport/NextAuth/Firebase/Auth0/Supabase — отсутствуют), всё на `httpx` +
`PyJWT` руками. Apple-упоминания — это PWA-манифест, НЕ Apple Sign-In.
Facebook/GitHub/Discord/MS/Telegram-widget — отсутствуют. Единственный
иностранный провайдер был Google — он удалён (см. §1).

---

## 1. УДАЛЕНО: Google OAuth (сделано в этом PR)

Удалены все точки интеграции Google (8 мест). Записано для аудита:

| Слой | Файл | Что сделано |
|---|---|---|
| Бэкенд | `apps/api/app/api/auth.py` | удалены `google_login`, `google_callback`; `oauth_status` отдаёт только `yandex`; `_oauth_find_or_create` → `User.yandex_id`; `disconnect` allow-list → `("yandex",)` |
| Конфиг | `apps/api/app/config.py` | удалены `google_client_id/secret/redirect_uri`, `google_oauth_configured`, validator → только `yandex_redirect_uri` |
| CSRF | `apps/api/app/main.py` | удалено исключение `/api/auth/google` |
| Модель | `apps/api/app/models/user.py` | колонка `google_id` помечена DEPRECATED, **оставлена** (не дропаем — чтобы не осиротить существующих Google-привязанных юзеров; колонка больше не читается/пишется) |
| Схема | `apps/api/app/schemas/auth.py` | поле `google_id` убрано из ответа |
| FE login | `apps/web/src/app/login/page.tsx` | удалена Google-кнопка, `oauthStatus` → `{ yandex }` |
| FE лендинг | `apps/web/src/components/landing/LandingLayout.tsx` | Google убран из `SSO_BUTTONS` (он рендерился **безусловно** на всех лендинг-страницах!) |
| FE sanitize | `apps/web/src/lib/sanitize.ts` | `accounts.google.com` убран из `ALLOWED_OAUTH_DOMAINS` |
| FE CSP | `apps/web/src/middleware.ts` | `accounts.google.com` убран из `connect-src`/`frame-src`/`form-action` |
| FE callback | `apps/web/src/app/auth/callback/page.tsx` | дефолт провайдера `google` → `yandex` |
| FE types | `apps/web/src/types/index.ts` | `google_id` убран |

**Остаточный хвост (не блокер, не runtime):**
- `apps/web/src/types/api.ts` — сгенерированный из OpenAPI; ещё содержит google-пути.
  Регенерировать командой `npm run types:gen` (нужен запущенный API) — это просто
  типы, не runtime-код, кнопок/скриптов/эндпоинтов Google не порождает.
- Колонку `google_id` можно дропнуть отдельной миграцией ПОСЛЕ проверки
  `SELECT count(*) FROM users WHERE google_id IS NOT NULL` на проде (если 0 —
  безопасно; если >0 — этим юзерам выдать reset-password перед дропом).
- `fonts.googleapis.com` в CSP — это **веб-шрифты** (Geist через `next/font/google`,
  self-hosted на билде), НЕ провайдер идентификации. Под 149-ФЗ (об OAuth) не
  подпадает. При желании «чистоты» — Geist уже самохостится, аллованс можно убрать.

---

## 2. Yandex ID — доделать (бэкенд УЖЕ реализован)

Бэкенд Yandex полностью готов: `yandex_login` / `yandex_callback` в
`apps/api/app/api/auth.py`, `_oauth_find_or_create`, колонка `User.yandex_id`,
кнопка на `/login` и лендинге.

> **СТАТУС 2026-06-19: ПОДКЛЮЧЕНО И ЖИВО.** Ключи владельца прописаны в
> `deployment/prod.env` (chmod 600), api пересоздан, провод проверен на проде:
> `/api/auth/oauth/status` → `{"yandex":true}`; `/api/auth/yandex/login` отдаёт
> корректный consent-URL (`oauth.yandex.ru/authorize`, верный `client_id`,
> redirect `legalhunter.pro/auth/callback`, есть `state`). Осталась только ручная
> проверка реального клика через согласие Yandex (нужен живой Yandex-аккаунт).

### 2.1 Что нужно от владельца (ВЫПОЛНЕНО)
1. Зарегистрировать приложение на https://oauth.yandex.ru/client/new:
   - Платформа: «Веб-сервисы».
   - **Redirect URI:** `https://legalhunter.pro/auth/callback` (ровно так — без `/api/`,
     заканчивается на `/auth/callback`; иначе validator в `config.py` не даст API стартовать).
   - Права доступа: `login:email`, `login:info` (имя + email).
2. Получить `client_id` и `client_secret`.

### 2.2 Что прописать в `deployment/prod.env` (на сервере, chmod 600)
```
YANDEX_CLIENT_ID=<client_id>
YANDEX_CLIENT_SECRET=<client_secret>
YANDEX_REDIRECT_URI=https://legalhunter.pro/auth/callback
```
После — пересобрать api: `docker compose ... up -d --build api`. Эндпоинт
`/api/auth/oauth/status` должен начать отдавать `{"yandex": true}`, и кнопка
«Yandex» появится на `/login`.

### 2.3 Доработка FE (мелочь)
- На лендинге (`LandingLayout.tsx`) Yandex-кнопка сейчас рендерится безусловно.
  Желательно гейтить её на `oauthStatus.yandex` (как на `/login`), чтобы до
  прописывания ключей она не показывала 501. **Объём:** добавить fetch
  `/auth/oauth/status` в `LandingLayout` и условие на кнопку. (Не блокер.)

### 2.4 Проверка (Definition of Done)
- [ ] `/login` показывает кнопку «Yandex», клик → редирект на `oauth.yandex.ru`.
- [ ] После согласия — возврат на `/auth/callback`, вход выполнен, редирект на `/home`.
- [ ] Существующий по email юзер — Yandex линкуется к тому же аккаунту (по email).
- [ ] Новый юзер — создаётся с `yandex_id`, без пароля, free-подписка.
- [ ] Отвязка: `POST /api/auth/yandex/disconnect` снимает `yandex_id`.

---

## 3. SMS-вход по номеру телефона (НОВОЕ — реализовать)

Самый «чистый» по 149-ФЗ метод (ноль внешних провайдеров идентификации; SMS-шлюз
— это транспорт, не identity-provider). В User-модели **поля `phone` НЕТ** — нужна
миграция.

### 3.1 Выбор SMS-провайдера (российский)
Кандидаты: **SMSC.ru**, SMS.ru, МТС Exolve, Beeline Business, Tele2 API.
Рекомендация: **SMSC.ru** (простой HTTP API, давно на рынке, дешёвый,
поддерживает «звонок-кодом» как фолбэк). От владельца нужен: логин/пароль API
(или API-ключ) + имя отправителя (alpha-name, требует модерации у оператора).

### 3.2 Миграция БД (Alembic)
Новая ревизия от текущей головы (`20260610_002`):
```python
# add_user_phone.py
def upgrade():
    op.add_column("users", sa.Column("phone", sa.String(20), nullable=True))
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
def downgrade():
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_column("users", "phone")
```
Модель `apps/api/app/models/user.py`: добавить
`phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)`.
Формат хранения — E.164 (`+79991234567`); нормализовать на входе.

### 3.3 Конфиг (`config.py`)
```python
sms_provider: str = "smsc"          # smsc | smsru | exolve | none
sms_login: str = ""
sms_password: str = ""              # или sms_api_key
sms_sender: str = "LegalHunter"     # alpha-name
@property
def sms_configured(self) -> bool: return bool(self.sms_login and self.sms_password)
```
Env: `SMS_LOGIN`, `SMS_PASSWORD`, `SMS_SENDER` в `prod.env`.

### 3.4 Сервис отправки (`apps/api/app/services/sms.py` — новый)
- `async def send_sms(phone: str, text: str) -> bool` — httpx POST к API провайдера.
- Если `not settings.sms_configured` — как SMTP-фолбэк: **писать код в лог**
  (dev-режим), возвращать True, чтобы поток не падал. Это зеркалит существующий
  паттерн `forgot_password` (см. `auth.py`).

### 3.5 Эндпоинты (`apps/api/app/api/auth.py`)
Переиспользовать Redis-паттерн из `forgot_password`/`reset_password` (код в
Redis с TTL, атомарный GET+DEL через Lua).

1. **`POST /api/auth/sms/request`** `{ phone }`
   - Нормализовать телефон → E.164. Валидация формата (RU `+7XXXXXXXXXX`).
   - Rate-limit: `@limiter.limit("3/minute")` + Redis-счётчик на номер (≤5/час),
     анти-абуз (SMS стоят денег).
   - Сгенерировать 6-значный код, положить `sms_code:{phone}` в Redis TTL 300с
     (хранить **хэш** кода, не plaintext — как reset-token).
   - `send_sms(phone, f"Код входа LegalHunter: {code}")`.
   - Ответ всегда 200 (анти-энумерация номеров), тело `{ "sent": true, "ttl": 300 }`.
2. **`POST /api/auth/sms/verify`** `{ phone, code }`
   - Атомарно достать+удалить `sms_code:{phone}`, сравнить хэш (constant-time).
   - Лимит попыток: ≤5 на код (Redis-счётчик `sms_attempts:{phone}`), иначе 429.
   - Найти/создать юзера по `phone` (аналог `_oauth_find_or_create`, но ключ —
     `User.phone`; email может быть пустым → генерить `phone_{digits}@sms.local`
     или оставить email NULL, если схема позволяет).
   - Выдать токены через `_create_tokens` + `_set_auth_cookies` (как везде).
   - Очистить blacklist (как в OAuth-потоке).
3. CSRF: добавить `/api/auth/sms` в `_CSRF_EXEMPT_PREFIXES` (`main.py`) — как
   login/register (это первичный вход, CSRF-кука ещё не выдана).

### 3.6 Frontend
- На `/login` и в лендинг-панели: вкладка/переключатель «Email | Телефон».
- Телефонный поток: поле номера → «Получить код» → поле 6-значного кода (с
  автофокусом, таймером повторной отправки 60с) → «Войти».
- Маска номера `+7 (XXX) XXX-XX-XX`. Ошибки/лимиты показывать дружелюбно.
- Файлы: `apps/web/src/app/login/page.tsx` (+ компонент `SmsLoginForm.tsx`),
  и тот же компонент в `LandingAuthContext`/`LandingLayout`.

### 3.7 Проверка (DoD)
- [ ] `POST /sms/request` шлёт SMS (или пишет код в лог без ключей), 200 всегда.
- [ ] Неверный код → 4xx; >5 попыток → 429; код живёт ровно 300с.
- [ ] Верный код → вход, кука выставлена, редирект `/home`.
- [ ] Повторный запрос ≤5/час на номер; rate-limit отрабатывает (тест `asyncio.gather`).
- [ ] Новый юзер по телефону создаётся; повторный вход находит того же.
- [ ] Миграция `alembic upgrade head` проходит на чистой PG.

---

## 4. Требования ст.16 149-ФЗ к собственной авторизации — статус

Аудит подтвердил соответствие (оставить как есть, не регрессировать):
- **HTTPS-only:** куки `secure` в prod (`app_env=="production"`), HSTS/CSP в `middleware.ts`. ✅
- **Хэширование паролей:** bcrypt (`security.py`), min 8 символов. ✅ (argon2 не требуется.)
- **Журналирование входов:** структурные логи `auth.login.success/failed/locked`
  с email+IP, Redis-локаут 5 ошибок/15мин. ✅
  - **Доработка (рекомендация):** логи идут в stdout. Для регулятора может
    потребоваться **персистентный журнал в БД** (таблица `auth_audit_log`:
    user_id, event, ip, ua, ts). Сейчас есть мёртвая `analytics_events` — можно
    переиспользовать или завести явную. Низкий приоритет, но заложить.
- **Без ограничения «только иностранный email»:** регистрация принимает любой
  валидный email. ✅ (требование выполнено — ограничения нет.)

---

## 5. Чек-лист «ВСЕ поверхности входа» (РКН проверяет не только /login)

Проверить отсутствие иностранных OAuth-кнопок/скриптов/эндпоинтов на КАЖДОЙ:
- [ ] `/login`
- [ ] `/register`
- [ ] Лендинг: `/`, `/product`, `/pricing` (встроенная панель входа/регистрации
      через `LandingAuthContext` — именно тут Google рендерился безусловно!)
- [ ] `/reset-password`, `/change-password`
- [ ] `/auth/callback`
- [ ] Любые модалки «войдите, чтобы…» (комментарии/отзывы/checkout — если появятся)

Инструменты самопроверки: DevTools → Network → фильтр XHR при загрузке формы
входа (не должно быть обращений к `accounts.google.com`, `appleid.apple.com`,
`graph.facebook.com`, `github.com/login/oauth`, `discord.com/api/oauth2`,
`telegram.org/js/telegram-widget.js`); сканер scanbase.ru.

---

## 6. Порядок работ

1. **PR-1 (этот):** удалить Google (сделано) + эти ТЗ. Деплой → compliance закрыт.
2. **PR-2:** Yandex — гейт кнопки на лендинге + (владелец) ключи в prod.env.
3. **PR-3:** SMS — миграция `phone` + сервис + 2 эндпоинта + FE-форма + тесты
   (rate-limit и verify — в blocking-scope, с `asyncio.gather`).
4. Владелец: ключи Yandex OAuth + SMS-провайдера; alpha-name на модерацию.
