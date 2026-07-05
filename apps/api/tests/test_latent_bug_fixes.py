"""Регресс: три латентных бага, замаскированных try/except (тихо глотались).

1. ``build_lorebook_system_prompt`` была sync ``def``, но вызывается через
   ``await`` в llm.py → TypeError глотался ``except``, lorebook-ветка всегда
   мертва. Заглушка теперь ``async``.
2. Recovery-путь ``scenario_extractor`` импортировал НЕ-ORM stub
   ``models/attachment.Attachment`` и звал ``update()`` по нему — падало на
   отсутствии колонок ``.id`` / ``.classification_status``. Теперь импорт —
   живая ORM-модель ``models/client.Attachment``.
3. ``lifespan`` импортировал несуществующий ``scripts.seed_lorebook`` →
   ImportError на каждом старте (тихий warning). Мёртвый блок удалён.
"""
import inspect


def test_lorebook_stub_is_async():
    # llm.py делает `await build_lorebook_system_prompt(...)` — функция обязана
    # быть корутиной, иначе await → TypeError.
    from app.services.lorebook import build_lorebook_system_prompt
    assert inspect.iscoroutinefunction(build_lorebook_system_prompt)


def test_scenario_recovery_uses_orm_attachment():
    # Recovery-update должен идти по живой ORM-модели client.Attachment, а не по
    # не-ORM заглушке models/attachment (у неё нет ORM-колонок).
    from app.services import scenario_extractor
    src = inspect.getsource(scenario_extractor)
    assert "from app.models.attachment import Attachment" not in src, (
        "recovery всё ещё импортирует не-ORM stub models/attachment"
    )


def test_lifespan_no_missing_seed_lorebook_import():
    # scripts.seed_lorebook не существует — lifespan не должен его импортировать.
    from app import main
    src = inspect.getsource(main)
    assert "scripts.seed_lorebook" not in src, (
        "lifespan всё ещё импортирует несуществующий scripts.seed_lorebook"
    )
