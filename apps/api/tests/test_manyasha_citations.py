"""Регресс: Маняша прогоняет свой ответ через check_citations (юр-точность).

Симптом до фикса: ассистент мог процитировать статью ФЗ-127, которой нет в
retrieved-источниках (галлюцинация), и это никак не детектилось — ``grounded``
означал лишь «инструмент что-то вернул», не «цитаты верны». Теперь
``run_agent_turn`` сверяет цитаты через ``check_citations`` и проставляет
``citation_status``; ``hallucinated`` / ``partial`` логируются как юр-риск.

Тест воспроизводит ту же адаптацию ``used_chunks`` (dict) → ``check_citations``,
что стоит в ``run_agent_turn`` (used_chunks — словари, а валидатор читает
``.law_article`` как атрибут), и проверяет проброс поля в ``AgentResult``.
"""
from types import SimpleNamespace

from app.services.rag_grounding import check_citations
from app.services.knowledge_assistant import AgentResult


def _cite_ctx(used_chunks: dict) -> list:
    # Идентична адаптеру внутри run_agent_turn.
    return [
        SimpleNamespace(law_article=c.get("law_article", ""))
        for c in used_chunks.values()
    ]


def test_hallucinated_article_detected():
    # Источник — только про ст. 213.4; ответ цитирует ст. 999, которой нет в базе.
    used_chunks = {"c1": {"id": "c1", "law_article": "ст. 213.4 127-ФЗ"}}
    check = check_citations(
        "Согласно ст. 999 вы подлежите банкротству.", _cite_ctx(used_chunks)
    )
    assert check.status == "hallucinated"
    assert "999" in check.unsupported_articles


def test_grounded_article_passes():
    used_chunks = {"c1": {"id": "c1", "law_article": "ст. 213.4 127-ФЗ"}}
    check = check_citations(
        "По ст. 213.4 подаётся заявление о банкротстве.", _cite_ctx(used_chunks)
    )
    assert check.status == "grounded"


def test_no_chunks_is_no_context():
    # Маняша ответила без источников — enforcement невозможен → no_context (не ошибка).
    check = check_citations("Банкротство — это судебная процедура.", _cite_ctx({}))
    assert check.status == "no_context"


def test_agent_result_carries_citation_status():
    # Контракт: поле проброшено в AgentResult (FE/аналитика его читают),
    # дефолт — безопасный no_context.
    assert AgentResult(content="x", citation_status="hallucinated").citation_status == "hallucinated"
    assert AgentResult(content="y").citation_status == "no_context"
