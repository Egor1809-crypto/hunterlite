"""Каталог reference_personas. Один модуль = один персонаж = словарь ``PERSONA``.

Чтобы добавить персонажа: создай ``persona_NN_<slug>.py`` с переменной ``PERSONA``.
Агрегатор авто-обнаруживает все модули ``persona_*.py``, импортирует их и собирает
``PERSONAS``, отсортированный по ``order_index``.

``seed_reference_persona.py`` и ``validate_personas.py`` берут ``PERSONAS`` отсюда.
Эталон — ``persona_01_irina`` (одобрен заказчиком, данные не менять).
"""
from __future__ import annotations

import importlib
import pkgutil

PERSONAS: list[dict] = []
for _info in pkgutil.iter_modules(__path__):
    if not _info.name.startswith("persona_"):
        continue
    _mod = importlib.import_module(f"{__name__}.{_info.name}")
    persona = getattr(_mod, "PERSONA", None)
    if isinstance(persona, dict):
        PERSONAS.append(persona)

PERSONAS.sort(key=lambda p: p["order_index"])
