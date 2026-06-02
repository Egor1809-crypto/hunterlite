"""Разблокировка конструктора («Мои клиенты») по прохождению региона 1 теста.

CONSTRUCTOR_TZ §3 / DECISION-4: конструктор заблокирован, пока пользователь не
прошёл ПЕРВЫЙ регион острова знаний («Условия подачи» = уровни 1–10), каждый из
которых должен быть сдан с результатом ≥ порога. После этого конструктор
полностью свободен.

Источник истины — ``training_map_progress.test_map``: это JSON-массив состояний
уровней (индекс = уровень − 1), каждый элемент содержит ``bestScore`` (0..100).
Порог зеркалит ``PASS_THRESHOLD = 0.88`` в ``TestWorldMap.tsx`` (88 баллов).
"""
from __future__ import annotations

from typing import Any

REGION_1_LEVELS = 10           # регион 1 «Условия подачи» = уровни 1..10
PASS_SCORE = 88                # PASS_THRESHOLD 0.88 × 100 (см. TestWorldMap.tsx)

CONSTRUCTOR_LOCKED_CODE = "constructor_locked"
CONSTRUCTOR_UNLOCK_HINT = (
    'Пройдите регион «Условия подачи» (10 уровней теста), чтобы открыть практику с клиентом.'
)


def is_constructor_unlocked(test_map: Any) -> bool:
    """True, если все 10 уровней региона 1 сданы с результатом ≥ PASS_SCORE."""
    if not isinstance(test_map, list) or len(test_map) < REGION_1_LEVELS:
        return False
    for i in range(REGION_1_LEVELS):
        level = test_map[i]
        if not isinstance(level, dict):
            return False
        best = level.get("bestScore")
        if not isinstance(best, (int, float)) or best < PASS_SCORE:
            return False
    return True
