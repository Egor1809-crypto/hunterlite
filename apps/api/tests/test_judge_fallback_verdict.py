"""Reading a report must never manufacture scores or claims about the dialogue."""
from app.api.training import _apply_transcript_fallback_scores
from app.models.training import Message, MessageRole, TrainingSession


def test_pending_rude_dialogue_never_receives_forty_fallback_points():
    session = TrainingSession(scoring_details={"_scoring_pending": True})
    messages = [Message(role=MessageRole.user, content=text) for text in
                ["Привет", "ты мне сам дал Брат, не помнишь что лиЮ", "захотел и позвонил"]]
    messages += [Message(role=MessageRole.assistant, content="Вы кто?") for _ in range(3)]
    _apply_transcript_fallback_scores(session, messages)
    assert session.score_total is None
    assert session.scoring_details == {"_scoring_pending": True}
    assert session.feedback_text is None


def test_unavailable_analysis_does_not_award_keyword_points():
    session = TrainingSession(scoring_details={"_scoring_unavailable": True})
    _apply_transcript_fallback_scores(session, [Message(role=MessageRole.user,
        content="Понимаю давайте банкротство долг суд закон документы план шаг")])
    assert session.score_total is None
    assert "judge" not in session.scoring_details
