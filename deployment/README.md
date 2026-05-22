# HUNTERLITE Production Deploy

This folder contains the production Docker setup:

- `docker-compose.prod.yml` runs PostgreSQL, API and Nginx web containers.
- `Dockerfile.api` runs Prisma migrations and starts the API.
- `Dockerfile.web` builds the Vite frontend and serves it through Nginx.
- `nginx.app.conf` serves the SPA, proxies `/api/*`, supports SSE notifications and exposes `/health`.
- `backup-db.sh` creates gzip PostgreSQL backups in `deployment/backups`.

## First Run

```sh
cd deployment
cp .env.production.example .env.production
```

Edit `.env.production` and set real values before deployment:

- `POSTGRES_PASSWORD`: long random database password.
- `CORS_ORIGINS`: production frontend origin, for example `https://hunterlite.example.com`.
- `HUNTERLITE_CSRF_SECRET`: at least 32 random characters; use 64+ characters in production.
- `NAVI_API_KEY`: production API key.
- `NAVI_CHAT_MODEL`, `NAVI_TTS_MODEL`, `NAVI_TTS_VOICE`, `NAVI_STT_MODEL`: keep the approved production models unless you intentionally change the provider config.

Use `PRODUCTION_ENV_CHECKLIST.md` for the full domain, HTTPS, database and smoke-check list.

```sh
sh deploy-prod.sh
```

## Backup

```sh
sh backup-db.sh
```

## Health Checks

```sh
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl http://127.0.0.1/health
curl http://127.0.0.1/api/health
```
