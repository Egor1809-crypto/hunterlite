#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ ! -f .env.production ]; then
  echo "Missing deployment/.env.production. Create it from .env.production.example first." >&2
  exit 1
fi

mkdir -p backups

docker compose --env-file .env.production -f docker-compose.prod.yml pull postgres
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
