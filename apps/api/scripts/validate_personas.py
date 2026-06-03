"""Структурная валидация каталога персонажей перед посевом (offline, без БД).

Запуск:
    cd apps/api
    uv run python -m scripts.validate_personas

Падает с понятным сообщением на первой ошибке. Контракт — модель
``ReferencePersona`` + рубрика §5.3 + ЮЛ-чистота (процедуры юрлиц допустимы
ТОЛЬКО в red_flags / запретах, не как рекомендуемый материал).
"""
from __future__ import annotations

from scripts.personas_data import PERSONAS

TARGET = 25  # цель каталога (эталон + 24)

ALLOWED_DIFFICULTY = {"easy", "medium", "hard"}

# Лимиты длины колонок (app/models/reference_persona.py).
MAXLEN = {
    "slug": 80, "name": 100, "archetype": 50, "profession": 80, "lead_source": 120,
    "debt_stage": 120, "debt_range": 120, "family_preset": 80, "creditors_preset": 80,
    "property_preset": 200, "emotion_preset": 80, "difficulty": 20, "environment": 120,
    "client_fatigue": 20, "tone": 40,
}

REQUIRED = (
    "slug", "name", "archetype", "profession", "lead_source", "difficulty",
    "cached_dossier", "scoring_rubric", "order_index",
)
# Поля, которые формально nullable, но для качества обязаны быть заполнены.
QUALITY_REQUIRED = (
    "debt_stage", "debt_range", "family_preset", "creditors_preset",
    "property_preset", "emotion_preset", "environment", "client_fatigue", "tone",
)

RUBRIC_METRICS = ("script_adherence", "objection_handling", "communication", "result")

# Явные процедуры банкротства ЮЛ — НИКОГДА не должны стоять как рекомендуемый
# материал (must_explain). «субсидиар» намеренно НЕ включён: субсидиарная
# ответственность — легитимная тема как несписываемый долг гражданина.
UL_PROCEDURE_TERMS = (
    "наблюдени", "финансовое оздоровл", "внешнее управл", "конкурсное производ",
)


def err(pid: str, msg: str) -> None:
    raise SystemExit(f"❌ [{pid}] {msg}")


def validate(p: dict) -> None:
    pid = p.get("slug", "<no-slug>")
    for f in REQUIRED:
        if f not in p or p[f] in (None, ""):
            err(pid, f"нет обязательного поля {f}")
    for f in QUALITY_REQUIRED:
        if not p.get(f):
            err(pid, f"поле {f} должно быть заполнено (качество)")
    for f, limit in MAXLEN.items():
        v = p.get(f)
        if isinstance(v, str) and len(v) > limit:
            err(pid, f"{f} длиннее {limit} символов ({len(v)})")
    if p["difficulty"] not in ALLOWED_DIFFICULTY:
        err(pid, f"difficulty '{p['difficulty']}' вне {sorted(ALLOWED_DIFFICULTY)}")
    if not isinstance(p["cached_dossier"], str) or len(p["cached_dossier"]) < 600:
        err(pid, "cached_dossier слишком короткий (нужно содержательное досье ≥600 симв.)")

    # — рубрика —
    rb = p["scoring_rubric"]
    if not isinstance(rb, dict):
        err(pid, "scoring_rubric должен быть dict")
    metrics = rb.get("metrics")
    if not isinstance(metrics, dict):
        err(pid, "scoring_rubric.metrics отсутствует")
    if set(metrics.keys()) != set(RUBRIC_METRICS):
        err(pid, f"metrics должны быть ровно {RUBRIC_METRICS}, а есть {sorted(metrics.keys())}")
    total_w = 0.0
    for mk, mv in metrics.items():
        if not isinstance(mv, dict):
            err(pid, f"metric {mk} не dict")
        for sub in ("weight", "target", "criteria"):
            if sub not in mv:
                err(pid, f"metric {mk} без {sub}")
        if not mv.get("criteria"):
            err(pid, f"metric {mk}: пустой criteria")
        total_w += float(mv["weight"])
    if abs(total_w - 1.0) > 0.01:
        err(pid, f"сумма весов метрик {total_w:.3f}, должна быть 1.0")

    for lst in ("must_clarify", "must_explain", "red_flags"):
        items = rb.get(lst)
        if not isinstance(items, list) or len(items) < 3:
            err(pid, f"rubric.{lst} должен быть списком ≥3 пунктов")
        if any((not isinstance(x, str) or not x.strip()) for x in items):
            err(pid, f"rubric.{lst} содержит пустой пункт")

    # — ЮЛ-чистота: процедуры юрлиц не должны фигурировать как рекомендуемый
    #   материал (must_explain) или в «что объяснить» досье. В red_flags — можно. —
    explain_blob = " ".join(rb["must_explain"]).lower()
    for term in UL_PROCEDURE_TERMS:
        if term in explain_blob:
            err(pid, f"ЮЛ-процедура «{term}» в must_explain — недопустимо (только red_flags)")
    # red_flags ДОЛЖНЫ предупреждать о путанице с ЮЛ (педагогический инвариант).
    rf_blob = " ".join(rb["red_flags"]).lower()
    if "юрлиц" not in rf_blob and "юридическ" not in rf_blob:
        err(pid, "red_flags должны включать предупреждение о путанице с банкротством юрлиц")


def main() -> None:
    slugs = [p["slug"] for p in PERSONAS]
    oidx = [p["order_index"] for p in PERSONAS]
    if len(set(slugs)) != len(slugs):
        raise SystemExit("❌ дублирующиеся slug персонажей")
    if len(set(oidx)) != len(oidx):
        raise SystemExit("❌ дублирующиеся order_index")
    if sorted(oidx) != list(range(len(PERSONAS))):
        raise SystemExit(f"❌ order_index не плотный 0..{len(PERSONAS) - 1}: {sorted(oidx)}")
    for p in PERSONAS:
        validate(p)
    if len(PERSONAS) != TARGET:
        print(f"⚠ персонажей {len(PERSONAS)}, цель {TARGET} — валидны, но каталог неполон")
    else:
        print(f"✅ OK: все {len(PERSONAS)} персонажей валидны")
    print(f"   slugs: {', '.join(slugs)}")


if __name__ == "__main__":
    main()
