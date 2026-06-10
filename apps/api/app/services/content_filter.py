"""Content filter for user inputs and AI outputs.

Filters profanity, jailbreak attempts, PII leakage, and role breaks.
Used across PvP arena, training sessions, and all user-facing AI responses.

S4-02: ReDoS protection — all public functions enforce MAX_REGEX_INPUT_LENGTH
before running any regex operations, regardless of what the caller does.
"""

import re
import logging
import os

logger = logging.getLogger(__name__)

# S4-02: Hard limit for regex input — truncate before matching to prevent
# CPU exhaustion even with safe patterns (defense in depth).
MAX_REGEX_INPUT_LENGTH = 5000

# S4-02: Regex timeout protection against catastrophic backtracking.
# Uses signal.SIGALRM on Unix; falls back to no timeout on Windows.

class RegexTimeoutError(Exception):
    pass


_HAS_SIGALRM = hasattr(__import__("signal"), "SIGALRM")


def _safe_match(pattern, text, timeout_seconds=2):
    """Match regex with timeout protection against catastrophic backtracking.

    Returns match object or None. On timeout, logs a warning and returns None.
    Only effective on Unix (uses SIGALRM); on Windows falls back to no timeout.
    """
    if not _HAS_SIGALRM:
        return pattern.search(text)

    import signal

    def _handler(signum, frame):
        raise RegexTimeoutError(f"Regex timed out after {timeout_seconds}s")

    old_handler = signal.signal(signal.SIGALRM, _handler)
    signal.alarm(timeout_seconds)
    try:
        return pattern.search(text)
    except RegexTimeoutError:
        logger.warning(
            "Regex timeout (%ds) on pattern=%s, input_len=%d",
            timeout_seconds, pattern.pattern[:60], len(text),
        )
        return None
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)


def _safe_truncate(text: str) -> str:
    """Truncate text to MAX_REGEX_INPUT_LENGTH for safe regex processing."""
    if len(text) <= MAX_REGEX_INPUT_LENGTH:
        return text
    logger.warning(
        "content_filter: input truncated from %d to %d chars before regex",
        len(text), MAX_REGEX_INPUT_LENGTH,
    )
    return text[:MAX_REGEX_INPUT_LENGTH]

# ─── Profanity patterns (Russian + transliteration) ─────────────────────────

_PROFANITY_PATTERNS = [
    r"\b[хx][уy][йеёия]\w*\b",
    r"\b[пp][иi][зz][дd]\w*\b",
    r"\b[еe][бb][аa][тt]\w*\b",
    r"\b[бb][лl][яa][дт]?\w*\b",
    r"\b[сs][уy][кk][аaиi]\w*\b",
    r"\b[мm][уy][дd][аa][кk]\w*\b",
    r"\bгандон\w*\b",
    r"\bшлюх\w*\b",
    r"\bдерьм\w*\b",
    r"\bзасранец\w*\b",
    r"\bpidoras\w*\b",
    r"\bsuka\b",
    r"\bblyad\w*\b",
    r"\bhui\b",
    # English basics
    r"\bfuck\w*\b",
    r"\bshit\w*\b",
    r"\bbitch\w*\b",
    r"\bass(?:hole)?\b",
    r"\bdick(?:head)?\b",
]

_profanity_compiled = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in _PROFANITY_PATTERNS]

# ─── Jailbreak / prompt injection patterns ──────────────────────────────────

_JAILBREAK_PATTERNS = [
    # Direct instruction override attempts
    r"(?:ignore|забудь|отмени|проигнорируй)\s+(?:all\s+)?(?:previous|предыдущ|систем|выше|above)\s+(?:instructions?|инструкц|prompt|промпт)",
    r"(?:you\s+are\s+now|ты\s+теперь|act\s+as|притворись|представь\s+что\s+ты)\s+(?:a\s+)?(?:different|друг|нов|свободн|DAN|jailbreak)",
    r"(?:system\s*prompt|системн\w*\s*промпт|system\s*message)",
    r"(?:reveal|покажи|расскажи|выведи)\s+(?:your|свой|свои|the)\s+(?:instructions?|инструкц|prompt|промпт|rules|правила)",
    # Role escape
    r"(?:stop\s+(?:being|pretending|playing)|перестань\s+(?:играть|притвор)|выйди\s+из\s+роли)",
    r"(?:break\s+character|сломай\s+персонаж|drop\s+the\s+act)",
    # Token manipulation
    r"\[/?(?:SYSTEM|INST|SYS)\]",
    r"<\|(?:im_start|im_end|system|endoftext)\|>",
    r"```(?:system|instruction)",
    # Developer mode tricks
    r"(?:developer\s+mode|режим\s+разработчика|admin\s+mode|debug\s+mode)",
    r"(?:enable\s+unrestricted|включи\s+без\s+ограничений)",
]

_jailbreak_compiled = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in _JAILBREAK_PATTERNS]

# ─── PII patterns ───────────────────────────────────────────────────────────

_PII_PATTERNS = [
    # Russian phone numbers
    r"\+?7[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}",
    r"8[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}",
    # Email
    r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b",
    # Passport (RU format: 4 digits space 6 digits — anchored at boundaries)
    r"\b\d{4}\s\d{6}\b",
    # SNILS
    r"\b\d{3}[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{2}\b",
    # INN (10 or 12 digits, with or without "ИНН" prefix)
    r"\bИНН[\s:]*\d{10,12}\b",
    r"\b\d{10}\b(?=\D|$)",  # bare 10-digit (corporate INN)
    r"\b\d{12}\b(?=\D|$)",  # bare 12-digit (individual INN)
    # TZ-5 §4 — Russian banking/legal identifiers in training materials
    # OGRN — corporate state registration (13 digits)
    r"\b\d{13}\b(?=\D|$)",
    # OGRNIP — individual entrepreneur (15 digits)
    r"\b\d{15}\b(?=\D|$)",
    # BIK — bank routing (9 digits)
    r"\bБИК[\s:]*\d{9}\b",
    # Bank account / р/с (20 digits)
    r"\b(?:р/с|р\.с\.|расчётный счёт|расчетный счёт)[\s:]*\d{20}\b",
    r"\b\d{20}\b(?=\D|$)",
    # Card numbers (Luhn-shaped 13-19 digits with optional spaces)
    r"\b(?:\d[\s\-]?){13,19}\b",
    # Vehicle plates (А000АА00 / А000АА000 — Russian)
    r"\b[АВЕКМНОРСТУХAVEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХAVEKMHOPCTYX]{2}\d{2,3}\b",
]

_pii_compiled = [re.compile(p, re.UNICODE) for p in _PII_PATTERNS]

# 2026-06-04 (ultrareview M16): the bare-number INN/OGRN/account patterns (a run
# of exactly 10/12/13/15/20 digits with no contextual keyword) over-matched in
# the legal RAG corpus — case numbers, statute references, contiguous sums — and
# blanked legitimate content with [ДАННЫЕ СКРЫТЫ] BEFORE it reached the model.
# For RAG sanitization use a HIGH-CONFIDENCE subset only (phone/email/passport/
# SNILS + keyword-prefixed ИНН/БИК/р-с + card + plate). User-input filtering
# keeps the full strict set (short text, real client PII more likely).
_BARE_NUMBER_PII = frozenset({
    r"\b\d{10}\b(?=\D|$)",
    r"\b\d{12}\b(?=\D|$)",
    r"\b\d{13}\b(?=\D|$)",
    r"\b\d{15}\b(?=\D|$)",
    r"\b\d{20}\b(?=\D|$)",
    # The "card" pattern matches any 13-19 contiguous digit run → also blanks
    # OGRN/account/case numbers in the static legal corpus. Dropped for RAG
    # (the corpus holds legislation, not client card numbers; real client PII is
    # still caught by phone/email/passport/SNILS patterns).
    r"\b(?:\d[\s\-]?){13,19}\b",
})
_rag_pii_compiled = [re.compile(p, re.UNICODE) for p in _PII_PATTERNS if p not in _BARE_NUMBER_PII]

# ─── Role break patterns (AI output) ────────────────────────────────────────

_ROLE_BREAK_PATTERNS = [
    r"(?:как\s+(?:языковая\s+модель|искусственный\s+интеллект|ИИ|AI))",
    r"(?:as\s+an?\s+(?:AI|language\s+model|assistant))",
    r"(?:я\s+(?:не\s+)?(?:могу|умею)\s+(?:помочь|ответить)\s+как\s+(?:ИИ|AI))",
    r"(?:I\s+(?:can't|cannot|am\s+not\s+able)\s+(?:as|because\s+I'm)\s+an?\s+AI)",
]

_role_break_compiled = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in _ROLE_BREAK_PATTERNS]

MAX_ANSWER_LENGTH = 1000
# 2026-06-04 (ultrareview M6): 2000 silently truncated long structured legal
# answers from «Маняша» (knowledge agent). Roleplay replies are short and
# additionally word-capped in llm._filter_output, so a higher hard backstop here
# doesn't lengthen roleplay — it only stops cutting legitimate legal content.
MAX_AI_RESPONSE_LENGTH = 8000


def filter_answer_text(text: str) -> tuple[str, bool]:
    """Filter user answer for PvP display.

    Returns: (filtered_text, was_filtered)
    """
    filtered = _safe_truncate(text)
    was_filtered = len(text) > MAX_REGEX_INPUT_LENGTH

    for pattern in _profanity_compiled:
        if pattern.search(filtered):
            filtered = pattern.sub("***", filtered)
            was_filtered = True

    if len(filtered) > MAX_ANSWER_LENGTH:
        filtered = filtered[:MAX_ANSWER_LENGTH] + "..."
        was_filtered = True

    return filtered, was_filtered


def detect_jailbreak(text: str) -> bool:
    """Check if user input contains jailbreak / prompt injection attempt.

    Returns True if suspicious patterns found.
    """
    text = _safe_truncate(text)
    for pattern in _jailbreak_compiled:
        if _safe_match(pattern, text):
            logger.warning("Jailbreak attempt detected: pattern=%s", pattern.pattern[:60])
            return True
    return False


def filter_user_input(text: str) -> tuple[str, list[str]]:
    """Filter user message before sending to LLM.

    Returns: (filtered_text, list_of_violation_types)
    """
    # 2026-06-04 (ultrareview): None/empty must degrade, not TypeError → 500.
    if not text:
        return "", []
    violations = []
    filtered = _safe_truncate(text)

    # Check jailbreak
    if detect_jailbreak(filtered):
        violations.append("jailbreak_attempt")
        # Don't send to LLM at all — return safe replacement
        return "Клиент задал обычный вопрос о процедуре.", violations

    # Filter profanity
    for pattern in _profanity_compiled:
        if pattern.search(filtered):
            filtered = pattern.sub("***", filtered)
            if "profanity" not in violations:
                violations.append("profanity")

    # Filter PII
    for pattern in _pii_compiled:
        if pattern.search(filtered):
            filtered = pattern.sub("[ДАННЫЕ СКРЫТЫ]", filtered)
            if "pii" not in violations:
                violations.append("pii")

    return filtered, violations


def strip_pii(text: str) -> str:
    """Remove PII patterns from text, returning cleaned version.

    TZ-5 §4 fix: short inputs (≤ MAX_REGEX_INPUT_LENGTH) are scrubbed in
    one pass; longer inputs (e.g. parsed .docx with thousands of lines)
    are scrubbed in overlapping windows so PII near a chunk boundary
    isn't missed. Without this, the original 5KB-truncate behaviour
    leaked phone numbers / passport fragments to the LLM and to the
    `scenario_drafts.source_text` JSONB column from any non-trivial
    training material upload.
    """
    if not text:
        return text
    if len(text) <= MAX_REGEX_INPUT_LENGTH:
        cleaned = text
        for pattern in _pii_compiled:
            cleaned = pattern.sub("[ДАННЫЕ СКРЫТЫ]", cleaned)
        return cleaned
    # Chunked scrub: window stride is MAX_REGEX_INPUT_LENGTH minus a
    # 200-char overlap so a phone number split across the seam still
    # matches in at least one window. Each chunk is regex'd in isolation
    # (bounded ReDoS exposure stays MAX_REGEX_INPUT_LENGTH per call).
    overlap = 200
    stride = MAX_REGEX_INPUT_LENGTH - overlap
    cleaned_parts: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + MAX_REGEX_INPUT_LENGTH, len(text))
        chunk = text[start:end]
        for pattern in _pii_compiled:
            chunk = pattern.sub("[ДАННЫЕ СКРЫТЫ]", chunk)
        if start == 0:
            cleaned_parts.append(chunk)
        else:
            # Drop the leading `overlap` chars — they were already covered
            # by the previous window's tail (and may now contain partially-
            # scrubbed tokens; the previous window's scrub is authoritative).
            cleaned_parts.append(chunk[overlap:])
        if end >= len(text):
            break
        start += stride
    return "".join(cleaned_parts)


def _sanitize_rag_field(text: str, field_name: str, chunk_id: str = "") -> tuple[str, list[str]]:
    """Sanitize a single RAG text field. Returns (cleaned_text, violations)."""
    if not text:
        return text, []
    violations = []
    cleaned = _safe_truncate(text)

    # 1. Jailbreak / prompt injection detection
    for pattern in _jailbreak_compiled:
        if _safe_match(pattern, cleaned):
            violations.append(f"rag_injection:{field_name}")
            cleaned = pattern.sub("[FILTERED]", cleaned)
            logger.warning(
                "RAG injection detected in field '%s' chunk=%s: pattern=%s",
                field_name, chunk_id, pattern.pattern[:60],
            )

    # 2. PII stripping — RAG-safe subset (M16): high-confidence patterns only,
    # so legal reference numbers / sums are not blanked as false-positive PII.
    for pattern in _rag_pii_compiled:
        if pattern.search(cleaned):
            cleaned = pattern.sub("[ДАННЫЕ СКРЫТЫ]", cleaned)
            if f"rag_pii:{field_name}" not in violations:
                violations.append(f"rag_pii:{field_name}")

    # 3. Length cap (per field)
    if len(cleaned) > 2000:
        cleaned = cleaned[:2000]
        violations.append(f"rag_length:{field_name}")
        logger.warning("RAG field '%s' chunk=%s truncated at 2000 chars", field_name, chunk_id)

    return cleaned, violations


def filter_rag_context(results: list) -> tuple[list, list[str]]:
    """Filter RAG results before prompt injection (3rd filtering point).

    Sanitizes text fields of each RAGResult: fact_text, common_errors,
    correct_response_hint, court_case_reference. If injection is detected,
    the field is cleaned in-place and the violation is logged.

    Args:
        results: list of RAGResult dataclass instances

    Returns:
        (cleaned_results, all_violations) — results are modified in-place
        and also returned for convenience.
    """
    all_violations: list[str] = []

    for r in results:
        cid = str(getattr(r, "chunk_id", ""))

        # fact_text
        if r.fact_text:
            r.fact_text, v = _sanitize_rag_field(r.fact_text, "fact_text", cid)
            all_violations.extend(v)

        # common_errors (list[str])
        if r.common_errors:
            cleaned_errors = []
            for err_text in r.common_errors:
                cleaned, v = _sanitize_rag_field(err_text, "common_errors", cid)
                all_violations.extend(v)
                cleaned_errors.append(cleaned)
            r.common_errors = cleaned_errors

        # correct_response_hint
        if r.correct_response_hint:
            r.correct_response_hint, v = _sanitize_rag_field(
                r.correct_response_hint, "correct_response_hint", cid,
            )
            all_violations.extend(v)

        # court_case_reference
        if r.court_case_reference:
            r.court_case_reference, v = _sanitize_rag_field(
                r.court_case_reference, "court_case_reference", cid,
            )
            all_violations.extend(v)

    if all_violations:
        logger.warning(
            "RAG context filter: %d violation(s) across %d chunks: %s",
            len(all_violations), len(results), all_violations[:10],
        )

    return results, all_violations


def filter_wiki_context(pages: list[dict]) -> tuple[list[dict], list[str]]:
    """Filter user-editable wiki pages before prompt injection.

    PR-X foundation fix #2 — closes the prompt-injection gap on the
    third RAG source. ``manager_wiki.update_wiki_page`` (admin/rop UI)
    accepts arbitrary markdown; without sanitisation that markdown
    would land verbatim in the LLM system prompt via
    :func:`UnifiedRAGResult.to_prompt`. A ROP who pasted a model
    transcript ending with ``Ignore all previous instructions…``
    would silently jailbreak every coach/training session that
    surfaced the page.

    The fields on the dict mirror what
    :func:`app.services.rag_wiki.retrieve_wiki_context` returns —
    ``content`` (truncated to 500 chars upstream), ``page_path``
    (used as a heading in the prompt), and ``tags`` (list[str]).
    Other fields (``similarity``, ``page_type``, ``rerank_score``)
    are not user-controllable and are passed through.

    Args:
        pages: list[dict] from ``retrieve_wiki_context``. Mutated in
            place (cleaned content/page_path/tags) and also returned.

    Returns:
        (cleaned_pages, all_violations). ``all_violations`` carries
        the same ``rag_injection:<field>`` / ``rag_pii:<field>``
        / ``rag_length:<field>`` markers as :func:`filter_rag_context`
        for unified observability.
    """
    all_violations: list[str] = []

    for page in pages:
        page_id = str(page.get("page_path", ""))[:60]

        content = page.get("content")
        if content:
            cleaned, v = _sanitize_rag_field(content, "wiki_content", page_id)
            page["content"] = cleaned
            all_violations.extend(v)

        # ``page_path`` is rendered as a header in the prompt — a ROP
        # who names a page ``ignore-all-previous-instructions`` should
        # not weaponise the path itself.
        path = page.get("page_path")
        if path:
            cleaned, v = _sanitize_rag_field(path, "wiki_page_path", page_id)
            page["page_path"] = cleaned
            all_violations.extend(v)

        tags = page.get("tags")
        if tags:
            cleaned_tags = []
            for t in tags:
                if not t:
                    continue
                cleaned, v = _sanitize_rag_field(str(t), "wiki_tag", page_id)
                all_violations.extend(v)
                cleaned_tags.append(cleaned)
            page["tags"] = cleaned_tags

    if all_violations:
        logger.warning(
            "Wiki context filter: %d violation(s) across %d pages: %s",
            len(all_violations), len(pages), all_violations[:10],
        )

    return pages, all_violations


def filter_methodology_context(chunks: list[dict]) -> tuple[list[dict], list[str]]:
    """Sanitise team methodology chunks before they reach the prompt.

    TZ-8 PR-B — closes the prompt-injection gap on the third RAG
    source (after legal in S1-01 and wiki in PR-X). The shape of
    the work is identical to :func:`filter_wiki_context` because
    both are user-edited free-form text injected into a system
    prompt; only the field names differ:

      * ``title``    → rendered as a header in the prompt block
      * ``body``     → rendered as the bulk content
      * ``tags``     → free-form labels (UI filter, not a retriever
                       signal — sanitised anyway because they ride
                       inside the same dict that lands in the LLM
                       trace and the methodology UI)
      * ``keywords`` → reranker hints; sanitised so a malicious
                       keyword cannot smuggle a jailbreak token

    Mutates ``chunks`` in place and returns it for ergonomics.
    Other dict keys (``id``, ``kind``, ``knowledge_status``,
    ``similarity``, ``rerank_score``) are not user-controllable
    and pass through.

    Violation strings follow the same ``rag_<kind>:<field>`` shape
    as :func:`filter_rag_context` and :func:`filter_wiki_context`,
    so the unified observability log treats all three sources
    consistently.
    """
    all_violations: list[str] = []

    for chunk in chunks:
        # Logging anchor — title is the most stable identifier the
        # caller has at this stage (the row id is fine but a title
        # string is friendlier in Grafana when the operator scrolls
        # the warning stream).
        anchor = str(chunk.get("title", ""))[:60]

        title = chunk.get("title")
        if title:
            cleaned, v = _sanitize_rag_field(title, "methodology_title", anchor)
            chunk["title"] = cleaned
            all_violations.extend(v)

        body = chunk.get("body")
        if body:
            cleaned, v = _sanitize_rag_field(body, "methodology_body", anchor)
            chunk["body"] = cleaned
            all_violations.extend(v)

        tags = chunk.get("tags")
        if tags:
            cleaned_tags = []
            for t in tags:
                if not t:
                    continue
                cleaned, v = _sanitize_rag_field(
                    str(t), "methodology_tag", anchor
                )
                all_violations.extend(v)
                cleaned_tags.append(cleaned)
            chunk["tags"] = cleaned_tags

        keywords = chunk.get("keywords")
        if keywords:
            cleaned_kw = []
            for kw in keywords:
                if not kw:
                    continue
                cleaned, v = _sanitize_rag_field(
                    str(kw), "methodology_keyword", anchor
                )
                all_violations.extend(v)
                cleaned_kw.append(cleaned)
            chunk["keywords"] = cleaned_kw

    if all_violations:
        logger.warning(
            "Methodology context filter: %d violation(s) across %d chunks: %s",
            len(all_violations), len(chunks), all_violations[:10],
        )

    return chunks, all_violations


def filter_ai_output(text: str) -> tuple[str, list[str]]:
    """Filter AI response before sending to user.

    Returns: (filtered_text, list_of_violation_types)
    """
    # 2026-06-04 (ultrareview): None/empty must degrade, not TypeError → 500.
    if not text:
        return "", []
    violations = []
    filtered = _safe_truncate(text)

    # 2026-05-04 (NEW-1 prod incident): strip leaked LLM reasoning / tool blocks.
    # Production session showed AI reply ending with literal text:
    #   "Понятно. Тогда кто это?## Test Output Reasoning We need answer as
    #    client persona. ... Already crafted."
    # Different LLM providers leak inner planning under different markers.
    # Cut at the FIRST occurrence of any of these — everything after is
    # provider-internal noise that must never reach the user.
    _REASONING_MARKERS = (
        r"##\s*Test\s*Output",          # navy.api / generic chain-of-thought tag
        r"##\s*Reasoning",
        r"##\s*Analysis",
        r"##\s*Thought",
        r"<\s*/?\s*think\b",            # <think> / </think> blocks
        r"<\s*/?\s*reasoning\b",
        r"<\s*/?\s*analysis\b",
        r"<\s*/?\s*scratchpad\b",
        r"\[ASSISTANT[_\- ]REASONING\]",
        r"\[INTERNAL\]",
        r"```\s*(?:json|tool|function|reasoning)\b",  # leaked code-fences
        r"\bAnswer\s*:\s*",             # rare but seen — model writes "Answer:" header
    )
    import re as _re_leak
    _LEAK_RE = _re_leak.compile(
        "|".join(f"(?:{p})" for p in _REASONING_MARKERS),
        flags=_re_leak.IGNORECASE,
    )
    _m = _LEAK_RE.search(filtered)
    if _m:
        # Cut everything from the marker onwards. Trim trailing punctuation /
        # whitespace artefacts so the cut looks natural in chat.
        filtered = filtered[: _m.start()].rstrip(" \t\n.,:;-—")
        if not filtered.endswith((".", "!", "?", "…")) and filtered:
            filtered += "."
        violations.append("reasoning_leak")
        logger.warning("AI reasoning leak stripped (marker=%r)", _m.group(0)[:30])

    # 2026-06-08: strip hashtags from assistant (Manyasha) answers. The model
    # habitually tags paragraphs with topical hashtags ("#банкротство",
    # "#совет"); product wants none of them in any Manyasha surface (knowledge
    # base, history-разбор, quiz-наставник). All three route through this
    # function, so one pass here covers every surface.
    #
    # A hashtag token = "#" immediately followed by a word char (latin/cyrillic/
    # digit/underscore). Markdown headers ("## " / "### ") have a SPACE after the
    # hashes, so requiring a word char keeps them untouched.
    _HASHTAG_RE = _re_leak.compile(r"#[0-9A-Za-zА-Яа-яЁё_][0-9A-Za-zА-Яа-яЁё_-]*")
    if _HASHTAG_RE.search(filtered):
        _stripped = _HASHTAG_RE.sub("", filtered)
        # Clean up the artefacts the removal leaves behind.
        _stripped = _re_leak.sub(r"(?m)^[ \t]*[:;\-–—,.][ \t]*", "", _stripped)  # orphan punct at line start (from "#совет:")
        _stripped = _re_leak.sub(r"[ \t]+([.,:;!?…])", r"\1", _stripped)  # space before punctuation (" .")
        _stripped = _re_leak.sub(r"[ \t]{2,}", " ", _stripped)   # collapsed double spaces
        _stripped = _re_leak.sub(r"[ \t]+\n", "\n", _stripped)    # trailing ws per line
        _stripped = _re_leak.sub(r"\n{3,}", "\n\n", _stripped)    # 3+ blank lines → 2
        filtered = _stripped.strip()
        violations.append("hashtags_stripped")

    # Length cap
    if len(filtered) > MAX_AI_RESPONSE_LENGTH:
        filtered = filtered[:MAX_AI_RESPONSE_LENGTH]
        last_period = filtered.rfind(".")
        if last_period > MAX_AI_RESPONSE_LENGTH * 0.7:
            filtered = filtered[:last_period + 1]
        violations.append("length_exceeded")

    # Role break detection + removal (S1-02 2.2.7). 2026-06-04 (ultrareview M17):
    # actually STRIP the AI-disclaimer phrase ("как языковая модель" / "as an AI")
    # — previously it was only detected/flagged and still reached the user on
    # non-roleplay surfaces (where the roleplay filler isn't substituted).
    for pattern in _role_break_compiled:
        if pattern.search(filtered):
            if "role_break" not in violations:
                violations.append("role_break")
            filtered = pattern.sub("", filtered)
            logger.warning("AI role break detected and stripped from output")
    if "role_break" in violations:
        # tidy up double spaces left by the excision
        filtered = re.sub(r"\s{2,}", " ", filtered).strip()

    # PII leak detection
    for pattern in _pii_compiled:
        if pattern.search(filtered):
            filtered = pattern.sub("[ДАННЫЕ СКРЫТЫ]", filtered)
            if "pii_leak" not in violations:
                violations.append("pii_leak")

    # Profanity in AI output
    for pattern in _profanity_compiled:
        if pattern.search(filtered):
            filtered = pattern.sub("***", filtered)
            if "profanity" not in violations:
                violations.append("profanity")

    return filtered, violations


# Compiled once — markdown markers + standalone hashtags for Manyasha cleanup.
_MD_HEADING_RE = re.compile(r"(?m)^[ \t]*#{1,6}[ \t]+")
_MD_BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
_MD_BOLD_U_RE = re.compile(r"__([^_]+)__")
_MD_BULLET_RE = re.compile(r"(?m)^[ \t]*[\*\-+][ \t]+")
_MD_ITALIC_RE = re.compile(r"\*([^*\n]+)\*")
_MD_ITALIC_U_RE = re.compile(r"(?<![\w])_([^_\n]+)_(?![\w])")
_MD_CODE_RE = re.compile(r"`([^`]+)`")
_MD_HASHTAG_RE = re.compile(r"#[0-9A-Za-zА-Яа-яЁё_][0-9A-Za-zА-Яа-яЁё_-]*")


def strip_markdown_formatting(text: str) -> str:
    """Convert assistant markdown to clean plain text.

    The Manyasha surfaces (история «Разбор», knowledge tab, widget) render the
    reply as RAW text (`whiteSpace: pre-line`, no markdown parser), so model
    markdown like `### Заголовок` and `**жирный**` shows as literal `###`/`**`.
    This flattens headings, bold/italic, inline code and bullets, and removes
    standalone hashtags.

    DO NOT use this on roleplay client replies — they use `*кладёт трубку*`
    action-emotes that this would strip. Manyasha surfaces only.
    """
    if not text:
        return text
    t = text
    t = _MD_HEADING_RE.sub("", t)            # "### Title" → "Title"
    t = _MD_BOLD_RE.sub(r"\1", t)            # **x** → x
    t = _MD_BOLD_U_RE.sub(r"\1", t)          # __x__ → x
    t = _MD_BULLET_RE.sub("• ", t)           # "* item" / "- item" → "• item" (before italic)
    t = _MD_ITALIC_RE.sub(r"\1", t)          # *x* → x
    t = _MD_ITALIC_U_RE.sub(r"\1", t)        # _x_ → x
    t = _MD_CODE_RE.sub(r"\1", t)            # `x` → x
    t = _MD_HASHTAG_RE.sub("", t)            # #тег → (removed)
    t = t.replace("**", "").replace("__", "")  # leftover stray markers
    # Whitespace tidy-up after removals.
    t = re.sub(r"(?m)^[ \t]*[:;\-–—,.][ \t]*", "", t)  # orphan punct at line start
    t = re.sub(r"[ \t]+([.,:;!?…])", r"\1", t)         # space before punctuation
    t = re.sub(r"[ \t]{2,}", " ", t)
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()
