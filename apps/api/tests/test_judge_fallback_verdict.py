"""Регресс-тест P0 (TRAINING_FLOW_REWORK).

Баг: при восстановлении отчёта по сохранённому транскрипту (технический обрыв)
fallback-словарь ``judge`` в ``_apply_transcript_fallback_scores`` НЕ содержал
ключа ``verdict``. Этот словарь доходит до фронта (``JudgeVerdictCard``), где
``getVerdictMeta(undefined)`` рисовал ``String(undefined)`` = строку "undefined".

Этот тест падает на до-P0 коде (KeyError/None на ``judge['verdict']``) и проходит
после фикса. Принадлежит blocking-scope: контракт «любой записанный judge несёт
verdict» защищает результирующую карточку от регрессии.
"""
from app.api.training import _apply_transcript_fallback_scores
from app.models.training import Message, MessageRole, TrainingSession

_ALLOWED_VERDICTS = {"positive", "good", "mixed", "poor", "negative", "red_flag"}


def _make_messages() -> list[Message]:
    return [
        Message(
            role=MessageRole.user,
            content="Здравствуйте, у меня долг около 800 тысяч рублей, "
            "подскажите, что делать по банкротству физлица?",
        ),
        Message(
            role=MessageRole.assistant,
            content="Расскажите подробнее о вашей ситуации и кредиторах.",
        ),
        Message(
            role=MessageRole.user,
            content="Какие документы нужны и какой план действий по процедуре?",
        ),
    ]


def test_transcript_fallback_judge_carries_verdict():
    """fallback judge обязан нести непустой verdict (иначе фронт = 'undefined')."""
    session = TrainingSession()
    session.scoring_details = None

    _apply_transcript_fallback_scores(session, _make_messages())

    details = session.scoring_details or {}
    judge = details.get("judge")
    assert judge is not None, "fallback обязан записать словарь judge"
    verdict = judge.get("verdict")
    assert verdict, "judge.verdict обязателен и непуст — иначе JudgeVerdictCard рисует 'undefined'"
    assert verdict in _ALLOWED_VERDICTS, f"неожиданный verdict: {verdict!r}"
    assert judge.get("rationale_ru"), "judge.rationale_ru должен быть непустым (спокойное RU-пояснение)"


def test_transcript_fallback_noop_without_user_messages():
    """Без пользовательских сообщений отчёт не восстанавливается (ранний выход)."""
    session = TrainingSession()
    session.scoring_details = None
    _apply_transcript_fallback_scores(
        session,
        [Message(role=MessageRole.assistant, content="Только ассистент, нет юзера.")],
    )
    # Ничего не записано — нет ложного judge без контента.
    assert (session.scoring_details or {}).get("judge") is None
