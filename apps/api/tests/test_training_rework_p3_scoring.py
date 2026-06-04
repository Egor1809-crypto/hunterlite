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
    L1_MAX,
    L2_MAX,
    L3_MAX,
    L5_MAX,
    L6_MAX,
    L8_MAX,
    L10_MAX,
    ScoreBreakdown,
    calculate_scores,
    compose_total_from_layers,
    generate_layer_explanations,
    _generate_rule_based_recommendations,
)


# ──────────────────────────────────────────────────────────────────────────
# Shared helpers
# ──────────────────────────────────────────────────────────────────────────

def _full_breakdown(**overrides) -> ScoreBreakdown:
    """A ScoreBreakdown with every layer at (or near) its max, overridable.

    P3 reweight (legal consultation): caps are now the module constants
    L*_MAX — L1 18, L2 12, L3 12, L5 18, L6 5, L8 10, L10 +25 (span -10..+25).
    The sub-score details under ``human_factor`` / ``communication`` are
    stored NORMALIZED to [0, 1] (S3-07), so a "full" fixture uses 1.0 there,
    not the legacy raw 5.0. ``check_score`` stays on its raw 0-5 scale.
    """
    base = dict(
        script_adherence=L1_MAX,          # L1 18
        objection_handling=L2_MAX,        # L2 12
        communication=L3_MAX,             # L3 12
        anti_patterns=0.0,
        result=L5_MAX,                    # L5 18
        chain_traversal=L6_MAX,           # L6 5
        trap_handling=0.0,                # L7 dead
        human_factor=L8_MAX,              # L8 10
        narrative_progression=0.0,        # L9 dead
        legal_accuracy=L10_MAX,           # L10 +25 (full positive)
        total=100.0,
        details={
            # S3-07: L3/L8 sub-scores are normalized to [0, 1].
            "human_factor": {"composure_score": 1.0, "empathy_score": 1.0,
                             "patience_score": 1.0, "warmth_score": 1.0,
                             "empathy_check_score": 1.0},
            "communication": {"pace_score": 1.0, "control_score": 1.0,
                              "listening_score": 1.0, "empathy_score": 1.0,
                              "discovery_score": 10.0},
            "objection_handling": {"check_score": 5.0},  # raw 0-5 scale
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


# ──────────────────────────────────────────────────────────────────────────
# (d) WEIGHT MODEL of `total` — legal substance dominates rigid script
#     These two tests assert on the P3 reweight directly (the weighted sum
#     behind `total`), not on the regex layers. They FAIL on the pre-reweight
#     model where L1 (script) carried 22.5 and L5/L10 were capped at 7.5/±5,
#     so "follow the script" could outscore "give the correct legal advice".
# ──────────────────────────────────────────────────────────────────────────

def test_correct_legal_advice_to_cold_client_scores_high():
    """P3 weight model: correct legal advice (high L10 + high L5) to a cold
    client earns a HIGH total even when the rigid sales-script layer (L1) is
    low — the legal weight (L5 18 + L10 +25 = 43 of 100) dominates.

    FAILS on the pre-reweight model: L5 capped at 7.5 and L10 at ±5, so the
    same legal-heavy profile could not clear 70 — script adherence (old cap
    22.5) was the heaviest single lever.
    """
    total = compose_total_from_layers(
        script_adherence=3.0,          # low L1 — did not follow the rigid script
        objection_handling=9.0,        # decent soft skills
        communication=9.0,
        anti_patterns=0.0,
        result=L5_MAX,                 # L5 18 — correct procedural recommendation
        chain_traversal=3.0,
        human_factor=8.0,
        legal_accuracy=L10_MAX,        # L10 +25 — high legal accuracy
        judge_score=0.0,
    )
    assert total >= 70.0, total
    # And the legal core alone (L5 + L10) is the single largest contribution.
    assert (L5_MAX + L10_MAX) >= 0.4 * 100  # 43% of the whole scale


def test_script_following_without_legal_substance_scores_low():
    """P3 weight model: full script adherence (max L1) with ZERO legal
    substance (L5 = 0, L10 = 0) yields a LOW total (< 50) — following the
    script is not consulting.

    FAILS on the pre-reweight model where L1's 22.5 cap plus soft-skill
    layers could push such a transcript comfortably past 50 despite the
    consultant never giving a correct ФЗ-127 recommendation.
    """
    total = compose_total_from_layers(
        script_adherence=L1_MAX,       # L1 18 — perfect script adherence
        objection_handling=9.0,        # plausible soft skills
        communication=9.0,
        anti_patterns=0.0,
        result=0.0,                    # L5 0 — NO recommendation
        chain_traversal=2.0,
        human_factor=6.0,
        legal_accuracy=0.0,            # L10 0 — NO legal substance
        judge_score=0.0,
    )
    assert total < 50.0, total


def test_rule_based_recommendation_flags_uncovered_must_clarify():
    """P3 rubric consumption in the RULE-BASED layer: a persona session whose
    ``must_clarify`` items were not all covered produces a targeted legal
    recommendation naming the uncovered обстоятельства.

    FAILS on pre-P3 code: the rubric was consumed nowhere, so
    ``_generate_rule_based_recommendations`` had no persona_must_clarify block
    to read and never emitted the "Не выяснены ключевые обстоятельства" line.
    """
    bd = _full_breakdown(
        details={
            "script_adherence": {
                "persona_must_clarify": {
                    "covered": 1,
                    "total": 3,
                    "coverage": 0.33,
                    "items": [
                        {"item": "сумма долга", "covered": True, "classes": ["debt"]},
                        {"item": "наличие ипотеки", "covered": False, "classes": ["housing"]},
                        {"item": "сделки за 3 года", "covered": False, "classes": ["deals"]},
                    ],
                },
            },
        },
    )
    recs = _generate_rule_based_recommendations(bd)
    low = recs.lower()
    # The targeted must_clarify line is present and names the uncovered items.
    assert "не выяснены ключевые обстоятельства" in low
    assert "наличие ипотеки" in low
    assert "сделки за 3 года" in low
    # And it is grounded in ФЗ-127, not sales copy.
    assert "фз-127" in low or "127-фз" in low
    _assert_no_sales_phrase(recs, "must_clarify_recommendation")


# ──────────────────────────────────────────────────────────────────────────
# (e) P3.1: analytics.compute_session_radar mirrors ScoreBreakdown.skill_radar
# ──────────────────────────────────────────────────────────────────────────

class _StoredSession:
    """Lightweight stand-in carrying only the attributes compute_session_radar
    reads. We avoid instantiating the SQLAlchemy-mapped TrainingSession (its
    instrumented attributes need a session/state) — a plain object is enough
    since compute_session_radar only does attribute access.
    """
    def __init__(self, **kw):
        self.__dict__.update(kw)


def _session_from_breakdown(bd: ScoreBreakdown) -> "_StoredSession":
    """Build a stored-session view whose score_* fields + scoring_details carry
    exactly the layer values of ``bd``, so compute_session_radar reads the same
    inputs ScoreBreakdown.skill_radar reads off the dataclass.

    L6 is stored only as the raw 0-10 ``final_score`` inside
    scoring_details.chain_traversal (objection_chain.calculate_chain_score),
    so we materialize a final_score whose _normalize(·,10) equals
    _normalize(bd.chain_traversal, L6_MAX).
    """
    details = dict(bd.details)
    # chain_traversal stored shape: raw final_score on a 0-10 scale.
    l6_norm = bd.chain_traversal / L6_MAX if L6_MAX else 0.0
    details["chain_traversal"] = {"has_chain": True, "final_score": l6_norm * 10.0}
    return _StoredSession(
        score_script_adherence=bd.script_adherence,
        score_objection_handling=bd.objection_handling,
        score_communication=bd.communication,
        score_anti_patterns=bd.anti_patterns,
        score_result=bd.result,
        score_human_factor=bd.human_factor,
        score_legal=bd.legal_accuracy,
        scoring_details=details,
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {},  # perfect score
        # mid-score session across the shared axes
        dict(
            script_adherence=L1_MAX * 0.5,
            objection_handling=L2_MAX * 0.4,
            communication=L3_MAX * 0.6,
            anti_patterns=-7.0,
            result=L5_MAX * 0.5,
            chain_traversal=L6_MAX * 0.6,
            human_factor=L8_MAX * 0.7,
            legal_accuracy=3.0,
        ),
        # gross legal error (negative L10) — the axis that the old ±5 mapping
        # collapsed on the dashboard.
        dict(legal_accuracy=-8.0, result=L5_MAX * 0.3),
    ],
)
def test_compute_session_radar_mirrors_skill_radar(overrides):
    """P3.1: the dashboard radar (analytics.compute_session_radar, stored-data
    mirror) must equal the per-session radar (ScoreBreakdown.skill_radar) on
    the 6 shared axes after the cap reweight.

    FAILS on the pre-P3.1 analytics, which hardcoded the legacy v5 caps
    (22.5/18.75/7.5/3.75 and the ±5 L10 mapping) against new-scale stored
    fields — knowledge/objection_handling/stress/closing/legal were all
    distorted, the L10 axis worst of all.
    """
    from app.services.analytics import compute_session_radar

    bd = _full_breakdown(**overrides)
    expected = bd.skill_radar
    got = compute_session_radar(_session_from_breakdown(bd))

    for axis in ("empathy", "knowledge", "objection_handling",
                 "stress_resistance", "closing", "qualification"):
        assert abs(got[axis] - expected[axis]) <= 0.2, (
            f"axis {axis}: dashboard {got[axis]} != session {expected[axis]}"
        )


# ──────────────────────────────────────────────────────────────────────────
# (f) P3.1: L5 correct-path judging fires on the REAL seeded rubric
# ──────────────────────────────────────────────────────────────────────────

def test_l5_correct_path_consumes_real_seeded_rubric():
    """P3.1: _score_result reads the expected path from the validated rubric
    location (metrics.result.criteria), not the non-existent top-level
    correct_path/recommended_path keys.

    FAILS on pre-P3.1 code: it read rubric.get('correct_path') etc., which no
    seeded persona carries, so expected_path_class was never populated and the
    wrong_path_for_persona penalty never fired.
    """
    from app.services.scoring import _score_result
    from scripts.personas_data.persona_01_irina import PERSONA

    rubric = PERSONA["scoring_rubric"]

    # Persona 01 (Ирина) expects the restructuring path (metrics.result.criteria
    # mentions «реструктуризация при доходе»). A consultant who recommends THAT
    # path matches; one who pushes realization of property does not.
    right_msgs = [
        "При вашем стабильном доходе подойдёт реструктуризация долгов, "
        "план погашения, добросовестность обязательна. Подготовим документы.",
    ]
    _score, right = _score_result(right_msgs, None, rubric=rubric)
    assert right.get("expected_path_class") == "restructuring", right
    assert right.get("correct_path_match") is True, right
    assert "wrong_path_for_persona" not in right

    # Wrong path that is otherwise GROUNDED (mentions доход) so it would earn
    # full path credit — the persona penalty must cap it back to partial.
    wrong_msgs = [
        "Учитывая ваш доход, предлагаю реализацию имущества — "
        "всё продадут и спишут. Подготовим заявление.",
    ]
    _score2, wrong = _score_result(wrong_msgs, None, rubric=rubric)
    assert wrong.get("expected_path_class") == "restructuring", wrong
    assert wrong.get("correct_path_match") is False, wrong
    assert wrong.get("wrong_path_for_persona") is True, wrong
