"""Regression: the MCP global tool-timeout ceiling must be REAL, and must not
clip the legitimately-slow image tool.

Two bugs fixed together (2026-06-25):

1. ``settings.mcp_tool_timeout_s`` was declared with a docstring promising a
   "hard ceiling on handler execution" but was **never read** by the executor
   (dead config). The executor ran every handler under
   ``asyncio.wait_for(timeout=tool.timeout_s)`` only. Now it uses
   ``min(tool.timeout_s, settings.mcp_tool_timeout_s)``.

2. ``generate_image`` had ``timeout_s=60`` and a 60s httpx timeout, but
   ``nano-banana-2`` was measured at ~88s on navy.api — the handler was killed
   mid-generation every time. Bumped to 150s, and the ceiling raised to 180 so
   it does not clip the slow-but-valid image tool.
"""

import asyncio

import pytest

# Import tool modules so the @tool decorator registers them.
import app.mcp.tools.generate_image  # noqa: F401 — side-effect registration
from app.config import settings
from app.mcp import ToolContext
from app.mcp.executor import ToolExecutionError, dispatch
from app.mcp.registry import ToolRegistry
from app.mcp.tool import tool


def test_ceiling_does_not_clip_generate_image():
    """The slow image tool must fit under the global ceiling, and be generous
    enough for the measured ~88s nano-banana-2 latency."""
    img = ToolRegistry.get("generate_image")
    assert img.timeout_s >= 120, (
        f"generate_image.timeout_s={img.timeout_s} too low for ~88s nano-banana-2"
    )
    assert settings.mcp_tool_timeout_s >= img.timeout_s, (
        f"global ceiling {settings.mcp_tool_timeout_s}s would clip "
        f"generate_image ({img.timeout_s}s)"
    )


# A fake tool whose OWN timeout_s (30) is far above the ceiling we set in the
# test — so a timeout can ONLY happen if the global ceiling is actually wired.
@tool(
    name="_test_slow_tool",
    description="sleeps; used to prove the global timeout ceiling is enforced",
    parameters_schema={"type": "object", "properties": {}},
    timeout_s=30,
    auth_required=False,
    rate_limit_per_min=0,
)
async def _test_slow_tool(args: dict, ctx: ToolContext) -> dict:
    await asyncio.sleep(0.5)
    return {"ok": True}


async def test_global_ceiling_is_enforced(monkeypatch):
    """With the ceiling set below the handler's runtime (but well below the
    tool's own 30s timeout_s), the handler must be killed by the ceiling."""
    monkeypatch.setattr(settings, "mcp_tool_timeout_s", 0.1, raising=False)
    with pytest.raises(ToolExecutionError) as ei:
        await dispatch("_test_slow_tool", {}, ToolContext(user_id="u"))
    assert ei.value.code == "timeout"


async def test_per_tool_timeout_still_applies(monkeypatch):
    """When the tool's own timeout_s is the tighter bound, it still wins."""
    monkeypatch.setattr(settings, "mcp_tool_timeout_s", 180, raising=False)
    t = ToolRegistry.get("_test_slow_tool")
    monkeypatch.setattr(t, "timeout_s", 0.1, raising=False)
    with pytest.raises(ToolExecutionError) as ei:
        await dispatch("_test_slow_tool", {}, ToolContext(user_id="u"))
    assert ei.value.code == "timeout"
