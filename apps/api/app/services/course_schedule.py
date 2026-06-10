"""Course drip schedule (Course Progress, Этап 2).

Lessons of a course unlock weekly — Thursday 19:00 МСК (= 16:00 UTC). Lesson
``i`` (0-based) unlocks at ``drip_start + i weeks``. The schedule is GLOBAL: a
lesson is available to everyone once its unlock moment has passed, so a late
joiner sees all already-released lessons immediately (catch-up) and future ones
open on the common calendar.

``COURSE_DRIP_START`` is an operator-configurable anchor (a Thursday 16:00 UTC).
Courses absent here have no drip → all lessons always available.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

_WEEK = timedelta(weeks=1)

# Anchor = first lesson's unlock, Thursday 19:00 МСК (16:00 UTC).
# ⚠️ Placeholder for the real launch — set per the championship season so the
# last lesson opens BEFORE the tally week. 2026-04-02 is a Thursday.
COURSE_DRIP_START: dict[str, datetime] = {
    "yuridicheskie-aspekty": datetime(2026, 4, 2, 16, 0, tzinfo=timezone.utc),
}


def unlock_at(course_slug: str, lesson_index: int) -> datetime | None:
    """When lesson ``i`` opens (UTC), or None if the course has no drip."""
    start = COURSE_DRIP_START.get(course_slug)
    if start is None:
        return None
    return start + lesson_index * _WEEK


def is_unlocked(course_slug: str, lesson_index: int, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    ua = unlock_at(course_slug, lesson_index)
    return ua is None or now >= ua
