"""Regression (ultrareview F3):
- M16: RAG PII sanitization must keep high-confidence PII (phone/passport) but
  NOT blank legal reference numbers / sums / contiguous digit-runs in the corpus.
- M17: role-break disclaimers must be STRIPPED from AI output, not just flagged.
"""
from app.services.content_filter import _sanitize_rag_field, filter_ai_output

BLANK = "[ДАННЫЕ СКРЫТЫ]"


def test_rag_keeps_legal_numbers_and_sums():
    legal = ("Согласно ст. 213.4 и ст. 223.2 ФЗ-127 при долге свыше 500 000 руб "
             "и просрочке более 3 месяцев; ОГРН 1234567890123 указан для справки.")
    cleaned, violations = _sanitize_rag_field(legal, "fact_text")
    assert BLANK not in cleaned, f"legal reference numbers must not be blanked: {cleaned}"
    assert "213.4" in cleaned and "500 000" in cleaned


def test_rag_still_blanks_real_phone():
    pii = "Звоните клиенту по номеру +7 999 123 45 67 для уточнения."
    cleaned, violations = _sanitize_rag_field(pii, "fact_text")
    assert BLANK in cleaned
    assert any(v.startswith("rag_pii") for v in violations)


def test_rag_still_blanks_passport():
    pii = "Паспорт 4509 123456 приложен к заявлению."
    cleaned, _ = _sanitize_rag_field(pii, "fact_text")
    assert BLANK in cleaned


def test_role_break_phrase_is_stripped():
    out, violations = filter_ai_output("Как языковая модель, я думаю, что банкротство подойдёт.")
    assert "role_break" in violations
    assert "языковая модель" not in out.lower()
