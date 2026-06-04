"""Tests for 5-layer scoring engine with TZ weights."""

import pytest

from app.services.scoring import (
    _has_pattern,
    _score_communication,
    _score_objection_handling,
    _score_result,
)
from app.services.script_checker import ANTI_PATTERNS


class TestCommunication:
    def test_polite_scores_high(self):
        msgs = [
            "Здравствуйте, меня зовут Иван",
            "Спасибо за ваше время",
            "Пожалуйста, расскажите подробнее",
        ]
        score, details = _score_communication(msgs)
        assert score >= 10
        assert details["polite_markers"] >= 2

    def test_empty_scores_zero(self):
        score, _ = _score_communication([])
        assert score == 0.0


class TestObjectionHandling:
    def test_no_objections_half_credit(self):
        """When the conversation has no objections at all the scorer
        awards half credit (the scenario was easy, not perfectly
        handled). Pre-V3_RESCALE this branch returned full 25.0;
        the V3_RESCALE = 0.75 + half-credit logic at scoring.py:349
        sets the value to 9.375."""
        score, details = _score_objection_handling(
            user_messages=["Здравствуйте"],
            assistant_messages=["Добрый день"],
        )
        assert score == 9.375
        assert details["objections_found"] == 0

    def test_acknowledged_objection(self):
        """``Я вас понимаю`` matches ACKNOWLEDGE_PATTERNS, setting
        both ``heard`` and ``acknowledged``. Raw score = 10, after
        V3_RESCALE = 0.75 → final 7.5."""
        score, details = _score_objection_handling(
            user_messages=["Я вас понимаю, давайте разберёмся"],
            assistant_messages=["Зачем мне это, у меня уже есть кредит"],
        )
        assert score == 7.5
        assert details["heard"] is True


class TestResult:
    """L5 — P3: «Корректность рекомендации» (legal path), not a sales deal.

    The layer grades the CONSULTANT's turns (``user_messages``) for a correct
    procedural recommendation under ФЗ-127 and a concrete lawful next step.
    """

    def test_correct_path_recommended(self):
        """A grounded реструктуризация recommendation earns path credit.
        procedure + grounding = 4.0 raw × V3_RESCALE 0.75 = 3.0."""
        user_msgs = [
            "Расскажите про ваши долги и доход.",
            "Исходя из вашей ситуации, подойдёт реструктуризация долгов "
            "с планом погашения.",
        ]
        score, details = _score_result(user_msgs, [])
        assert score >= 3.0
        assert details["path_recommended"] is True
        assert details["path_grounded_in_situation"] is True

    def test_empty_scores_zero(self):
        score, _ = _score_result([], [])
        assert score == 0.0

    def test_debtor_assent_is_not_scored(self):
        # The AI debtor's "ладно, давайте" used to trigger a deal outcome.
        # P3: L5 reads the consultant's turns, so a bare debtor assent with
        # no procedural recommendation earns nothing.
        score, details = _score_result(["Ладно, давайте"], [])
        assert details["path_recommended"] is False
        assert details["next_step_given"] is False
        assert score == 0.0


class TestHasPattern:
    def test_finds_pattern(self):
        assert _has_pattern("не уверен в этом", [r"не\s*уверен"]) is True

    def test_no_match(self):
        assert _has_pattern("всё хорошо", [r"не\s*уверен"]) is False


class TestAntiPatterns:
    def test_anti_patterns_structure(self):
        assert "false_promises" in ANTI_PATTERNS
        assert "intimidation" in ANTI_PATTERNS
        assert "incorrect_info" in ANTI_PATTERNS
        for category, phrases in ANTI_PATTERNS.items():
            assert len(phrases) >= 2
            for phrase in phrases:
                assert isinstance(phrase, str)
