"""Каталог кейсов БФЛ. Один модуль = один кейс = словарь ``CASE``.

Чтобы добавить кейс: создай ``bfl_NN.py`` с переменной ``CASE``. Агрегатор
авто-обнаруживает все модули ``bfl_*.py`` в этом пакете, импортирует их и
собирает ``CASES``, отсортированный по ``order_index`` (он же определяет код
БФЛ_NN в UI).

``seed_cases.py`` и ``validate_cases.py`` берут ``CASES`` отсюда.
"""
from __future__ import annotations

import importlib
import pkgutil

CASES: list[dict] = []
for _info in pkgutil.iter_modules(__path__):
    if not _info.name.startswith("bfl_"):
        continue
    _mod = importlib.import_module(f"{__name__}.{_info.name}")
    case = getattr(_mod, "CASE", None)
    if isinstance(case, dict):
        CASES.append(case)

# Стабильный порядок: по order_index.
CASES.sort(key=lambda c: c["order_index"])
