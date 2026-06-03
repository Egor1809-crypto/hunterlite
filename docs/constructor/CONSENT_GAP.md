# Product gap: no consent-acceptance UI on the frontend

## Symptom

Training start (`POST /training/sessions`) is gated by
`check_consent_accepted` (`apps/api/app/api/consent.py`). That dependency
returns **403** unless the user has an accepted `UserConsent` row for every
entry in `REQUIRED_CONSENTS` (currently a single
`personal_data_processing` / version `1.0`).

## Root cause

The backend exposes two consent endpoints:

- `GET /consent/status` — read-only check of what is accepted / missing.
- `POST /consent/` — records acceptance (`accepted=True`).

The frontend **only ever calls `GET /consent/status`**. There is **no UI
that calls `POST /consent/`** anywhere in `apps/web`. So a freshly
registered, non-demo user can never satisfy `check_consent_accepted` and
is permanently stuck with a 403 at training start (and, before the
`api.ts` `.clone()` fix, that 403 was masked as a generic
"Request failed").

## Temporary mitigation (this change)

`apps/api/scripts/seed_db.py` now seeds an **accepted**
`personal_data_processing` consent for every demo account, idempotently,
alongside the demo users it already creates. The required-consent list in
the seeder mirrors `app.api.consent.REQUIRED_CONSENTS`.

This unblocks **demo logins on a fresh DB only**. It does nothing for real
users.

## Outstanding product work (not done here)

Build a consent-acceptance screen in `apps/web` that:

1. On post-login / pre-training, calls `GET /consent/status`.
2. If `all_accepted` is false, renders the consent document(s) listed in
   `missing` and a clear accept action.
3. On accept, calls `POST /consent/` with `{ consent_type, version }` for
   each missing consent.
4. Re-checks status and lets the user proceed.

Until that ships, only seeded demo accounts can start trainings.
