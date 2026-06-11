# Production deploy — legalhunter.pro

Reference for the live deployment. The **canonical live copy** lives on the
server at `/opt/legalhunter/deployment/` (the `deployment/` dir is gitignored so
`git pull` on the server never conflicts). Keep this `docs/deploy/` copy in sync
when the server config changes.

## Topology

Shared VM `msk-1-vm-cqax` (`72.56.38.62`) hosting several projects behind a
**host nginx** that owns :80/:443. This stack therefore does **not** run Caddy.

- Code: `/opt/legalhunter` (clone of `origin/main`).
- Compose: `deployment/docker-compose.prod.yml` (project `legalhunter`), env in
  `deployment/prod.env` (chmod 600, **never** committed — see `prod.env.example`).
- Services: `postgres` (**pgvector/pgvector:pg16** — schema needs the `vector`
  extension), `redis` (password required), `api` → `127.0.0.1:8300`, `web` →
  `127.0.0.1:3300`, `bot` (Telegram long-polling). All `restart: unless-stopped`.
- Host nginx vhost: `/etc/nginx/sites-available/legalhunter.pro` (reference copy
  `nginx-legalhunter.pro.conf`). Routing: `/api/chat`,`/api/tts`→web;
  `/api/`,`/ws/`→api (ws upgrade); else→web. TLS via `certbot --nginx`.

## Deploy

```bash
ssh root@72.56.38.62
cd /opt/legalhunter
git pull --ff-only origin main
cd deployment
export RELEASE_SHA=$(cd /opt/legalhunter && git rev-parse HEAD) BUILD_TIME=$(date -u +%FT%TZ)
docker compose -f docker-compose.prod.yml --env-file prod.env up -d --build
curl -s https://legalhunter.pro/api/version   # release_sha must match
```

## First-time / fresh-DB content seed

The api entrypoint only runs migrations + `seed_db` + `seed_levels`, and the
lifespan seeds the 375-chunk expanded legal seed **only if the table is empty**.
The portable content must be seeded explicitly (idempotent):

```bash
docker compose ... exec -T api python -m scripts.seed_all          # cases, exam Q, radar, personas, demo progress
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
