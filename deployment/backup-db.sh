#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if [ ! -f .env.production ]; then
  echo "Missing deployment/.env.production. Create it from .env.production.example first." >&2
  exit 1
fi

set -a
. ./.env.production
set +a

mkdir -p backups
backup_file="backups/hunterlite-$(date +%Y%m%d-%H%M%S).sql.gz"

docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-hunterlite}" "${POSTGRES_DB:-hunterlite}" | gzip > "$backup_file"

echo "Backup written to $backup_file"
