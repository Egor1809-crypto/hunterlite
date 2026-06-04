"""LLM health / latency probe for navy.api — with automatic-fallback awareness.

We route every AI feature (roleplay clients, coach/report, knowledge «Маняша»,
exam grader) through navy.api on a single primary model (``NAVY_LLM_MODEL``,
default ``deepseek-v4-pro``). deepseek is a *reasoning* model — accurate but
sometimes slow ("лагает"). When it is slow or down, the request path falls back
to the models in ``NAVY_LLM_FALLBACK_MODELS`` (default ``gpt-5.5,gemini-3.5-flash``).

This script pings the primary and each fallback with a tiny prompt, measures
round-trip latency, and classifies each as ``ok`` / ``slow`` / ``down``. Use it
to decide whether deepseek is healthy or whether to lean on a fallback.

Exit codes (handy for cron / CI / a deploy gate):
  0 — primary is healthy (responded under the slow threshold)
  2 — primary is slow or down, BUT at least one fallback is healthy
  1 — nothing healthy (navy.api itself is likely down / key invalid)

Usage (from apps/api, with the project venv):
    python -m scripts.check_llm_health
    python -m scripts.check_llm_health --json
    python -m scripts.check_llm_health --slow-ms 6000
    python -m scripts.check_llm_health --models deepseek-v4-pro,gpt-5.5,gemini-3.5-flash
"""
from __future__ import annotations

import argparse
import asyncio
import json as _json
import sys
import time

import openai

from app.config import settings


# Default "slow" threshold (ms). Above this a reasoning model is considered to be
# lagging badly enough that a faster fallback should answer instead.
DEFAULT_SLOW_MS = 8000

PING_SYSTEM = "Ты — проверка связи. Ответь ровно одним словом: OK."
PING_USER = "ping"


def _fallback_models() -> list[str]:
    raw = getattr(settings, "local_llm_fallback_models", "") or ""
    return [m.strip() for m in raw.split(",") if m.strip()]


def _models_to_probe(cli_models: str | None) -> list[str]:
    if cli_models:
        return [m.strip() for m in cli_models.split(",") if m.strip()]
    # primary first, then configured fallbacks (dedup, keep order)
    ordered = [settings.local_llm_model, *_fallback_models()]
    seen: set[str] = set()
    out: list[str] = []
    for m in ordered:
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


def _client() -> openai.AsyncOpenAI:
    return openai.AsyncOpenAI(
        base_url=settings.local_llm_url,
        api_key=settings.local_llm_api_key or "sk-noauth",
        timeout=settings.local_llm_timeout_seconds,
        max_retries=0,
    )


async def _probe_one(client: openai.AsyncOpenAI, model: str, slow_ms: int, timeout: float) -> dict:
    start = time.monotonic()
    # gpt-5.x reasoning models reject a non-default temperature (400) — must be
    # omitted, mirroring the runtime path in llm._call_navy. Otherwise the probe
    # would falsely report a healthy gpt-5.x fallback as "down".
    create_kwargs: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": PING_SYSTEM},
            {"role": "user", "content": PING_USER},
        ],
        "max_tokens": 16,
    }
    if not model.lower().startswith("gpt-5"):
        create_kwargs["temperature"] = 0.0
    try:
        resp = await asyncio.wait_for(
            client.chat.completions.create(**create_kwargs),
            timeout=timeout,
        )
        latency_ms = int((time.monotonic() - start) * 1000)
        msg = resp.choices[0].message if resp.choices else None
        content = ((getattr(msg, "content", None) or getattr(msg, "reasoning_content", None) or "") if msg else "").strip()
        status = "ok" if latency_ms <= slow_ms else "slow"
        return {"model": model, "status": status, "latency_ms": latency_ms, "reply": content[:40], "error": None}
    except asyncio.TimeoutError:
        return {"model": model, "status": "down", "latency_ms": int((time.monotonic() - start) * 1000), "reply": "", "error": "timeout"}
    except Exception as e:  # noqa: BLE001 — any transport/API error means "down" for this model
        return {"model": model, "status": "down", "latency_ms": int((time.monotonic() - start) * 1000), "reply": "", "error": f"{type(e).__name__}: {str(e)[:120]}"}


async def run(slow_ms: int, cli_models: str | None, timeout: float) -> tuple[list[dict], int]:
    if not settings.local_llm_enabled or not settings.local_llm_url:
        print("navy.api disabled (NAVY_LLM_ENABLED is false) — nothing to probe", file=sys.stderr)
        return [], 1

    models = _models_to_probe(cli_models)
    client = _client()
    try:
        # Probe concurrently — total wall-clock ≈ slowest model, not the sum.
        results = await asyncio.gather(*[_probe_one(client, m, slow_ms, timeout) for m in models])
    finally:
        await client.close()

    primary = models[0]
    primary_res = next((r for r in results if r["model"] == primary), None)
    any_fallback_ok = any(r["status"] == "ok" for r in results[1:])

    if primary_res and primary_res["status"] == "ok":
        code = 0
    elif any_fallback_ok:
        code = 2
    else:
        code = 1
    return results, code


def _print_table(results: list[dict], code: int, slow_ms: int) -> None:
    icon = {"ok": "✓", "slow": "~", "down": "✗"}
    print(f"navy.api LLM health — slow threshold {slow_ms} ms")
    print("-" * 64)
    for i, r in enumerate(results):
        role = "primary " if i == 0 else "fallback"
        line = f"  {icon.get(r['status'], '?')} [{role}] {r['model']:<22} {r['status']:<5} {r['latency_ms']:>6} ms"
        if r["error"]:
            line += f"  — {r['error']}"
        print(line)
    print("-" * 64)
    verdict = {
        0: "PRIMARY HEALTHY — deepseek answering normally.",
        2: "PRIMARY DEGRADED — fallback model(s) healthy; requests will fall back.",
        1: "ALL DOWN — navy.api unreachable or no model healthy. Check key/url.",
    }
    print(verdict.get(code, ""))


def main() -> None:
    ap = argparse.ArgumentParser(description="Probe navy.api LLM models for health/latency.")
    ap.add_argument("--slow-ms", type=int, default=DEFAULT_SLOW_MS, help="latency (ms) above which a model is 'slow'")
    ap.add_argument("--models", type=str, default=None, help="comma-separated models to probe (default: primary + configured fallbacks)")
    ap.add_argument("--timeout", type=float, default=None, help="per-model hard timeout in seconds (default: navy timeout)")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    args = ap.parse_args()

    timeout = args.timeout if args.timeout is not None else settings.local_llm_timeout_seconds
    results, code = asyncio.run(run(args.slow_ms, args.models, timeout))

    if args.json:
        print(_json.dumps({"exit_code": code, "results": results}, ensure_ascii=False, indent=2))
    else:
        _print_table(results, code, args.slow_ms)
    sys.exit(code)


if __name__ == "__main__":
    main()
