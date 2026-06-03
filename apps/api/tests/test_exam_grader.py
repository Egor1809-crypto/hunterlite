"""Tests for the strict exam AI grader (app.services.exam_grader).

Covers docs/exam/EXAM_TZ.md §9 acceptance for the grader in isolation:
  (b) golden answer → high score, garbage → low score (mocked model, but the
      scaling/clamp/parse contract is exercised),
  (г) determinism — same (item, answer) returns the cached grade without a 2nd
      network call; invalidate_cache forces a re-judge,
  (д) safe degradation — navy down / 5xx / non-JSON → None (caller marks the
      attempt grading_pending and withholds the certificate).

The model HTTP call is mocked; we do NOT hit real navy in CI. A separate
real-navy calibration smoke lives in test_exam_grader_navy.py (skipped unless
NAVY creds are present).
"""

import json

import httpx
import pytest

from app.config import settings
from app.services import exam_grader


# ── fake httpx client ──────────────────────────────────────────────────────


class _FakeResponse:
    def __init__(self, status_code: int, content: str):
        self.status_code = status_code
        self._content = content
        self.text = content

    def json(self):
        return {"choices": [{"message": {"content": self._content}}]}


class _FakeClient:
    """Async-context-manager stand-in for httpx.AsyncClient."""

    def __init__(self, response=None, exc=None, counter=None):
        self._response = response
        self._exc = exc
        self._counter = counter

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, headers=None, json=None):
        if self._counter is not None:
            self._counter["n"] += 1
        if self._exc is not None:
            raise self._exc
        return self._response


@pytest.fixture(autouse=True)
def _enable_navy(monkeypatch):
    # The grader early-returns None unless navy looks configured.
    monkeypatch.setattr(settings, "local_llm_api_key", "test-key", raising=False)
    monkeypatch.setattr(settings, "local_llm_url", "https://api.navy/v1", raising=False)
    monkeypatch.setattr(settings, "exam_model", "deepseek-v4-pro", raising=False)


@pytest.fixture
def mem_cache(monkeypatch):
    """In-memory replacement for the Redis cache so determinism is testable."""
    store: dict[str, str] = {}

    async def _get(key):
        return store.get(key)

    async def _set(key, payload):
        store[key] = payload

    async def _delete(key):
        store.pop(key, None)

    monkeypatch.setattr(exam_grader, "_redis_get", _get)
    monkeypatch.setattr(exam_grader, "_redis_set", _set)
    monkeypatch.setattr(exam_grader, "_redis_delete", _delete)
    return store


def _patch_client(monkeypatch, **kwargs):
    monkeypatch.setattr(
        exam_grader.httpx, "AsyncClient",
        lambda *a, **k: _FakeClient(**kwargs),
    )


RUBRIC = {
    "key_points": [
        {"id": "kp1", "text": "Единственное жильё — исполнительский иммунитет", "weight": 3, "required": True},
        {"id": "kp2", "text": "Оспоримые сделки за 3 года (ст. 61.2)", "weight": 2},
        {"id": "kp3", "text": "Реструктуризация vs реализация", "weight": 2},
    ]
}
# Same shape but no required points — used where the test exercises parsing/scaling
# and must NOT trip the required-point cap.
RUBRIC_NO_REQ = {
    "key_points": [
        {"id": "kp1", "text": "пункт", "weight": 1},
        {"id": "kp2", "text": "пункт", "weight": 1},
    ]
}


# ── golden vs garbage (scaling/parse contract) ──────────────────────────────


@pytest.mark.asyncio
async def test_golden_answer_high_score(monkeypatch, mem_cache):
    payload = json.dumps({
        "score": 95,
        "covered": ["kp1", "kp2", "kp3"],
        "missed": [],
        "feedback": "Полный, корректный разбор.",
    })
    _patch_client(monkeypatch, response=_FakeResponse(200, payload))
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis",
        prompt="...", user_answer="Подробный корректный анализ дела ...",
        max_score=7.0, rubric=RUBRIC,
    )
    assert g is not None
    assert g.percent == 95
    # 95% of 7 points = 6.65
    assert g.score == pytest.approx(6.65)
    assert g.max_score == 7.0
    assert set(g.covered) == {"kp1", "kp2", "kp3"}
    assert g.missed == []


@pytest.mark.asyncio
async def test_garbage_answer_low_score(monkeypatch, mem_cache):
    payload = json.dumps({
        "score": 5, "covered": [], "missed": ["kp1", "kp2", "kp3"],
        "feedback": "Ответ не по теме.",
    })
    _patch_client(monkeypatch, response=_FakeResponse(200, payload))
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis",
        prompt="...", user_answer="не знаю, наверное всё спишут",
        max_score=7.0, rubric=RUBRIC,
    )
    assert g is not None
    assert g.percent == 5
    assert g.score == pytest.approx(0.35)
    assert "kp1" in g.missed


@pytest.mark.asyncio
async def test_empty_answer_is_deterministic_zero_no_network(monkeypatch, mem_cache):
    # An empty answer must NOT hit the model and must NOT be pending — it's a
    # legitimate, deterministic 0.
    def _boom(*a, **k):
        raise AssertionError("should not call the model for an empty answer")
    monkeypatch.setattr(exam_grader.httpx, "AsyncClient", _boom)
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis",
        prompt="...", user_answer="   ", max_score=7.0, rubric=RUBRIC,
    )
    assert g is not None
    assert g.score == 0.0
    assert g.percent == 0


@pytest.mark.asyncio
async def test_score_is_clamped_0_100(monkeypatch, mem_cache):
    _patch_client(monkeypatch, response=_FakeResponse(200, json.dumps({"score": 250, "covered": ["kp1", "kp2"]})))
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="x", max_score=10.0, rubric=RUBRIC_NO_REQ,
    )
    assert g.percent == 100
    assert g.score == 10.0


@pytest.mark.asyncio
async def test_required_point_missing_caps_score(monkeypatch, mem_cache):
    # Model claims 90% but did not cover the required kp1 → capped below pass.
    _patch_client(monkeypatch, response=_FakeResponse(200, json.dumps(
        {"score": 90, "covered": ["kp2", "kp3"], "missed": [], "feedback": "ok"})))
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="ответ без иммунитета", max_score=8.0, rubric=RUBRIC,
    )
    assert g.percent == exam_grader._REQUIRED_MISS_CAP  # 50
    assert g.score == pytest.approx(4.0)  # 50% of 8
    assert "kp1" in g.missed


@pytest.mark.asyncio
async def test_rubric_less_ai_item_returns_none(monkeypatch, mem_cache):
    # An AI item with no rubric key_points and no model_answer cannot be graded
    # strictly → None (caller marks grading_pending; never a free pass).
    def _boom(*a, **k):
        raise AssertionError("must not call the model for an unkeyed AI item")
    monkeypatch.setattr(exam_grader.httpx, "AsyncClient", _boom)
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="любой развёрнутый ответ", max_score=8.0, rubric={}, answer_key={},
    )
    assert g is None


# ── determinism (caching) ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_determinism_second_call_uses_cache(monkeypatch, mem_cache):
    counter = {"n": 0}
    payload = json.dumps({"score": 80, "covered": ["kp1"], "missed": ["kp2"], "feedback": "ok"})
    _patch_client(monkeypatch, response=_FakeResponse(200, payload), counter=counter)

    args = dict(item_id="i7", item_type="case_analysis", prompt="p",
                user_answer="Один и тот же ответ", max_score=5.0, rubric=RUBRIC)
    g1 = await exam_grader.grade_item(**args)
    g2 = await exam_grader.grade_item(**args)
    assert counter["n"] == 1, "second identical grade must be served from cache"
    assert g1.score == g2.score == pytest.approx(4.0)
    assert g2.cached is True
    assert g1.cached is False


@pytest.mark.asyncio
async def test_invalidate_cache_forces_regrade(monkeypatch, mem_cache):
    counter = {"n": 0}
    payload = json.dumps({"score": 80, "covered": [], "missed": [], "feedback": ""})
    _patch_client(monkeypatch, response=_FakeResponse(200, payload), counter=counter)
    args = dict(item_id="i7", item_type="case_analysis", prompt="p",
                user_answer="ответ", max_score=5.0, rubric=RUBRIC)
    await exam_grader.grade_item(**args)
    await exam_grader.invalidate_cache("i7", "ответ", rubric=RUBRIC)
    await exam_grader.grade_item(**args)
    assert counter["n"] == 2, "after invalidate, the model must be called again"


# ── safe degradation → None (grading_pending) ───────────────────────────────


@pytest.mark.asyncio
async def test_navy_not_configured_returns_none(monkeypatch, mem_cache):
    monkeypatch.setattr(settings, "local_llm_api_key", "", raising=False)
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="реальный ответ", max_score=5.0, rubric=RUBRIC,
    )
    assert g is None


@pytest.mark.asyncio
async def test_network_error_returns_none(monkeypatch, mem_cache):
    _patch_client(monkeypatch, exc=httpx.ConnectError("navy down"))
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="реальный ответ", max_score=5.0, rubric=RUBRIC,
    )
    assert g is None


@pytest.mark.asyncio
async def test_upstream_5xx_returns_none(monkeypatch, mem_cache):
    _patch_client(monkeypatch, response=_FakeResponse(503, "service unavailable"))
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="реальный ответ", max_score=5.0, rubric=RUBRIC,
    )
    assert g is None


@pytest.mark.asyncio
async def test_non_json_content_returns_none(monkeypatch, mem_cache):
    _patch_client(monkeypatch, response=_FakeResponse(200, "I think this is a good answer, 8/10"))
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="реальный ответ", max_score=5.0, rubric=RUBRIC,
    )
    assert g is None


@pytest.mark.asyncio
async def test_retry_recovers_transient_failure(monkeypatch, mem_cache):
    # First navy call fails transiently; the one retry succeeds → real grade,
    # NOT a needless drop to grading_pending.
    state = {"n": 0}
    good = json.dumps({"score": 70, "covered": ["kp1"], "missed": [], "feedback": "ok"})

    class _Seq:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, headers=None, json=None):
            state["n"] += 1
            if state["n"] == 1:
                raise httpx.ConnectError("transient")
            return _FakeResponse(200, good)

    monkeypatch.setattr(exam_grader.httpx, "AsyncClient", lambda *a, **k: _Seq())
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="ответ", max_score=10.0, rubric=RUBRIC_NO_REQ,
    )
    assert g is not None and g.percent == 70
    assert state["n"] == 2  # retried exactly once


@pytest.mark.asyncio
async def test_timeout_does_not_retry(monkeypatch, mem_cache):
    # A timeout already consumed the full budget; retrying would re-hold the
    # request (and its attempt row lock). It must fail fast to pending, no retry.
    state = {"n": 0}

    class _Timeout:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, headers=None, json=None):
            state["n"] += 1
            raise httpx.TimeoutException("slow navy")

    monkeypatch.setattr(exam_grader.httpx, "AsyncClient", lambda *a, **k: _Timeout())
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="ответ", max_score=10.0, rubric=RUBRIC_NO_REQ,
    )
    assert g is None
    assert state["n"] == 1  # timeout → no retry


@pytest.mark.asyncio
async def test_retry_gives_up_after_max_attempts(monkeypatch, mem_cache):
    state = {"n": 0}

    class _AlwaysFail:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, headers=None, json=None):
            state["n"] += 1
            raise httpx.ConnectError("down")

    monkeypatch.setattr(exam_grader.httpx, "AsyncClient", lambda *a, **k: _AlwaysFail())
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="ответ", max_score=10.0, rubric=RUBRIC_NO_REQ,
    )
    assert g is None
    assert state["n"] == exam_grader._MAX_ATTEMPTS  # bounded, no infinite retry


@pytest.mark.asyncio
async def test_fenced_json_is_parsed(monkeypatch, mem_cache):
    fenced = "```json\n" + json.dumps({"score": 60, "covered": ["kp1", "kp2"], "missed": [], "feedback": "x"}) + "\n```"
    _patch_client(monkeypatch, response=_FakeResponse(200, fenced))
    g = await exam_grader.grade_item(
        item_id="i1", item_type="case_analysis", prompt="p",
        user_answer="ответ", max_score=10.0, rubric=RUBRIC_NO_REQ,
    )
    assert g is not None
    assert g.percent == 60
    assert g.score == 6.0
