#!/usr/bin/env python3
"""Import legal knowledge chunks from production CSV export.

Usage:
    cd apps/api
    .venv/bin/python -m scripts.import_prod_chunks /tmp/prod_chunks_clean.csv

Skips chunks that already exist (by content_hash match).
Uses psycopg2 (sync) directly to avoid asyncpg array encoding issues.
"""
import csv
import hashlib
import json
import sys
import uuid
from pathlib import Path


def parse_pg_array(val: str) -> list:
    """Parse PostgreSQL array literal like {a,b,c} or JSON array."""
    if not val or val in ("[]", "{}", ""):
        return []
    val = val.strip()
    if val.startswith("["):
        try:
            return json.loads(val)
        except json.JSONDecodeError:
            return []
    if val.startswith("{") and val.endswith("}"):
        inner = val[1:-1]
        if not inner:
            return []
        # Handle quoted elements
        items = []
        in_quote = False
        current = ""
        for ch in inner:
            if ch == '"' and not in_quote:
                in_quote = True
            elif ch == '"' and in_quote:
                in_quote = False
            elif ch == "," and not in_quote:
                items.append(current.strip().strip('"'))
                current = ""
            else:
                current += ch
        if current:
            items.append(current.strip().strip('"'))
        return items
    return [val]


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/prod_chunks_clean.csv"

    if not Path(csv_path).exists():
        print(f"ERROR: {csv_path} not found")
        sys.exit(1)

    # Read CSV
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Read {len(rows)} rows from CSV")

    # Use psycopg2 directly — avoids asyncpg array encoding headaches
    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(
        host="localhost",
        port=5432,
        dbname="trainer_db",
        user="trainer",
        password="trainer_pass",
    )
    conn.autocommit = False
    cur = conn.cursor()

    # Get existing content hashes
    cur.execute("SELECT content_hash FROM legal_knowledge_chunks WHERE is_active = true AND content_hash IS NOT NULL")
    existing_hashes = {r[0] for r in cur.fetchall()}
    print(f"Existing chunks in DB: {len(existing_hashes)}")

    # Also get existing fact_text to dedup by content
    cur.execute("SELECT fact_text FROM legal_knowledge_chunks WHERE is_active = true")
    existing_texts = {r[0] for r in cur.fetchall()}

    inserted = 0
    skipped = 0
    for row in rows:
        fact_text = row.get("fact_text", "").strip()
        if not fact_text or len(fact_text) < 20:
            skipped += 1
            continue

        # Skip test/debug data
        if any(marker in fact_text for marker in ["PR2-", "VERIFY", "TEST-", "DEBUG"]):
            skipped += 1
            continue

        content_hash = row.get("content_hash", "").strip()
        if not content_hash:
            content_hash = hashlib.sha256(fact_text.encode()).hexdigest()[:16]

        # Skip if already exists
        if content_hash in existing_hashes or fact_text in existing_texts:
            skipped += 1
            continue

        category = row.get("category", "").strip()
        law_article = row.get("law_article", "").strip() or None
        common_errors = parse_pg_array(row.get("common_errors", ""))
        match_keywords = parse_pg_array(row.get("match_keywords", ""))
        correct_response_hint = row.get("correct_response_hint", "").strip() or None
        difficulty_level = int(row.get("difficulty_level", 3) or 3)
        question_templates = parse_pg_array(row.get("question_templates", ""))
        follow_up_questions = parse_pg_array(row.get("follow_up_questions", ""))
        blitz_question = row.get("blitz_question", "").strip() or None
        blitz_answer = row.get("blitz_answer", "").strip() or None

        choices_raw = row.get("choices", "").strip()
        choices = None
        if choices_raw and choices_raw not in ("", "{}"):
            try:
                choices = json.loads(choices_raw) if choices_raw.startswith("[") else None
            except json.JSONDecodeError:
                choices = None

        correct_choice_index_raw = row.get("correct_choice_index", "").strip()
        correct_choice_index = int(correct_choice_index_raw) if correct_choice_index_raw and correct_choice_index_raw.isdigit() else None

        chunk_id = str(uuid.uuid4())

        # All array/jsonb columns need to be JSON strings for PostgreSQL jsonb type
        def to_jsonb(val):
            if val is None:
                return None
            return json.dumps(val, ensure_ascii=False)

        cur.execute(
            """
            INSERT INTO legal_knowledge_chunks (
                id, category, fact_text, law_article, common_errors,
                match_keywords, correct_response_hint, difficulty_level,
                question_templates, follow_up_questions,
                blitz_question, blitz_answer, choices, correct_choice_index,
                content_hash, is_active, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s::jsonb,
                %s::jsonb, %s, %s,
                %s::jsonb, %s::jsonb,
                %s, %s, %s::jsonb, %s,
                %s, true, NOW(), NOW()
            )
            """,
            (
                chunk_id,
                category,
                fact_text,
                law_article,
                to_jsonb(common_errors),
                to_jsonb(match_keywords),
                correct_response_hint,
                difficulty_level,
                to_jsonb(question_templates),
                to_jsonb(follow_up_questions),
                blitz_question,
                blitz_answer,
                to_jsonb(choices),
                correct_choice_index,
                content_hash,
            ),
        )
        existing_hashes.add(content_hash)
        existing_texts.add(fact_text)
        inserted += 1

    conn.commit()
    print(f"\nDone! Inserted: {inserted}, Skipped (duplicates/invalid): {skipped}")

    # Final count
    cur.execute("SELECT COUNT(*) FROM legal_knowledge_chunks WHERE is_active = true")
    total = cur.fetchone()[0]
    print(f"Total active chunks now: {total}")

    # Per-category breakdown
    cur.execute("""
        SELECT category, COUNT(*)
        FROM legal_knowledge_chunks
        WHERE is_active = true
        GROUP BY category
        ORDER BY COUNT(*) DESC
    """)
    print("\nPer-category breakdown:")
    for cat, cnt in cur.fetchall():
        print(f"  {cat}: {cnt}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
