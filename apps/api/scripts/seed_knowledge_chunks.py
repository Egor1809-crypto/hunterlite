"""Portable seed for the legal knowledge base (legal_knowledge_chunks).

Проблема, которую решает скрипт: контент базы знаний (624 чанка ФЗ-127 с
embedding'ами) жил ТОЛЬКО в локальной БД — в репозитории его не было
(прежний import_prod_chunks.py тянул из /tmp/*.csv, которого нет на других
машинах). Из-за этого на другом ПК в базе оказывалась лишь часть статей.

Теперь канонические чанки лежат в репозитории в
``scripts/knowledge_data/legal_chunks.jsonl.gz`` (вместе с embedding'ами),
и любой ПК получает РОВНО тот же набор одной командой.

Использование:
    cd apps/api
    # засеять недостающие чанки из репозитория (идемпотентно, FK-safe):
    uv run python -m scripts.seed_knowledge_chunks
    # пересоздать файл-выгрузку из текущей локальной БД (для мейнтейнера):
    uv run python -m scripts.seed_knowledge_chunks export

Сид идемпотентный: вставляются только чанки, которых ещё нет (по id).
Существующие НЕ трогаются — поэтому безопасно при наличии FK
(chunk_usage_logs, rag_chunk_links, quiz_v2_answer_keys и т.д.).
"""
from __future__ import annotations

import asyncio
import gzip
import json
import logging
import sys
import uuid
from pathlib import Path

from sqlalchemy import select

from app.database import async_session
from app.models.rag import LegalCategory, LegalKnowledgeChunk

logger = logging.getLogger(__name__)

DATA_FILE = Path(__file__).parent / "knowledge_data" / "legal_chunks.jsonl.gz"

# Контентные поля, которые переносятся между машинами. Волатильную статистику
# (retrieval_count, effectiveness, last_used_at) и аудит (created_by, reviewed_*)
# сознательно НЕ экспортируем — они машинно-локальны и не нужны для RAG/показа.
CONTENT_FIELDS = [
    "category", "fact_text", "law_article", "common_errors", "match_keywords",
    "correct_response_hint", "error_frequency", "difficulty_level",
    "question_templates", "follow_up_questions", "related_chunk_ids",
    "court_case_reference", "is_court_practice", "blitz_question", "blitz_answer",
    "source_article_full_text", "content_version", "knowledge_status",
    "status_reason", "embedding_model", "tags", "content_hash", "is_active",
    "choices", "correct_choice_index", "source_type", "title", "jurisdiction",
    "source_ref",
]
VECTOR_FIELDS = ["embedding", "embedding_v2", "embedding_v2_model"]


def _to_jsonable(value):
    """Сериализуемое представление значения колонки."""
    if value is None:
        return None
    if isinstance(value, LegalCategory):
        return value.value
    if isinstance(value, uuid.UUID):
        return str(value)
    # pgvector возвращает list/np.ndarray — приводим к list[float]
    if hasattr(value, "tolist"):
        return [float(x) for x in value.tolist()]
    if isinstance(value, (list, tuple)):
        return list(value)
    return value


async def export() -> None:
    """Выгрузить все чанки из локальной БД в репозиторный файл (gzip JSONL)."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    async with async_session() as session:
        rows = (await session.execute(select(LegalKnowledgeChunk))).scalars().all()
        n = 0
        with gzip.open(DATA_FILE, "wt", encoding="utf-8") as f:
            for c in rows:
                rec = {"id": str(c.id)}
                for field in CONTENT_FIELDS + VECTOR_FIELDS:
                    rec[field] = _to_jsonable(getattr(c, field))
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
                n += 1
        logger.info("Exported %d chunks → %s", n, DATA_FILE)
        print(f"Exported {n} chunks → {DATA_FILE}")


async def seed() -> None:
    """Идемпотентно вставить недостающие чанки из репозиторного файла."""
    if not DATA_FILE.exists():
        print(f"ERROR: {DATA_FILE} не найден. Сначала: python -m scripts.seed_knowledge_chunks export")
        sys.exit(1)

    records: list[dict] = []
    with gzip.open(DATA_FILE, "rt", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))

    async with async_session() as session:
        existing = set(
            str(x) for x in (await session.execute(select(LegalKnowledgeChunk.id))).scalars().all()
        )
        inserted = 0
        for rec in records:
            if rec["id"] in existing:
                continue
            kwargs = {"id": uuid.UUID(rec["id"])}
            for field in CONTENT_FIELDS:
                val = rec.get(field)
                if field == "category" and val is not None:
                    val = LegalCategory(val)
                kwargs[field] = val
            kwargs["embedding"] = rec.get("embedding")
            kwargs["embedding_v2"] = rec.get("embedding_v2")
            kwargs["embedding_v2_model"] = rec.get("embedding_v2_model")
            session.add(LegalKnowledgeChunk(**kwargs))
            inserted += 1

        await session.commit()
        total = (await session.execute(select(LegalKnowledgeChunk.id))).scalars().all()
        msg = f"Seeded: +{inserted} новых, итого в БД {len(total)} чанков (в файле {len(records)})"
        logger.info(msg)
        print(msg)


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    mode = sys.argv[1] if len(sys.argv) > 1 else "seed"
    if mode == "export":
        await export()
    else:
        await seed()


if __name__ == "__main__":
    asyncio.run(main())
