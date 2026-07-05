"""Регресс: доказуемость розыгрыша (draw_proof) + TOCTOU-защита conduct_draw.

- Championship теперь хранит ``draw_verification`` (результат RANDOM.ORG) +
  ``drawn_at`` (момент розыгрыша) — раньше верификация только логировалась,
  доказуемость честности жила исключительно off-platform.
- ``conduct_draw`` оборачивает commit в ``try/except IntegrityError``: guard
  «розыгрыш уже проведён» читает счётчик winners ДО коммита, поэтому два
  одновременных admin-draw могли оба пройти guard; уникальный ключ
  ``(championship_id, rank)`` ловит гонку на коммите → чистый 409 вместо 500.
"""
import inspect

from app.models.championship import Championship


def test_championship_has_draw_provenance_columns():
    assert hasattr(Championship, "draw_verification")
    assert hasattr(Championship, "drawn_at")


def test_conduct_draw_persists_verification():
    from app.api import championship
    src = inspect.getsource(championship.conduct_draw)
    assert "champ.draw_verification = payload.random_org_verification" in src
    assert "champ.drawn_at" in src


def test_conduct_draw_guards_toctou_with_integrity_error():
    from app.api import championship
    src = inspect.getsource(championship.conduct_draw)
    # commit обёрнут в перехват гонки → 409, а не 500
    assert "except IntegrityError" in src
    assert "await db.rollback()" in src
