"""Bounded provisional captions. Never writes dialogue, calls the LLM or grades."""

from __future__ import annotations

import asyncio
import base64
import binascii
import time
from collections.abc import Awaitable, Callable

from app.services.call_pipeline import is_junk, stt_transcribe


class LiveTranscription:
    def __init__(self, send: Callable[[dict], Awaitable[None]]):
        self.send = send
        self.task: asyncio.Task | None = None
        self.pending: tuple[int, int, bytes] | None = None
        self.last_received = -float("inf")
        self.latest = (0, 0)
        self.generation = 0

    def offer(self, data: dict, completed_turn: int) -> None:
        turn, seq = data.get("turn_id"), data.get("sequence")
        if type(turn) is not int or type(seq) is not int or turn <= completed_turn:
            return
        if seq < 1 or (turn, seq) <= self.latest:
            return
        encoded = data.get("audio_b64")
        if not isinstance(encoded, str) or len(encoded) > 5_200_000:
            return
        if time.monotonic() - self.last_received < 1:
            return
        try:
            audio = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            return
        # Browser sends complete 16 kHz mono PCM WAV snapshots, <= 120 seconds.
        if len(audio) < 44 or audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
            return
        self.latest = (turn, seq)
        self.last_received = time.monotonic()
        self.pending = (turn, seq, audio)
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._drain(self.generation))

    async def _drain(self, generation: int) -> None:
        while self.pending is not None and generation == self.generation:
            turn, seq, audio = self.pending
            self.pending = None
            try:
                async with asyncio.timeout(6):
                    text = await stt_transcribe(audio, mime="audio/wav")
                if generation == self.generation and turn == self.latest[0]:
                    await self.send(
                        {
                            "type": "transcript_partial",
                            "data": {
                                "turn_id": turn,
                                "sequence": seq,
                                "text": text if text.strip() and not is_junk(text) else "",
                            },
                        }
                    )
            except asyncio.CancelledError:
                raise
            except Exception:
                if generation == self.generation:
                    await self.send(
                        {
                            "type": "transcript_partial_unavailable",
                            "data": {
                                "turn_id": turn,
                                "sequence": seq,
                            },
                        }
                    )

    async def cancel(self) -> None:
        self.generation += 1
        self.pending = None
        self.latest = (0, 0)
        if self.task is not None:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
            self.task = None
