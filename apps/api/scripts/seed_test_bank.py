"""Seed the dedicated legal TEST bank (test_blocks / test_questions /
test_answers / question_tags) from the bundled JSON.

This is the question bank the knowledge quiz (`/pvp/quiz`, the «карта тестов»)
actually wants: `app.services.knowledge_quiz._generate_question_from_test_db`
prefers these tables and only falls back to generating questions from the RAG
knowledge-base chunks when they are absent. The bank (63 blocks / 1500
questions / 4500 answers) was authored separately and never imported into
HunterLite, so the quiz silently ran on the knowledge base instead.

Idempotent: creates the tables if missing and skips the load when the bank is
already present (>= expected question count). Run standalone:

    python -m scripts.seed_test_bank          # load if missing
    python -m scripts.seed_test_bank --force  # truncate + reload
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
from pathlib import Path

from sqlalchemy import text

from app.database import async_session

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).parent / "test_bank_data" / "all_questions.json"
EXPECTED_QUESTIONS = 1500

_DDL = """
CREATE TABLE IF NOT EXISTS test_blocks (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level IN (1,2)),
    order_index INTEGER NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS test_questions (
    id INTEGER PRIMARY KEY,
    block_id INTEGER NOT NULL REFERENCES test_blocks(id),
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner','intermediate','advanced','expert')),
    question_text TEXT NOT NULL,
    explanation TEXT NOT NULL,
    legal_reference TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_text)
);
CREATE TABLE IF NOT EXISTS test_answers (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES test_questions(id),
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INTEGER NOT NULL CHECK (order_index IN (1,2,3)),
    UNIQUE(question_id, order_index)
);
CREATE TABLE IF NOT EXISTS question_tags (
    question_id INTEGER NOT NULL REFERENCES test_questions(id),
    tag TEXT NOT NULL,
    PRIMARY KEY (question_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_questions_block ON test_questions(block_id);
CREATE INDEX IF NOT EXISTS idx_questions_category ON test_questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON test_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_answers_question ON test_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON question_tags(tag);
"""


async def seed(force: bool = False) -> None:
    if not DATA_FILE.exists():
        logger.error("seed_test_bank: %s not found", DATA_FILE)
        return
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    blocks = data["blocks"]
    questions = data["questions"]
    answers = data["answers"]
    tags = data.get("tags", [])

    async with async_session() as db:
        # DDL is split because some drivers reject multi-statement strings.
        for stmt in (s.strip() for s in _DDL.split(";")):
            if stmt:
                await db.execute(text(stmt))
        await db.commit()

        existing = (await db.execute(text("SELECT count(*) FROM test_questions"))).scalar() or 0
        if existing >= EXPECTED_QUESTIONS and not force:
            logger.info("seed_test_bank: already present (%d questions) — skipping", existing)
            print(f"seed_test_bank: already present ({existing} questions) — skipping")
            return

        await db.execute(text(
            "TRUNCATE question_tags, test_answers, test_questions, test_blocks RESTART IDENTITY CASCADE"
        ))
        await db.execute(
            text("INSERT INTO test_blocks (id,title,description,level,order_index) "
                 "VALUES (:id,:title,:description,:level,:order_index)"),
            [{"id": b["id"], "title": b["title"], "description": b["description"],
              "level": b["level"], "order_index": b["order_index"]} for b in blocks],
        )
        await db.execute(
            text("INSERT INTO test_questions (id,block_id,category,difficulty,question_text,explanation,legal_reference) "
                 "VALUES (:id,:block_id,:category,:difficulty,:question_text,:explanation,:legal_reference)"),
            [{"id": q["id"], "block_id": q["block_id"], "category": q["category"],
              "difficulty": q["difficulty"], "question_text": q["question_text"],
              "explanation": q["explanation"], "legal_reference": q.get("legal_reference")}
             for q in questions],
        )
        await db.execute(
            text("INSERT INTO test_answers (question_id,answer_text,is_correct,order_index) "
                 "VALUES (:question_id,:answer_text,:is_correct,:order_index)"),
            [{"question_id": a["question_id"], "answer_text": a["answer_text"],
              "is_correct": bool(a.get("is_correct")), "order_index": a["order_index"]} for a in answers],
        )
        if tags:
            await db.execute(
                text("INSERT INTO question_tags (question_id,tag) VALUES (:question_id,:tag) "
                     "ON CONFLICT DO NOTHING"),
                [{"question_id": t["question_id"], "tag": t["tag"]} for t in tags],
            )
        await db.commit()
        msg = f"seed_test_bank: loaded {len(blocks)} blocks, {len(questions)} questions, {len(answers)} answers, {len(tags)} tags"
        logger.info(msg)
        print(msg)


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    await seed(force="--force" in sys.argv)


if __name__ == "__main__":
    asyncio.run(main())
