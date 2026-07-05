"""Регресс: звонок проходит через ConversationCompletionPolicy (TZ-1 §3).

До фикса ``ws/call.py:_do_end_call`` писал score напрямую в TrainingSession, но
НЕ ставил ``status=completed`` и НЕ эмитил канонический ``session.completed``
DomainEvent — звонок оставался ``status=active`` и выпадал из ``/history/unified``
и CRM-таймлайна (в отличие от чат-тренинга, который идёт через
``finalize_training_session``). Финализация обёрнута в try/except, чтобы её сбой
не ломал выдачу скора (паттерн как в ws/training.py).
"""
import inspect

from app.ws import call


def test_end_call_goes_through_completion_policy():
    src = inspect.getsource(call._do_end_call)
    assert "finalize_training_session" in src, (
        "звонок не проходит через ConversationCompletionPolicy — останется active"
    )
    assert "CompletedVia.ws" in src
    # финализация не должна ронять скоринг
    assert "except Exception" in src


def test_hangup_marks_call_outcome_for_terminal_reason():
    src = inspect.getsource(call._handle_user_turn)
    assert 'state["call_outcome"] = "hangup"' in src, (
        "hangup не отмечается в state — терминальный reason будет неверным"
    )
