"""Tests for the Manyasha knowledge agent (ТЗ-3).

Covers the acceptance gaps the TZ calls out (§6 DoD, §7 skeptics):
  * the tool-use loop actually calls a tool and grounds the answer on the
    returned chunks (`used_chunks` populated, tool_trace recorded);
  * graceful degradation when navy/circuit-breaker is unavailable — the user
    turn is never lost and the assistant turn is marked failed (§5);
  * the empty-``content`` → ``reasoning_content`` fallback in the pool client
    (§2.3), which is what makes a reasoning model like deepseek-v4-pro usable;
  * server memory: a follow-up message receives the prior turns as history
    (the "does it really remember?" check, §6.1 / §7б).
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

import app.services.knowledge_assistant as ka
import app.services.llm as llm
from app.services.rag_legal import RAGContext, RAGResult


def _llm_response(content="", tool_calls=None):
    return llm.LLMResponse(
        content=content,
        model="local:deepseek-v4-pro",
        input_tokens=10,
        output_tokens=20,
        latency_ms=5,
        tool_calls=tool_calls,
    )


def _fake_rag_ctx():
    return RAGContext(
        query="порог долга",
        results=[
            RAGResult(
                chunk_id=uuid.uuid4(),
                category="eligibility",
                fact_text="Минимальный долг для банкротства гражданина — 500 000 руб.",
                law_article="127-ФЗ ст. 213.3",
                relevance_score=0.91,
            )
        ],
        method="hybrid",
    )


@pytest.mark.asyncio
async def test_agent_tool_loop_grounds_on_chunks(db_session):
    """The model asks for a tool, we run it, and the final answer is grounded
    on the returned chunk (used_chunks + tool_trace populated)."""
    calls = {"n": 0}

    async def fake_backoff(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            return _llm_response(tool_calls=[{
                "id": "call-1",
                "name": "search_knowledge_base",
                "arguments": {"query": "порог долга для банкротства"},
            }])
        return _llm_response(content="Порог — 500 000 ₽ (ст. 213.3 ФЗ-127).")

    with patch.object(llm, "_call_with_backoff", new=fake_backoff), \
         patch.object(ka, "retrieve_legal_context", new=AsyncMock(return_value=_fake_rag_ctx())):
        result = await ka.run_agent_turn(
            history=[{"role": "user", "content": "Какой порог долга для банкротства?"}],
            db=db_session,
            user_id=uuid.uuid4(),
        )

    assert result.status == "ok"
    assert "500 000" in result.content
    assert calls["n"] == 2, "expected one tool round + one final text round"
    assert any(t["name"] == "search_knowledge_base" for t in result.tool_trace)
    assert result.used_chunks, "answer must carry the grounding chunks"
    assert result.used_chunks[0]["law_article"] == "127-ФЗ ст. 213.3"


@pytest.mark.asyncio
async def test_tool_call_id_synced_when_provider_returns_null_id(db_session):
    """Regression: if the provider returns a tool call with a null/empty id,
    the assistant turn id and the role=tool result id MUST still match, or the
    next round trips a 400 from the OpenAI-compatible API."""
    sent_conversations: list[list[dict]] = []
    calls = {"n": 0}

    async def fake_backoff(*args, **kwargs):
        calls["n"] += 1
        if kwargs.get("raw_messages"):
            sent_conversations.append(list(kwargs["raw_messages"]))
        if calls["n"] == 1:
            # Provider returns a tool call with a NULL id (observed on some navy proxies).
            return _llm_response(tool_calls=[{
                "id": None,
                "name": "search_knowledge_base",
                "arguments": {"query": "x"},
            }])
        return _llm_response(content="готово")

    with patch.object(llm, "_call_with_backoff", new=fake_backoff), \
         patch.object(ka, "retrieve_legal_context", new=AsyncMock(return_value=_fake_rag_ctx())):
        result = await ka.run_agent_turn(
            history=[{"role": "user", "content": "вопрос"}],
            db=db_session,
            user_id=uuid.uuid4(),
        )

    assert result.status == "ok"
    # The 2nd call carries the assistant tool-call turn + the tool result.
    second = sent_conversations[-1]
    assistant_turn = next(m for m in second if m.get("role") == "assistant" and m.get("tool_calls"))
    tool_turn = next(m for m in second if m.get("role") == "tool")
    assistant_id = assistant_turn["tool_calls"][0]["id"]
    assert assistant_id, "synthesized id must be non-empty"
    assert assistant_id == tool_turn["tool_call_id"], "assistant + tool ids must match"


@pytest.mark.asyncio
async def test_corporate_chunk_gets_scope_note(db_session):
    """§7в: a retrieved юрлица/КДЛ chunk is annotated at the tool layer so the
    model is told to scope it down for a гражданин — not left to the prompt."""
    corporate = RAGContext(
        query="субсидиарная ответственность",
        results=[RAGResult(
            chunk_id=uuid.uuid4(),
            category="consequences",
            fact_text="Субсидиарная ответственность контролирующих должника лиц (КДЛ).",
            law_article="127-ФЗ ст. 61.11",
            relevance_score=0.8,
        )],
        method="keyword",
    )
    captured = {}

    async def fake_backoff(*args, **kwargs):
        # Drive one tool call, then a final answer; capture what the tool sent.
        conv = kwargs.get("raw_messages") or []
        for m in conv:
            if m.get("role") == "tool":
                captured["tool_content"] = m["content"]
        if not any(m.get("role") == "tool" for m in conv):
            return _llm_response(tool_calls=[{
                "id": "c1", "name": "search_knowledge_base",
                "arguments": {"query": "субсидиарка"},
            }])
        return _llm_response(content="Это институт для юрлиц/КДЛ.")

    with patch.object(llm, "_call_with_backoff", new=fake_backoff), \
         patch.object(ka, "retrieve_legal_context", new=AsyncMock(return_value=corporate)):
        result = await ka.run_agent_turn(
            history=[{"role": "user", "content": "что такое субсидиарная ответственность?"}],
            db=db_session, user_id=uuid.uuid4(),
        )

    assert result.status == "ok"
    assert result.grounded is True
    assert "юрлиц" in captured.get("tool_content", ""), "corporate chunk must carry a scope_note"


@pytest.mark.asyncio
async def test_ungrounded_answer_flagged(db_session):
    """§7а: an ok answer with no retrieved chunks is marked grounded=False."""
    async def fake_backoff(*args, **kwargs):
        return _llm_response(content="Уточните, пожалуйста, сумму долга и срок просрочки.")

    with patch.object(llm, "_call_with_backoff", new=fake_backoff):
        result = await ka.run_agent_turn(
            history=[{"role": "user", "content": "помоги"}],
            db=db_session, user_id=uuid.uuid4(),
        )

    assert result.status == "ok"
    assert result.grounded is False
    assert result.used_chunks == []


@pytest.mark.asyncio
async def test_agent_degrades_when_llm_unavailable(db_session):
    """Navy down / circuit open → _call_with_backoff returns None. The turn
    must degrade gracefully, not raise (§5)."""
    async def fake_backoff(*args, **kwargs):
        return None

    with patch.object(llm, "_call_with_backoff", new=fake_backoff):
        result = await ka.run_agent_turn(
            history=[{"role": "user", "content": "Привет"}],
            db=db_session,
            user_id=uuid.uuid4(),
        )

    assert result.status == "failed"
    assert "недоступна" in result.content.lower()


@pytest.mark.asyncio
async def test_reasoning_content_fallback():
    """Empty ``content`` with a populated ``reasoning_content`` (deepseek
    reasoning channel) must surface as the answer (§2.3 fallback)."""
    message = SimpleNamespace(content="", reasoning_content="Ответ из reasoning-канала.", tool_calls=None)
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=message)],
        model="deepseek-v4-pro",
        usage=SimpleNamespace(prompt_tokens=5, completion_tokens=7),
    )
    fake_client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(create=AsyncMock(return_value=response)),
        )
    )

    # Force the OpenAI-compatible (navy) branch deterministically — CI has no
    # navy creds, so local_llm_enabled/url are otherwise unset.
    with patch.object(llm.settings, "local_llm_enabled", True), \
         patch.object(llm.settings, "local_llm_url", "https://api.navy/v1"), \
         patch.object(llm, "_get_local_client", return_value=fake_client):
        resp = await llm._call_navy(
            "system", [{"role": "user", "content": "вопрос"}], 30.0,
        )

    assert resp.content == "Ответ из reasoning-канала."


@pytest.mark.asyncio
async def test_conversation_memory_multiturn(client, db_session):
    """A follow-up message is answered with the prior turns as context — the
    "does it actually remember?" check (§6.1)."""
    from app.core.deps import get_current_user
    from app.main import app as fastapi_app
    from app.models.user import User

    # Persist a user and bypass the JWT/redis auth path deterministically
    # (CI has no redis; the real get_current_user fail-closes without it).
    uid = uuid.uuid4()
    user = User(
        id=uid,
        email=f"manyasha_{uid.hex[:8]}@hunter888.test",
        full_name="Memory Tester",
        role="manager",
        hashed_password="$2b$12$placeholder",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    fastapi_app.dependency_overrides[get_current_user] = lambda: user

    # CSRF middleware (main.py): double-submit — X-CSRF-Token header must
    # match the csrf_token cookie on state-changing requests.
    csrf = "test-csrf-token"
    headers = {"X-CSRF-Token": csrf}
    client.cookies.set("csrf_token", csrf)
    seen_histories: list[list[dict]] = []

    async def fake_turn(*, history, db, user_id, **kwargs):
        seen_histories.append(list(history))
        return ka.AgentResult(content=f"ответ-{len(history)}", status="ok", used_chunks=[])

    with patch.object(ka, "run_agent_turn", new=fake_turn):
        created = await client.post("/api/knowledge-ai/conversations", json={}, headers=headers)
        assert created.status_code == 200, created.text
        conv_id = created.json()["id"]

        r1 = await client.post(
            f"/api/knowledge-ai/conversations/{conv_id}/messages",
            json={"message": "Подходит ли мне БФЛ?"}, headers=headers,
        )
        assert r1.status_code == 200, r1.text

        r2 = await client.post(
            f"/api/knowledge-ai/conversations/{conv_id}/messages",
            json={"message": "А какие документы нужны?"}, headers=headers,
        )
        assert r2.status_code == 200, r2.text

    # The second turn must have seen the first user+assistant exchange.
    assert len(seen_histories) == 2
    second = seen_histories[1]
    roles = [m["role"] for m in second]
    assert roles == ["user", "assistant", "user"], roles
    assert second[0]["content"] == "Подходит ли мне БФЛ?"
    assert second[2]["content"] == "А какие документы нужны?"

    # GET returns both exchanges from server memory, and the conversation was
    # auto-titled from the first question.
    detail = await client.get(f"/api/knowledge-ai/conversations/{conv_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["title"].startswith("Подходит ли мне БФЛ")
    assert len([m for m in body["messages"] if m["role"] == "user"]) == 2
    assert len([m for m in body["messages"] if m["role"] == "assistant"]) == 2
