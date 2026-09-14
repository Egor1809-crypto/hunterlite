# Production deploy — legalhunter.pro

The tracked `docs/deploy/docker-compose.prod.yml` is the production configuration.
Run it directly with the private `deployment/prod.env` and `deployment/release.env`.
The old ignored `deployment/docker-compose.prod.yml` is a historical copy only.
Do not build images on this shared VM or use mutable `latest` for deployment.

## Topology

Shared VM `msk-1-vm-cqax` (`72.56.38.62`) hosting several projects behind a
**host nginx** that owns :80/:443. This stack therefore does **not** run Caddy.

- Code: `/opt/legalhunter` (clone of `origin/main`).
- Compose: `docs/deploy/docker-compose.prod.yml` (project `legalhunter`), env in
  `deployment/prod.env` (chmod 600, **never** committed — see `prod.env.example`).
- Services: `postgres` (**pgvector/pgvector:pg16** — schema needs the `vector`
  extension), `redis` (password required), `api` → `127.0.0.1:8300`, `web` →
  `127.0.0.1:3300`, `bot` (Telegram long-polling). All `restart: unless-stopped`.
- Host nginx vhost: `/etc/nginx/sites-available/legalhunter.pro` (reference copy
  `nginx-legalhunter.pro.conf`). Routing: `/api/chat`,`/api/tts`→web;
  `/api/`,`/ws/`→api (ws upgrade); else→web. TLS via `certbot --nginx`.

## Releases and deployment

Source history is GitHub `main` + reviewed PRs. CI publishes API/web images tagged
with the full commit SHA. API and bot use the same image. `release.env` records
`RELEASE_SHA`, `API_IMAGE_REF` and `WEB_IMAGE_REF`; prefer `repository@sha256:digest`
for the two image references. Keep previous release manifests under
`deployment/releases/`. A database dump is a separate artifact, not a code version.

1. Merge the PR and wait for **all main CI**, including security and Docker.
2. SSH, run `hostname` first (must be `msk-1-vm-cqax`), then
   `git -C /opt/legalhunter pull --ff-only origin main`.
3. Pull `ghcr.io/egor1809-crypto/hunterlite/{api,web}:<full-main-SHA>`;
   resolve their repository digests with `docker image inspect`. Archive the
   previous private release manifest, then atomically write `deployment/release.env`
   with the new SHA and both immutable references (mode 600).
4. Run `python3 /opt/legalhunter/ops/backup.py` before changing containers.
5. Deploy from `/opt/legalhunter`:

```bash
docker compose --env-file deployment/prod.env --env-file deployment/release.env \
  -f docs/deploy/docker-compose.prod.yml config --quiet
docker compose --env-file deployment/prod.env --env-file deployment/release.env \
  -f docs/deploy/docker-compose.prod.yml up -d --no-build --pull never api web bot
curl -fsS https://legalhunter.pro/api/version
```

Verify the reported SHA, login/error handling, public pages and bot polling. Never
restart PostgreSQL/Redis during a routine app deployment. For infrastructure
configuration changes, back up first and recreate only the affected own services.
Keep current + previous API/web images locally; also retain every image referenced
by any container. Delete only explicit unused LegalHunter image references, never
`docker system prune`, volume pruning, or shared-cache pruning without attribution.
Rollback source changes through a revert PR, main CI and normal pull/deploy. Record
all deployed service digests before and after a release.

## Persistent data and backups

- PostgreSQL: `legalhunter_pg_data`; Redis: `legalhunter_redis_data`.
- API uploads: `/opt/legalhunter/deployment/uploads` mounted on `/app/uploads`.
  Before first migration, stop the API briefly, copy **its** `/app/uploads/.`
  with `docker cp -a` into that directory, compare file hashes and preserve the
  `appuser` numeric ownership. Never mount an empty directory over existing data.
- Install `ops/legalhunter-backup.cron` as `/etc/cron.d/legalhunter-backup` (644).
  Daily at 02:17 host time (Europe/Moscow). The script takes a custom PostgreSQL
  dump, uploads archive, private environment copies and image manifest; validates
  the dump table of contents, then atomically publishes the bundle. Exit status
  and last error are in `deployment/backup-{status.json,error.log}`.
- Keep 14 successful daily bundles. Manual/pre-release dumps are never pruned.
  Files and directories are private (600/700). These are **on-server copies**:
  an off-host destination is still needed to survive loss of this VM.
- Restore drill: create a uniquely named disposable database **inside our
  PostgreSQL**, run `pg_restore --exit-on-error --no-owner`, compare table counts
  with the backup source, then drop only that disposable database. Never restore
  into the live database for a test. Verify uploads archive hashes too.

## Shared-host resource budget

Two API workers use at most `2 × (10 + 10) = 40` DB connections, bot `2 + 3 = 5`,
leaving room below PostgreSQL's 100 for administration and migrations. Pools open
connections on demand, so this fixes peak capacity rather than promising lower
idle RAM. Container memory ceilings: API 1536 MiB, web/bot/Postgres 512 MiB each,
Redis 128 MiB (64 MiB Redis data limit, `noeviction` to preserve locks/auth keys).
These ceilings are guardrails, not preallocated memory. Logs use Docker's rotating
`local` driver, 3 × 10 MiB per service. Builds run in GitHub Actions, with separate
API/web cache scopes and reproducible web installation via `npm ci`.

References: [Docker log rotation](https://docs.docker.com/engine/logging/drivers/local/),
[SQLAlchemy pool limits](https://docs.sqlalchemy.org/en/20/core/pooling.html).

## First-time / fresh-DB content seed

The api entrypoint only runs migrations + `seed_db` + `seed_levels`, and the
lifespan seeds the 375-chunk expanded legal seed **only if the table is empty**.
The portable content must be seeded explicitly (idempotent):

```bash
docker compose ... exec -T api python -m scripts.seed_all          # test bank (1500 Q), cases, exam Q, radar, personas, demo progress
docker compose ... exec -T api python -m scripts.seed_championship # championship #1 + prize_fund (photos)
# Canonical 624-chunk knowledge base (with embeddings). seed_knowledge_chunks
# dedups by id only and collides with the lifespan seed's content_hash, so on a
# fresh DB load it onto an EMPTY table:
docker exec legalhunter-postgres-1 psql -U legalhunter -d legalhunter -c "DELETE FROM legal_knowledge_chunks;"
docker compose ... exec -T api python -m scripts.seed_knowledge_chunks
```

## Telegram bot (@BFLHUNTER_bot) — RU egress

The host **cannot reach `api.telegram.org`** (RU blocks it, both directions →
webhooks don't arrive). Solution: **long-polling** via a Bot-API IP pin.

- `extra_hosts: ["api.telegram.org:149.154.167.220"]` on the `api`+`bot`
  services (the default IP 149.154.166.110 is blocked; 149.154.167.220 is
  reachable). If it ever stops working, find a new one:
  `curl --resolve api.telegram.org:443:<ip> https://api.telegram.org/bot<token>/getMe`.
- The `bot` service runs `python -m scripts.run_bot_polling` (single instance:
  concurrent getUpdates is rejected). The `api` service's `TELEGRAM_BOT_TOKEN`
  is intentionally empty so it doesn't set the (dead) webhook.
- `TELEGRAM_PROXY` (http/socks5) is an alternative to the IP pin if needed.
