"""Strict AI grader for free-text exam items (case_analysis / document_drafting /
multi_step).

Modelled on ``warmup_grader.py`` but with three deliberate differences mandated
by docs/exam/EXAM_TZ.md §4:

  1. Model is ``settings.exam_model`` (deepseek-v4-pro) via the navy proxy.
  2. There is **no "this is a warm-up, be lenient" instruction.** The exam is
     certifiable — the grader judges strictly against the item's rubric.
  3. RAG grounding: the relevant legal chunks are injected so the grader scores
     against real ФЗ-127 (физлица) practice instead of hallucinated norms.

Contract:
    grade_item(...) -> ExamGrade | None

Returns ``None`` on ANY failure (navy down, timeout, rate-limit, unparseable
JSON). The caller MUST treat ``None`` as "grading_pending": do not finalize the
attempt, do not issue a certificate, allow a regrade. This is the safe-
degradation requirement (§4, §7): a missing grade never silently becomes a 0
that hands the user a pass/fail it didn't earn.

Determinism: results are cached in Redis under
    exam:grade:v1:{sha1(model|item_id|normalized_answer)}
so the same (item, answer) pair always yields the same score — required for
fair appeals (§5, §7). A regrade/appeal calls ``invalidate_cache`` first to
force a fresh judgement.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

_CACHE_PREFIX = "exam:grade:v1:"
_CACHE_TTL_SECONDS = 30 * 24 * 3600  # 30 days — certifiable, longer than warmup

# deepseek reasoning over a full case analysis can be slower than the warmup
# one-liner grade; give it room before falling back to grading_pending.
_REQUEST_TIMEOUT = 60.0

# deepseek-v4-pro is a REASONING model: its hidden reasoning tokens count
# against the completion budget BEFORE the visible JSON is emitted. A tight
# budget (e.g. 700) is fully consumed by reasoning on a long case analysis and
# the model returns an EMPTY content string — which we'd misread as a grading
# failure. Give it enough headroom for reasoning + the JSON verdict.
_MAX_TOKENS = 3000

# Strict legal-examiner system prompt. No leniency clause.
_SYSTEM_PROMPT = (
    "Ты — строгий экзаменатор по банкротству ФИЗИЧЕСКИХ ЛИЦ (ФЗ-127). "
    "Оцениваешь письменный ответ обучающегося на сертификационном экзамене — "
    "НЕ разминка, снисхождения нет. Оценивай СТРОГО по рубрике: за каждый "
    "ключевой пункт начисляй его вес только если он раскрыт по существу и "
    "юридически корректно. Грубая юридическая ошибка или выдуманная норма — "
    "это НЕ раскрытый пункт, даже если тема упомянута.\n"
    "Пересказ формулировки рубрики или простое перечисление статей БЕЗ "
    "применения к фабуле дела НЕ засчитывается как раскрытие — требуется "
    "юридический анализ применительно к условию.\n"
    "Пункты, помеченные [обязательный], критичны: если хотя бы один "
    "обязательный пункт не раскрыт по существу, итоговый балл НЕ может быть "
    "зачётным (ставь не выше 50).\n"
    "Опирайся ТОЛЬКО на предоставленный юридический контекст и рубрику; не "
    "придумывай номера статей, сроки и реквизиты дел. Если ответ пустой, не по "
    "теме или мусорный — ставь близко к 0.\n"
    "Верни СТРОГО JSON без markdown и комментариев. В covered/missed указывай "
    "ID пунктов рубрики (kp1, kp2, ...), а не их текст:\n"
    '{"score":0..100,'  # percent of the rubric weight earned
    '"covered":[<id раскрытых пунктов>],'
    '"missed":[<id упущенных или неверно раскрытых пунктов>],'
    '"feedback":"<2-4 фразы: что именно не так и как усилить ответ>"}'
)

# When any rubric key_point marked обязательный (required) is not covered, the
# item score is capped below the per-item pass bar (the API uses 0.6) so a
# student cannot pass an item while skipping its load-bearing legal move.
_REQUIRED_MISS_CAP = 50


@dataclass(frozen=True)
class ExamGrade:
    score: float           # 0..max_score (scaled from the model's 0..100 percent)
    max_score: float
    percent: int           # 0..100 — rubric coverage as judged by the model
    covered: list[str] = field(default_factory=list)
    missed: list[str] = field(default_factory=list)
    feedback: str = ""
    model: str = ""
    cached: bool = False


# ── helpers ──────────────────────────────────────────────────────────────


def _normalize_answer(answer: str) -> str:
    return re.sub(r"\s+", " ", (answer or "").strip().lower())


def _grading_signature(rubric: dict | None, answer_key: dict | None) -> str:
    """A short hash of the grading criteria. Folded into the cache key so that
    editing an item's rubric/answer_key (re-seed, content fix) naturally
    invalidates previously-cached grades instead of serving a 30-day-stale
    score judged against the OLD criteria but re-scaled to the NEW points."""
    payload = json.dumps(
        {"r": rubric or {}, "k": answer_key or {}}, sort_keys=True, ensure_ascii=False,
    )
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:12]


def cache_key(
    item_id: str,
    answer: str,
    model: str | None = None,
    *,
    rubric: dict | None = None,
    answer_key: dict | None = None,
) -> str:
    m = model or settings.exam_model
    sig = _grading_signature(rubric, answer_key)
    raw = f"{m}|{item_id}|{sig}|{_normalize_answer(answer)}"
    return _CACHE_PREFIX + hashlib.sha1(raw.encode("utf-8")).hexdigest()


async def _redis_get(key: str) -> str | None:
    try:
        from app.core.redis_pool import get_redis
        val = await get_redis().get(key)
        return val.decode("utf-8") if isinstance(val, bytes) else val
    except Exception as e:
        logger.debug("exam_grader cache get skipped: %s", e)
        return None


async def _redis_set(key: str, payload: str) -> None:
    try:
        from app.core.redis_pool import get_redis
        await get_redis().set(key, payload, ex=_CACHE_TTL_SECONDS)
    except Exception as e:
        logger.debug("exam_grader cache set skipped: %s", e)


async def _redis_delete(key: str) -> None:
    try:
        from app.core.redis_pool import get_redis
        await get_redis().delete(key)
    except Exception as e:
        logger.debug("exam_grader cache delete skipped: %s", e)


async def invalidate_cache(
    item_id: str,
    answer: str,
    model: str | None = None,
    *,
    rubric: dict | None = None,
    answer_key: dict | None = None,
) -> None:
    """Drop the cached grade so a regrade/appeal re-judges from scratch (§5).
    Pass the same rubric/answer_key used at grade time so the signature matches."""
    await _redis_delete(cache_key(item_id, answer, model, rubric=rubric, answer_key=answer_key))


def _parse_llm_json(raw: str) -> dict[str, Any] | None:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _coerce(data: dict[str, Any], max_score: float) -> ExamGrade | None:
    try:
        try:
            percent = int(float(data.get("score", 0)))
        except (TypeError, ValueError):
            percent = 0
        percent = max(0, min(100, percent))
        covered = [str(x) for x in (data.get("covered") or []) if str(x).strip()]
        missed = [str(x) for x in (data.get("missed") or []) if str(x).strip()]
        feedback = str(data.get("feedback") or "").strip()
        score = round(percent / 100.0 * float(max_score), 2)
        return ExamGrade(
            score=score,
            max_score=float(max_score),
            percent=percent,
            covered=covered[:12],
            missed=missed[:12],
            feedback=feedback[:800],
            model=settings.exam_model,
        )
    except Exception as e:
        logger.warning("exam_grader coerce failed: %s", e)
        return None


def _build_rubric_block(rubric: dict | None, answer_key: dict | None) -> str:
    """Render the rubric + reference key-points into the prompt."""
    lines: list[str] = []
    points = (rubric or {}).get("key_points") or (answer_key or {}).get("key_points") or []
    if points:
        lines.append("РУБРИКА (ключевые пункты и веса):")
        for p in points:
            pid = str(p.get("id", "")).strip()
            text = str(p.get("text", "")).strip()
            weight = p.get("weight", 1)
            req = " [обязательный]" if p.get("required") else ""
            tag = f"[{pid}] " if pid else ""
            lines.append(f"  - {tag}{text} (вес {weight}){req}")
    ref = (answer_key or {}).get("model_answer") or (rubric or {}).get("model_answer")
    if ref:
        lines.append(f"\nЭТАЛОННЫЙ ОРИЕНТИР (для калибровки, не образец для копирования):\n{ref}")
    return "\n".join(lines)


# ── public API ───────────────────────────────────────────────────────────


async def grade_item(
    *,
    item_id: str,
    item_type: str,
    prompt: str,
    user_answer: str,
    max_score: float,
    rubric: dict | None = None,
    answer_key: dict | None = None,
    rag_context: str | None = None,
    article_reference: str | None = None,
) -> ExamGrade | None:
    """Grade one free-text exam item. Returns None on any failure (→ pending)."""
    answer = (user_answer or "").strip()
    if not answer:
        # Empty answer is a legitimate, deterministic 0 — no LLM needed and no
        # reason to mark the attempt pending.
        return ExamGrade(
            score=0.0, max_score=float(max_score), percent=0,
            covered=[], missed=["Ответ не дан"],
            feedback="Ответ пустой.", model=settings.exam_model,
        )
    if not settings.local_llm_api_key or not settings.local_llm_url:
        return None  # navy not configured → caller marks grading_pending

    # An AI item with NO scoring key (no rubric key_points and no model_answer)
    # cannot be graded strictly — the model would score freely against general
    # knowledge and could false-pass. Refuse → grading_pending, never a free cert.
    _points = (rubric or {}).get("key_points") or (answer_key or {}).get("key_points") or []
    if not _points and not ((answer_key or {}).get("model_answer") or (rubric or {}).get("model_answer")):
        logger.warning("exam_grader: AI item %s has no rubric/model_answer — refusing to grade", item_id)
        return None

    key = cache_key(item_id, answer, rubric=rubric, answer_key=answer_key)
    cached = await _redis_get(key)
    if cached:
        data = _parse_llm_json(cached)
        g = _coerce(data, max_score) if data else None
        if g:
            return ExamGrade(
                score=g.score, max_score=g.max_score, percent=g.percent,
                covered=g.covered, missed=g.missed, feedback=g.feedback,
                model=g.model, cached=True,
            )

    # Build the user payload.
    parts = [f"ТИП ЗАДАНИЯ: {item_type}", f"ЗАДАНИЕ:\n{prompt}"]
    if article_reference:
        parts.append(f"ОТНОСИМЫЕ СТАТЬИ: {article_reference}")
    rubric_block = _build_rubric_block(rubric, answer_key)
    if rubric_block:
        parts.append(rubric_block)
    if rag_context:
        parts.append(f"ЮРИДИЧЕСКИЙ КОНТЕКСТ (заземление, опирайся только на него и общеизвестные нормы ФЗ-127):\n{rag_context}")
    parts.append(f"ОТВЕТ ОБУЧАЮЩЕГОСЯ:\n{answer}")
    user_payload = "\n\n".join(parts)

    url = settings.local_llm_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.local_llm_api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": settings.exam_model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_payload},
        ],
        # temperature=0: a certifiable strict judge must be reproducible — an
        # appeal that invalidates the cache and re-grades the SAME answer must
        # return the SAME score (§5/§7 fair appeals), not sampling noise.
        "temperature": 0,
        "max_tokens": _MAX_TOKENS,
        "response_format": {"type": "json_object"},
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.post(url, headers=headers, json=body)
    except (httpx.TimeoutException, httpx.HTTPError) as e:
        logger.info("exam_grader network error: %s", e)
        return None

    if resp.status_code >= 400:
        logger.info("exam_grader upstream %d: %s", resp.status_code, resp.text[:200])
        return None

    try:
        raw_content = resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as e:
        logger.warning("exam_grader malformed response: %s", e)
        return None

    data = _parse_llm_json(raw_content)
    if not data:
        logger.warning("exam_grader non-JSON content: %r", (raw_content or "")[:200])
        return None

    g = _coerce(data, max_score)
    if not g:
        return None

    # Hard-enforce required rubric points: if any key_point marked required is
    # not in `covered`, cap the score below a pass regardless of what the model
    # returned. The prompt asks for ids in covered/missed, so match by id.
    g = _enforce_required(g, _points, max_score)

    try:
        await _redis_set(key, json.dumps({
            "score": g.percent,  # store the (capped) percent for re-scaling
            "covered": g.covered,
            "missed": g.missed,
            "feedback": g.feedback,
        }, ensure_ascii=False))
    except Exception as e:
        logger.debug("exam_grader cache write failed: %s", e)

    return g


def _enforce_required(g: ExamGrade, points: list, max_score: float) -> ExamGrade:
    """Cap the grade if a required key_point is not covered (defence-in-depth on
    top of the system-prompt instruction)."""
    required_ids = [str(p.get("id", "")).strip() for p in points
                    if p.get("required") and str(p.get("id", "")).strip()]
    if not required_ids:
        return g
    covered_join = " ".join(g.covered).lower()
    missing = [rid for rid in required_ids if rid.lower() not in covered_join]
    if not missing or g.percent <= _REQUIRED_MISS_CAP:
        return g
    capped = _REQUIRED_MISS_CAP
    note = f"Не раскрыт обязательный пункт ({', '.join(missing)}) — балл ограничен."
    return ExamGrade(
        score=round(capped / 100.0 * float(max_score), 2),
        max_score=float(max_score),
        percent=capped,
        covered=g.covered,
        missed=list(dict.fromkeys([*g.missed, *missing])),
        feedback=(g.feedback + " " + note).strip(),
        model=g.model,
    )


async def build_rag_grounding(
    db: AsyncSession,
    rag_chunk_refs: list | None,
    *,
    max_chars: int = 4000,
) -> str | None:
    """Fetch the legal chunks referenced by an item into a grounding block.

    ``rag_chunk_refs`` is the item's list of LegalKnowledgeChunk ids (or law
    article strings). Missing chunks are skipped silently — grounding is a
    quality boost, never a hard dependency. Returns None if nothing usable.
    """
    if not rag_chunk_refs:
        return None
    try:
        import uuid as _uuid
        from app.models.rag import LegalKnowledgeChunk
        from app.services.rag_legal import RAGContext, RAGResult
        ids: list = []
        articles: list[str] = []
        for ref in rag_chunk_refs:
            s = str(ref).strip()
            if not s:
                continue
            try:
                ids.append(_uuid.UUID(s))
            except (ValueError, AttributeError):
                articles.append(s)
        rows: list = []
        if ids:
            rows = list((await db.execute(
                select(LegalKnowledgeChunk).where(LegalKnowledgeChunk.id.in_(ids))
            )).scalars().all())
        if articles:
            rows += list((await db.execute(
                select(LegalKnowledgeChunk).where(
                    LegalKnowledgeChunk.law_article.in_(articles)
                )
            )).scalars().all())
        if not rows:
            return None
        # Build RAGResult objects and render via the canonical, allow-listed
        # rag_legal formatter (RAGContext.to_prompt_context). That path runs
        # filter_rag_context + knowledge-status gating + the [DATA_*] isolation
        # envelope — so exam grounding obeys the same prompt-isolation contract
        # as every other RAG consumer (tests/test_rag_invariants.py). We must
        # NOT hand-roll marker handling here.
        seen: set = set()
        results: list = []
        for r in rows:
            if r.id in seen:
                continue
            seen.add(r.id)
            results.append(RAGResult(
                chunk_id=r.id,
                category=r.category or "",
                fact_text=r.fact_text or "",
                law_article=r.law_article or "",
                relevance_score=1.0,
                knowledge_status=getattr(r, "knowledge_status", "actual") or "actual",
            ))
        block = RAGContext(query="exam-grading", results=results).to_prompt_context()
        if not block:
            return None
        return block[:max_chars] if len(block) > max_chars else block
    except Exception as e:
        logger.debug("exam_grader rag grounding skipped: %s", e)
        return None
