"""Quality points require attributable evidence; transport/verbosity earns nothing."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import conversation_quality as quality

SOURCE = {
    "id": "law-1",
    "text": "Проверенная учебная норма для конкретной ситуации.",
    "article": "Учебный источник",
}
HISTORY = [
    {"role": "assistant", "content": "Клиент сам всё рассказал."},
    {
        "role": "user",
        "content": "Здравствуйте. Меня зовут Иван, я юрист. Удобно обсудить вашу заявку?",
    },
]


def award(id="introduction", **kw):
    return {
        "criterion": id,
        "quality": 1,
        "message_index": 1,
        "quote": HISTORY[1]["content"],
        "explanation": "Юрист представился и согласовал разговор.",
        **kw,
    }


def raw(awards=None, violations=None):
    return {
        "awards": awards or [],
        "violations": violations or [],
        "summary": "Подтверждены только действия из приведённых реплик.",
    }


def violation(category="disrespect", **kw):
    return {
        "category": category,
        "message_index": 1,
        "quote": HISTORY[1]["content"],
        "explanation": "Подтверждённое нарушение в учебном примере.",
        **kw,
    }


def test_rubric_totals_one_hundred():
    assert sum(c.points for c in quality.CRITERIA) == 100


def test_no_automatic_points_for_length_calm_client_or_keyword_stuffing():
    for transcript in [
        HISTORY,
        HISTORY * 30,
        [{"role": "user", "content": "понимаю давайте суд закон банкротство"}],
    ]:
        assert quality.aggregate_assessment(raw(), transcript, [])["total"] == 0


def test_one_correct_short_turn_earns_exactly_demonstrated_action():
    result = quality.aggregate_assessment(raw([award()]), HISTORY, [])
    assert result["total"] == 4
    assert quality.to_breakdown(result).communication == 4
    assert quality.to_breakdown(result).legal_accuracy == 0
    assert quality.to_breakdown(result).skill_radar["legal_accuracy"] == 0


def test_partial_action_earns_half_not_full():
    assert quality.aggregate_assessment(raw([award(quality=0.5)]), HISTORY, [])["total"] == 2


@pytest.mark.parametrize(
    "change",
    [
        dict(message_index=0, quote="Клиент сам всё рассказал."),
        dict(quote="Никогда не произнесённая фраза"),
        dict(criterion="invented"),
        dict(quality=0.7),
    ],
)
def test_unverifiable_awards_cannot_become_a_grade(change):
    with pytest.raises(ValueError):
        quality.aggregate_assessment(raw([award(**change)]), HISTORY, [])


def test_repeated_action_is_not_counted_twice():
    with pytest.raises(ValueError):
        quality.aggregate_assessment(raw([award(), award()]), HISTORY, [])


@pytest.mark.parametrize("legal", ["award", "violation"])
def test_legal_judgment_requires_a_verified_source_quote(legal):
    r = (
        raw([award("legal_property")])
        if legal == "award"
        else raw(violations=[violation("legal_error")])
    )
    with pytest.raises(ValueError):
        quality.aggregate_assessment(r, HISTORY, [SOURCE])


def test_invented_source_is_rejected():
    with pytest.raises(ValueError):
        quality.aggregate_assessment(
            raw([award("legal_property", source_id="wrong", source_quote=SOURCE["text"])]),
            HISTORY,
            [SOURCE],
        )


def test_full_demonstration_can_score_hundred_without_length_multiplier():
    awards = [
        award(c.id, source_id=SOURCE["id"], source_quote=SOURCE["text"]) for c in quality.CRITERIA
    ]
    report = quality.aggregate_assessment(raw(awards), HISTORY, [SOURCE])
    assert report["total"] == 100
    assert sum(r["score"] for r in report["layers"]) == 100


def test_mild_rudeness_has_no_automatic_legal_penalties():
    report = quality.aggregate_assessment(raw(violations=[violation()]), HISTORY, [])
    q = report["scoring_details"]["_quality_assessment"]
    assert report["total"] == 0
    assert q["penalty"] == -10
    assert [d["category"] for d in q["deductions"]] == ["disrespect"]


def test_critical_abuse_caps_an_otherwise_perfect_conversation():
    awards = [
        award(c.id, source_id=SOURCE["id"], source_quote=SOURCE["text"]) for c in quality.CRITERIA
    ]
    report = quality.aggregate_assessment(
        raw(awards, [violation(), violation("severe_abuse"), violation("severe_abuse")]),
        HISTORY,
        [SOURCE],
    )
    q = report["scoring_details"]["_quality_assessment"]
    assert q["positive"] == 100 and q["penalty"] == -25
    assert report["total"] == 20 and q["cap"] == 20


def test_wrong_legal_claim_cannot_simultaneously_earn_accuracy_points():
    provenance = dict(source_id=SOURCE["id"], source_quote=SOURCE["text"])
    report = quality.aggregate_assessment(
        raw([award("legal_property", **provenance)], [violation("legal_error", **provenance)]),
        HISTORY,
        [SOURCE],
    )
    assert report["scoring_details"]["_quality_assessment"]["positive"] == 0


def test_unverifiable_legal_claim_is_unavailable_not_marked_wrong():
    with pytest.raises(quality.AssessmentUnavailable):
        quality.aggregate_assessment(
            {
                **raw(),
                "unverified_legal_claims": [
                    {k: v for k, v in violation().items() if k != "category"}
                ],
            },
            HISTORY,
            [SOURCE],
        )


@pytest.mark.asyncio
async def test_empty_turns_score_zero_without_model_or_database(monkeypatch):
    model = AsyncMock()
    monkeypatch.setattr(quality, "_invoke", model)
    result = await quality.assess_conversation([{"role": "user", "content": "  "}], db=None)
    assert result["total"] == 0
    model.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "response",
    [
        RuntimeError("offline"),
        {
            "awards": [award(quote="Чужая цитата")],
            "violations": [],
            "summary": "Недостоверный ответ модели.",
        },
    ],
)
async def test_failed_or_hallucinated_assessment_never_produces_points(monkeypatch, response):
    from app.services import rag_legal

    monkeypatch.setattr(
        rag_legal,
        "retrieve_legal_context",
        AsyncMock(
            return_value=SimpleNamespace(
                results=[
                    SimpleNamespace(
                        chunk_id=SOURCE["id"],
                        fact_text=SOURCE["text"],
                        law_article=SOURCE["article"],
                        knowledge_status="actual",
                    )
                ]
            )
        ),
    )
    model = (
        AsyncMock(side_effect=response)
        if isinstance(response, Exception)
        else AsyncMock(return_value=response)
    )
    monkeypatch.setattr(quality, "_invoke", model)
    with pytest.raises(quality.AssessmentUnavailable):
        await quality.assess_conversation(HISTORY, db=None)


@pytest.mark.asyncio
async def test_voice_and_text_share_identical_evidence_result(monkeypatch):
    from contextlib import asynccontextmanager

    from app import database
    from app.services import call_pipeline, scoring

    report = quality.aggregate_assessment(raw([award()]), HISTORY, [])
    assessor = AsyncMock(return_value=report)
    monkeypatch.setattr(quality, "assess_session", assessor)

    @asynccontextmanager
    async def db():
        yield None

    monkeypatch.setattr(database, "async_session", db)
    text = await scoring.calculate_scores("session", None)
    voice = await call_pipeline.score_call(
        session_id="session", user_messages=[], assistant_messages=[], history=HISTORY
    )
    assert text.total == voice["total"] == 4
    assert text.details == voice["scoring_details"]
