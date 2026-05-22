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

Edit `.env.production` and set real passwords, domain/CORS origin and NAVI API key.

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
