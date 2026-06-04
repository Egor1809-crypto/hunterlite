"""P3 (training-rework) regression tests — scoring: sales → legal consultation.

These three tests protect the P3 contract and FAIL on pre-P3 code:

  (a) ``persona.scoring_rubric`` is CONSUMED by ``calculate_scores`` — the
      per-session rubric target/weight is applied to the L1/L2/L3/L5 layers
      and surfaced as ``details["rubric_eval"]``. Pre-P3, ``scoring_rubric``
      was loaded nowhere (TZ §C: "ReferencePersona.scoring_rubric — НЕ
      используется скорингом") so the key never appears.

  (b) The skill radar does NOT collapse when L7 (traps) and L9 (narrative)
      are dead after de-gamification. With L1/L10/L2 live and L7/L9 pinned
      at 0, the knowledge / legal_knowledge / objection_handling axes must
      stay near their full span (the dead-layer weight was folded into the
      live layers). Pre-P3 those axes are capped well below 100 because the
      zeroed L7 still carried 0.3 / 0.4 / 0.2 of each axis.

  (c) User-facing scoring strings use the legal-consultation vocabulary, not
      the cold-sales vocabulary ("скрипт продаж", "сделка", "закрытие").
      Pre-P3 the layer labels and recommendations were sales copy.

Blocking scope: registered in .github/workflows/ci.yml (TZ-1 / regression
fence). Pure-function tests where possible; the rubric-consumption test
drives the real ``calculate_scores`` pipeline against the test DB.
"""

import uuid
from datetime import datetime, timezone

import pytest

from app.models.reference_persona import ReferencePersona
from app.models.scenario import Scenario, ScenarioType
from app.models.training import (
    Message,
    MessageRole,
    SessionStatus,
    TrainingSession,
)
from app.models.user import User
from app.services.scoring import (
    ScoreBreakdown,
    calculate_scores,
    generate_layer_explanations,
    _generate_rule_based_recommendations,
)


# ──────────────────────────────────────────────────────────────────────────
# Shared helpers
# ──────────────────────────────────────────────────────────────────────────

def _full_breakdown(**overrides) -> ScoreBreakdown:
    """A ScoreBreakdown with every layer at (or near) its max, overridable."""
    base = dict(
        script_adherence=22.5,
        objection_handling=18.75,
        communication=15.0,
        anti_patterns=0.0,
        result=7.5,
        chain_traversal=7.5,
        trap_handling=0.0,          # L7 dead
        human_factor=15.0,
        narrative_progression=0.0,  # L9 dead
        legal_accuracy=5.0,
        total=100.0,
        details={
            "human_factor": {"composure_score": 5.0, "empathy_score": 5.0,
                             "patience_score": 5.0, "warmth_score": 5.0},
            "communication": {"pace_score": 1.0, "control_score": 1.0,
                              "listening_score": 1.0, "discovery_score": 10.0},
            "objection_handling": {"check_score": 5.0},
            "trap_handling": {"traps": []},
        },
        time_management=5.0,
        adaptation=0.0,
    )
    base.update(overrides)
    return ScoreBreakdown(**base)


# ──────────────────────────────────────────────────────────────────────────
# (a) persona.scoring_rubric is consumed by calculate_scores
# ──────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_persona_scoring_rubric_is_consumed(db_session):
    """P3: a session started from a ReferencePersona applies that persona's
    rubric to L1/L2/L3/L5 and surfaces ``details["rubric_eval"]``.

    FAILS on pre-P3 code: ``scoring_rubric`` was loaded nowhere, so the
    ``rubric_eval`` key is never written into the scoring details.

    P3-fix: ``scoring`` now imports ``settings`` from ``app.config`` directly,
    so no module-level monkeypatch stub is needed — the default
    ``scoring_parallel_layers`` path is exercised end-to-end as in production.
    """
    user = User(
        id=uuid.uuid4(),
        email=f"consult-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="x",
        full_name="Тест Консультант",
    )
    scenario = Scenario(
        id=uuid.uuid4(),
        title="Юр-консультация ФЗ-127",
        description="Должник с долгами по кредитам.",
        scenario_type=ScenarioType.consultation,
        # no script_id → L1 checkpoint scoring is skipped (fine for this test)
    )
    persona = ReferencePersona(
        id=uuid.uuid4(),
        slug=f"persona-test-{uuid.uuid4().hex[:8]}",
        name="Ирина Петрова",
        archetype="anxious_debtor",
        profession="бухгалтер",
        lead_source="заявка с сайта",
        cached_dossier="Долг 800 000 ₽, доход 45 000 ₽, ипотека.",
        scoring_rubric={
            "metrics": {
                "script_adherence": {"target": 0.6, "weight": 0.3},
                "objection_handling": {"target": 0.5, "weight": 0.3},
                "communication": {"target": 0.5, "weight": 0.2},
                "result": {"target": 0.4, "weight": 0.2},
            },
            "must_clarify": ["сумма долга", "доход", "наличие ипотеки"],
            "red_flags": ["обещание гарантированного списания"],
        },
    )
    session = TrainingSession(
        id=uuid.uuid4(),
        user_id=user.id,
        scenario_id=scenario.id,
        status=SessionStatus.completed,
        started_at=datetime.now(timezone.utc),
        ended_at=datetime.now(timezone.utc),
        emotion_timeline=[{"state": "cold"}, {"state": "considering"}],
        custom_params={"reference_persona_slug": persona.slug},
    )
    # Consultant turns that exercise the regex layers deterministically.
    msgs = [
        Message(id=uuid.uuid4(), session_id=session.id, role=MessageRole.assistant,
                content="Боюсь, у меня отнимут квартиру.", sequence_number=1),
        Message(id=uuid.uuid4(), session_id=session.id, role=MessageRole.user,
                content="Понимаю ваше беспокойство. Расскажите про сумму долга и доход.",
                sequence_number=2),
        Message(id=uuid.uuid4(), session_id=session.id, role=MessageRole.user,
                content="Исходя из вашей ситуации подойдёт реструктуризация долгов; "
                        "следующий шаг — подготовить документы и подать заявление.",
                sequence_number=3),
    ]
    db_session.add_all([user, scenario, persona, session, *msgs])
    await db_session.commit()

    breakdown = await calculate_scores(session.id, db_session)

    rubric_eval = breakdown.details.get("rubric_eval")
    assert rubric_eval is not None, (
        "P3 regression: persona.scoring_rubric was not consumed — "
        "details['rubric_eval'] missing (pre-P3 behaviour)."
    )
    assert rubric_eval["persona_slug"] == persona.slug
    # All four mapped layers (L1/L2/L3/L5) must have an attainment evaluation.
    assert set(rubric_eval["metrics"].keys()) == {
        "script_adherence", "objection_handling", "communication", "result",
    }
    for mkey, ev in rubric_eval["metrics"].items():
        assert ev["target"] > 0, mkey
        assert ev["attainment"] is not None, mkey
        assert "met" in ev, mkey
    # The persona's checklist is forwarded for the judge / results UI.
    assert rubric_eval["must_clarify"] == ["сумма долга", "доход", "наличие ипотеки"]
    assert rubric_eval["red_flags"] == ["обещание гарантированного списания"]


# ──────────────────────────────────────────────────────────────────────────
# (a2) the persona rubric checklist actually reaches the α-judge prompt
# ──────────────────────────────────────────────────────────────────────────

def test_judge_prompt_embeds_persona_rubric_checklist():
    """P3 (recon-addendum E): when a persona rubric supplies must_clarify /
    red_flags, the built judge user-prompt contains the «Эталонный чек-лист
    консультации» block with those items.

    FAILS on the half-wired state where ``judge_transcript`` was called
    without ``must_clarify`` / ``red_flags_checklist`` — ``_build_rubric_block``
    then received None/None and returned '' (dead code).
    """
    from app.services.scoring_llm_judge import _build_user_prompt

    prompt = _build_user_prompt(
        transcript="M[1]: Расскажите про долг.\nК: Боюсь за квартиру.",
        archetype="anxious_debtor",
        emotion_arc=["cold", "considering"],
        call_outcome="unknown",
        must_clarify=["сумма долга", "наличие ипотеки"],
        red_flags_checklist=["обещание гарантированного списания"],
    )
    assert "Эталонный чек-лист консультации" in prompt
    assert "сумма долга" in prompt
    assert "наличие ипотеки" in prompt
    assert "обещание гарантированного списания" in prompt

    # And the no-rubric path stays clean (no checklist header leaks in).
    empty = _build_user_prompt(
        transcript="M[1]: Здравствуйте.",
        archetype=None,
        emotion_arc=[],
        call_outcome="unknown",
    )
    assert "Эталонный чек-лист консультации" not in empty


# ──────────────────────────────────────────────────────────────────────────
# (b) radar does not collapse on dead L7 / L9
# ──────────────────────────────────────────────────────────────────────────

def test_radar_axes_do_not_collapse_on_dead_traps_and_narrative():
    """P3: with L1/L2/L10 at max and L7 (traps) / L9 (narrative) dead (=0),
    the knowledge / legal_knowledge / objection_handling axes keep their full
    span — the dead-layer weight was folded into the live layers.

    FAILS on pre-P3 code, where the zeroed L7 still carried 0.3 / 0.4 / 0.2
    of each axis and capped them at ~70 / ~80 / ~80.
    """
    radar = _full_breakdown(
        trap_handling=0.0,          # L7 dead
        narrative_progression=0.0,  # L9 dead
    ).skill_radar

    # knowledge = L1·0.4 + L10·0.6 (was L1·0.3 + L10·0.4 + L7·0.3 → cap 70)
    assert radar["knowledge"] >= 95, radar["knowledge"]
    # objection_handling = L2·0.6 + L6·0.4 (was +L7·0.2 → cap 80)
    assert radar["objection_handling"] >= 95, radar["objection_handling"]
    # legal_knowledge = L10·1.0 (was 0.6·L10 + 0.4·legal-traps → cap 80)
    assert radar["legal_knowledge"] >= 95, radar["legal_knowledge"]

    # The L11 "adaptation" (sales-archetype) axis must be gone — a 0-pinned
    # axis misreads as a real weakness.
    assert "adaptation" not in radar


# ──────────────────────────────────────────────────────────────────────────
# (c) user-facing scoring strings use legal vocabulary, not sales
# ──────────────────────────────────────────────────────────────────────────

# Cold-sales phrases that must NOT appear in any user-facing scoring string.
_SALES_FORBIDDEN = [
    "скрипт продаж",
    "следование скрипту",
    "сделка",
    "закрытие",
    "воронка продаж",
    "встреча назначена",
    "менеджер",
]


def _assert_no_sales_phrase(text: str, where: str) -> None:
    low = text.lower()
    for phrase in _SALES_FORBIDDEN:
        assert phrase not in low, f"sales phrase '{phrase}' leaked into {where}: {text!r}"


def test_layer_explanation_labels_are_legal_not_sales():
    """P3: layer labels and summaries are legal-consultation copy. L7/L9 are
    hidden entirely.

    FAILS on pre-P3 code where L1 was labelled «Следование скрипту», L5
    «Закрытие», and L7/L9 were emitted.
    """
    bd = _full_breakdown()
    explanations = generate_layer_explanations(bd, messages=[])

    emitted_layers = {e.layer for e in explanations}
    # L7 (traps) and L9 (narrative) are dead → must not appear.
    assert "L7" not in emitted_layers
    assert "L9" not in emitted_layers

    for e in explanations:
        _assert_no_sales_phrase(e.label, f"label[{e.layer}]")
        _assert_no_sales_phrase(e.summary, f"summary[{e.layer}]")

    # Positive: the legal relabels are present.
    labels = {e.layer: e.label for e in explanations}
    assert "выяснени" in labels["L1"].lower()          # «Полнота выяснения обстоятельств»
    assert "правов" in labels["L10"].lower()           # «Правовая точность ФЗ-127»


def test_rule_based_recommendations_are_legal_not_sales():
    """P3: the rule-based recommendation copy is legal, not sales.

    FAILS on pre-P3 code where the L5 rec said «Закрытие: предлагайте слоты
    для встречи» and L1 «Следование скрипту».
    """
    # Drive every LAYER_RULES branch by zeroing the layers (low score → rec).
    low = _full_breakdown(
        script_adherence=0.0,
        objection_handling=0.0,
        communication=0.0,
        human_factor=0.0,
        result=0.0,
        chain_traversal=0.0,
        anti_patterns=-5.0,
        legal_accuracy=-3.0,
    )
    recs = _generate_rule_based_recommendations(low)
    _assert_no_sales_phrase(recs, "rule_based_recommendations")
    # Positive: legal vocabulary present.
    low_recs = recs.lower()
    assert "фз-127" in low_recs or "127-фз" in low_recs
    assert "реструктуризац" in low_recs or "реализац" in low_recs
