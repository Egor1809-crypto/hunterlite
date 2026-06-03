"""Регрессия гейта конструктора (CONSTRUCTOR_TZ §3/§4, ultrareview #3).

До этого инвариант разблокировки не был покрыт ни одним тестом. Проверяем
граничные условия is_constructor_unlocked — единственного источника решения
о 403 constructor_locked и поля constructor_unlocked в /training-map/progress.
"""
from __future__ import annotations

from app.services.constructor_access import (
    PASS_SCORE,
    REGION_1_LEVELS,
    is_constructor_unlocked,
)


def _passed(n: int = REGION_1_LEVELS, score: int = PASS_SCORE) -> list[dict]:
    return [{"level": i + 1, "bestScore": score} for i in range(n)]


def test_empty_and_garbage_locked():
    assert is_constructor_unlocked(None) is False
    assert is_constructor_unlocked({}) is False          # пустой стартовый row
    assert is_constructor_unlocked([]) is False
    assert is_constructor_unlocked("nope") is False
    assert is_constructor_unlocked([1, 2, 3]) is False    # элементы не dict


def test_region1_fully_passed_unlocks():
    assert is_constructor_unlocked(_passed()) is True
    # лишние уровни сверх региона 1 не мешают
    assert is_constructor_unlocked(_passed(100)) is True


def test_one_level_below_threshold_locks():
    tm = _passed()
    tm[4]["bestScore"] = PASS_SCORE - 1   # уровень 5 не сдан
    assert is_constructor_unlocked(tm) is False


def test_boundary_exact_threshold():
    assert is_constructor_unlocked(_passed(score=PASS_SCORE)) is True
    assert is_constructor_unlocked(_passed(score=PASS_SCORE - 1)) is False


def test_fewer_than_region1_levels_locks():
    assert is_constructor_unlocked(_passed(n=REGION_1_LEVELS - 1)) is False


def test_missing_or_nonnumeric_bestscore_locks():
    assert is_constructor_unlocked([{"level": i + 1} for i in range(REGION_1_LEVELS)]) is False
    tm = _passed()
    tm[0]["bestScore"] = "100"            # строка вместо числа
    assert is_constructor_unlocked(tm) is False
