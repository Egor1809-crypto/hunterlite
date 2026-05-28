"""Legal Radar — periodic fetching and AI-generation of bankruptcy law updates."""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone

import httpx
import openai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models.legal_update import LegalUpdate

logger = logging.getLogger(__name__)

_MODEL = os.getenv("KNOWLEDGE_AI_MODEL", "deepseek-v4-pro")
_UPDATE_INTERVAL = int(os.getenv("RADAR_UPDATE_INTERVAL_HOURS", "12")) * 3600

RSS_SOURCES = [
    ("https://www.consultant.ru/rss/hotdocs.xml", "КонсультантПлюс"),
    ("https://www.garant.ru/rss/", "Гарант"),
    ("https://vsrf.ru/press_center/news/rss", "Верховный Суд РФ"),
]

AI_GENERATION_PROMPT = """Ты — юридический аналитик, специализирующийся на банкротном праве РФ (ФЗ-127).

Сгенерируй 5-7 актуальных новостей/обновлений в сфере банкротного права за последний месяц.

Для каждой новости укажи:
1. title — заголовок (50-100 символов)
2. summary — краткое описание (2-3 предложения, ~150 символов)
3. source — источник ("ВС РФ", "КонсультантПлюс", "Гарант", "АС МО", "ФНС", "Минэкономразвития")
4. category — одна из: "Практика ВС", "Изменения ФЗ", "Постановления Пленума", "Обзоры практики", "Разъяснения ФНС", "Арбитражная практика"
5. relevance_score — от 0.0 до 1.0, насколько важно для арбитражного управляющего
6. tags — список тегов (2-4 штуки)
7. published_date — дата в формате YYYY-MM-DD (за последний месяц)

Ответ строго в JSON формате — массив объектов. Без markdown, без комментариев.
Фокус: субсидиарная ответственность, оспаривание сделок, торги, банкротство физлиц, реестр кредиторов."""


def _get_ai_client() -> openai.AsyncOpenAI:
    return openai.AsyncOpenAI(
        base_url=settings.local_llm_url,
        api_key=settings.local_llm_api_key,
    )


async def _try_rss_sources() -> list[dict]:
    results: list[dict] = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
        for url, source_name in RSS_SOURCES:
            try:
                resp = await client.get(url, follow_redirects=True)
                if resp.status_code != 200:
                    continue
                items = _parse_rss_items(resp.text, source_name)
                results.extend(items)
            except Exception:
                logger.debug("RSS source %s unavailable", url)
    return results


def _parse_rss_items(xml_text: str, source_name: str) -> list[dict]:
    items: list[dict] = []
    import re
    bankruptcy_keywords = [
        "банкрот", "127-фз", "фз-127", "несостоятельност",
        "арбитражн", "кредитор", "должник", "конкурсн",
        "субсидиарн", "реестр требований", "торги", "реализаци",
        "оспаривание сделок", "61.2", "61.3", "61.10", "61.11",
    ]
    for match in re.finditer(r"<item>(.*?)</item>", xml_text, re.DOTALL):
        block = match.group(1)
        title_m = re.search(r"<title><!\[CDATA\[(.*?)\]\]></title>|<title>(.*?)</title>", block, re.DOTALL)
        desc_m = re.search(r"<description><!\[CDATA\[(.*?)\]\]></description>|<description>(.*?)</description>", block, re.DOTALL)
        link_m = re.search(r"<link>(.*?)</link>", block)
        date_m = re.search(r"<pubDate>(.*?)</pubDate>", block)

        title = (title_m.group(1) or title_m.group(2) or "").strip() if title_m else ""
        description = (desc_m.group(1) or desc_m.group(2) or "").strip() if desc_m else ""
        link = link_m.group(1).strip() if link_m else None

        combined = (title + " " + description).lower()
        is_relevant = any(kw in combined for kw in bankruptcy_keywords)
        if not is_relevant:
            continue

        relevance = sum(1 for kw in bankruptcy_keywords if kw in combined) / len(bankruptcy_keywords)
        relevance = min(relevance * 3, 1.0)

        items.append({
            "title": title[:500],
            "summary": description[:1000] if description else title,
            "source": source_name,
            "source_url": link,
            "category": _guess_category(combined),
            "relevance_score": round(relevance, 2),
            "tags": _extract_tags(combined),
            "is_ai_generated": False,
        })
    return items


def _guess_category(text: str) -> str:
    if any(w in text for w in ["пленум", "постановление пленума"]):
        return "Постановления Пленума"
    if any(w in text for w in ["обзор практики", "обзор судебной"]):
        return "Обзоры практики"
    if any(w in text for w in ["фнс", "налог", "разъяснен"]):
        return "Разъяснения ФНС"
    if any(w in text for w in ["верховн", "вс рф", "определение вс"]):
        return "Практика ВС"
    if any(w in text for w in ["изменен", "закон", "поправк", "фз-127", "127-фз"]):
        return "Изменения ФЗ"
    return "Арбитражная практика"


def _extract_tags(text: str) -> list[str]:
    tag_map = {
        "субсидиарн": "субсидиарная ответственность",
        "оспаривание сделок": "оспаривание сделок",
        "61.2": "ст.61.2",
        "61.3": "ст.61.3",
        "торги": "торги",
        "банкротство физ": "банкротство физлиц",
        "реестр": "реестр кредиторов",
        "кдл": "КДЛ",
        "конкурсн": "конкурсное производство",
        "реструктуризац": "реструктуризация",
    }
    tags = []
    for keyword, tag in tag_map.items():
        if keyword in text and tag not in tags:
            tags.append(tag)
    return tags[:4]


async def _ai_generate_updates() -> list[dict]:
    client = _get_ai_client()
    try:
        response = await client.chat.completions.create(
            model=_MODEL,
            messages=[
                {"role": "system", "content": "Отвечай строго в JSON формате. Без markdown."},
                {"role": "user", "content": AI_GENERATION_PROMPT},
            ],
            max_tokens=3000,
            temperature=0.4,
        )
        raw = response.choices[0].message.content or "[]"
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        items = json.loads(raw)
        if not isinstance(items, list):
            return []

        results = []
        for item in items:
            results.append({
                "title": str(item.get("title", ""))[:500],
                "summary": str(item.get("summary", ""))[:1000],
                "source": str(item.get("source", "AI"))[:100],
                "source_url": None,
                "category": str(item.get("category", "Арбитражная практика"))[:100],
                "relevance_score": min(max(float(item.get("relevance_score", 0.5)), 0.0), 1.0),
                "tags": item.get("tags", [])[:4],
                "is_ai_generated": True,
                "published_date": item.get("published_date"),
            })
        return results
    except Exception:
        logger.exception("AI generation of legal updates failed")
        return []


async def _save_updates(db: AsyncSession, updates: list[dict]) -> int:
    saved = 0
    for u in updates:
        existing = await db.execute(
            select(LegalUpdate).where(
                LegalUpdate.title == u["title"],
                LegalUpdate.source == u["source"],
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue

        published_at = datetime.now(timezone.utc)
        if u.get("published_date"):
            try:
                published_at = datetime.strptime(
                    u["published_date"], "%Y-%m-%d"
                ).replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                pass

        record = LegalUpdate(
            id=uuid.uuid4(),
            title=u["title"],
            summary=u["summary"],
            source=u["source"],
            source_url=u.get("source_url"),
            category=u["category"],
            relevance_score=u.get("relevance_score", 0.5),
            published_at=published_at,
            fetched_at=datetime.now(timezone.utc),
            is_ai_generated=u.get("is_ai_generated", False),
            tags=u.get("tags", []),
            is_active=True,
        )
        db.add(record)
        saved += 1

    if saved:
        await db.commit()
    return saved


async def fetch_updates(db: AsyncSession) -> int:
    updates = await _try_rss_sources()

    if not updates:
        updates = await _ai_generate_updates()

    relevant = [u for u in updates if u.get("relevance_score", 0) > 0.3]

    if not relevant:
        logger.info("Legal radar: no relevant updates found")
        return 0

    saved = await _save_updates(db, relevant)
    logger.info("Legal radar: saved %d new updates (from %d candidates)", saved, len(relevant))
    return saved


async def radar_update_loop() -> None:
    logger.info("Legal radar update loop started (interval=%ds)", _UPDATE_INTERVAL)
    while True:
        lock_acquired = False
        try:
            from app.core.redis_pool import get_redis
            r = get_redis()
            lock_acquired = await r.set(
                "legal_radar:run_lock", "1", nx=True, ex=300,
            )
        except Exception:
            logger.debug("Legal radar Redis lock unavailable, proceeding anyway")
            lock_acquired = True

        if lock_acquired:
            try:
                async with async_session() as db:
                    await fetch_updates(db)
            except Exception:
                logger.exception("Legal radar update loop error")
        else:
            logger.debug("Legal radar skipped: another worker holds the lock")

        await asyncio.sleep(_UPDATE_INTERVAL)
