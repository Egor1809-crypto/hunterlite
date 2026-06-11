"""Unified content seeder — one command to populate a fresh machine.

Runs every *content* seeder the product needs (knowledge-base chunks, cases,
exam questions, legal-radar updates, level/achievement definitions) in one go,
each isolated so one failure does not abort the rest. Idempotent: every
underlying seeder upserts / skips existing rows, so re-running is safe.

Usage (from apps/api, with the project venv):

    python -m scripts.seed_all

Note: base data (users / teams / scenarios / lorebook / expanded legal
knowledge) is auto-seeded on API startup via the lifespan hook in app.main.
This script covers the repo-portable content datasets that you want on a new
machine without booting the API. Run `alembic upgrade head` first so the
tables exist.
"""
import asyncio
import time

# Each entry: (human label, coroutine factory). Order is independent — these
# tables have no cross-FKs — but we keep a stable, readable sequence.
from scripts.seed_knowledge_chunks import seed as seed_chunks
from scripts.seed_cases import seed as seed_cases
from scripts.seed_exam_questions import seed as seed_exams
from scripts.seed_legal_updates import seed as seed_radar
from scripts.seed_levels import seed_levels_and_achievements as seed_levels
from scripts.seed_reference_persona import seed as seed_reference_persona
from scripts.seed_demo_progress import seed as seed_demo_progress
from scripts.seed_test_bank import seed as seed_test_bank

STEPS = [
    ("Knowledge-base chunks (RAG)", seed_chunks),
    ("Test bank (карта тестов: 63 blocks / 1500 questions)", seed_test_bank),
    ("Cases (БФЛ)", seed_cases),
    ("Exam questions", seed_exams),
    ("Legal radar updates", seed_radar),
    ("Levels & achievements", seed_levels),
    ("Reference persona (конструктор)", seed_reference_persona),
    # Demo accounts must exist first (seeded on API startup); no-ops otherwise.
    ("Demo region-1 progress (unlocks конструктор)", seed_demo_progress),
]


async def seed_all() -> int:
    """Run every content seeder; return the number of FAILED steps."""
    print("=== seed_all: populating portable content datasets ===")
    failed = 0
    for label, fn in STEPS:
        started = time.monotonic()
        print(f"\n→ {label} …")
        try:
            await fn()
            print(f"  ✓ {label} done in {time.monotonic() - started:.1f}s")
        except Exception as exc:  # isolate: one bad seeder must not kill the rest
            failed += 1
            print(f"  ✗ {label} FAILED: {exc!r}")
    total = len(STEPS)
    print(f"\n=== seed_all complete: {total - failed}/{total} ok, {failed} failed ===")
    return failed


if __name__ == "__main__":
    raise SystemExit(asyncio.run(seed_all()))
