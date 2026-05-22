# Production Env Checklist

Before running `sh deploy-prod.sh`, create `deployment/.env.production` from `.env.production.example` and replace every placeholder.

## Required Values

- `POSTGRES_PASSWORD`: long random password for the production database.
- `CORS_ORIGINS`: public frontend origin, for example `https://hunterlite.example.com`.
- `HUNTERLITE_CSRF_SECRET`: at least 32 random characters, preferably 64+.
- `NAVI_API_KEY`: production external API key.
- `NAVI_CHAT_MODEL`: `gemini-3.5-flash`.
- `NAVI_TTS_MODEL`: `eleven_flash_v2_5`.
- `NAVI_TTS_VOICE`: approved production voice id.
- `NAVI_STT_MODEL`: approved production STT model.

## Domain And HTTPS

- Point the production domain DNS record to the server.
- Terminate HTTPS in front of the compose stack, or add TLS to the host Nginx.
- Keep `CORS_ORIGINS` equal to the final HTTPS origin.
- Do not expose the API container directly to the internet; route `/api/*` through Nginx.

## Database And Migrations

- Confirm the PostgreSQL volume is persistent.
- Confirm `deployment/backups` exists and is writable.
- API container runs Prisma migrations during startup through `deployment/Dockerfile.api`.
- After deployment, check `docker compose --env-file .env.production -f docker-compose.prod.yml ps`.

## Smoke Checks

```sh
curl http://127.0.0.1/health
curl http://127.0.0.1/api/health
```

Then verify in the browser:

- Login opens and demo shortcuts are absent.
- Dashboard loads.
- Call training opens and sends one answer.
- Voice response plays when browser autoplay permits it.
- Notifications page loads.
