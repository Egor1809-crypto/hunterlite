"""Структурная валидация кейсов БФЛ перед посевом (offline, без БД).

Запуск:
    cd apps/api
    uv run python -m scripts.validate_cases

Падает с понятным сообщением на первой же ошибке. Реализует §9 ТЗ
(SCALING_TZ) плюс несколько дополнительных инвариантов:
достижимость исхода по верному пути, отсутствие циклов (DAG вперёд),
уникальность id вариантов, корректность скоринга stage1=50/stage2=50.
"""
from __future__ import annotations

from scripts.cases_data import CASES

TARGET = 50

# Таксономия категорий из §5 ТЗ. bfl-01 (эталон) использует легаси-категорию
# «Банкротство физлица» — допускаем её отдельно, данные эталона менять нельзя.
ALLOWED_CATEGORIES = {
    "Внесудебное (МФЦ)", "Реализация имущества", "Реструктуризация",
    "Мировое соглашение", "Ипотека и жильё", "Имущество супругов",
    "Оспаривание сделок", "Недобросовестность", "Несписываемые долги",
    "Залоговый кредитор", "Поручительство", "ИП-гражданин",
    "Микрозаймы и МФО", "Последствия банкротства",
    "Банкротство физлица",  # легаси эталона bfl-01
}

TOP_FIELDS = (
    "id", "title", "description", "difficulty", "category", "estimated_minutes",
    "max_score", "expert_analysis", "stage1", "stage2", "order_index",
)


def err(cid: str, msg: str) -> None:
    raise SystemExit(f"❌ [{cid}] {msg}")


# Легаси-эталон bfl-01 одобрен заказчиком; в нём есть исторически принятое
# обратное ребро (q3-b→info_wait_bank→q2). Новые кейсы обязаны быть строго
# forward-DAG, поэтому проверку направленности info.next для эталона пропускаем.
FORWARD_EXEMPT = {"bfl-01"}


def _validate_stage1(cid: str, s1: dict) -> None:
    if "nodes" not in s1 or "start" not in s1:
        err(cid, "stage1 без nodes/start")
    nodes = s1["nodes"]
    if s1["start"] not in nodes:
        err(cid, f"start '{s1['start']}' отсутствует в nodes")

    questions = {k: v for k, v in nodes.items() if v.get("type") == "question"}
    infos = {k: v for k, v in nodes.items() if v.get("type") == "info"}
    outcomes = {k: v for k, v in nodes.items() if v.get("type") == "outcome"}

    if len(questions) != 5:
        err(cid, f"вопросов {len(questions)}, нужно 5")
    if len(outcomes) < 1:
        err(cid, "нет исхода (outcome)")
    if sorted(v["step"] for v in questions.values()) != [1, 2, 3, 4, 5]:
        err(cid, "step вопросов должны быть 1..5 без дублей")

    # — стартовый узел должен быть вопросом step=1 —
    if nodes[s1["start"]].get("type") != "question" or nodes[s1["start"]].get("step") != 1:
        err(cid, "start должен указывать на вопрос step=1")

    seen_opt_ids: set[str] = set()
    info_refs: dict[str, int] = {}  # сколько неверных ведут в каждый info
    info_referrer_steps: dict[str, list[int]] = {}  # шаги вопросов-источников
    for qid, q in questions.items():
        opts = q.get("options", [])
        if len(opts) != 5:
            err(cid, f"{qid}: вариантов {len(opts)}, нужно 5")
        if sum(1 for o in opts if o.get("correct")) != 1:
            err(cid, f"{qid}: верный вариант должен быть ровно 1")
        if not (2 <= len(q.get("facts", [])) <= 4):
            err(cid, f"{qid}: нужно 2..4 facts")
        for o in opts:
            oid = o.get("id")
            if not oid:
                err(cid, f"{qid}: вариант без id")
            if oid in seen_opt_ids:
                err(cid, f"дублирующийся option.id '{oid}'")
            seen_opt_ids.add(oid)
            if not o.get("text") or not o.get("explain"):
                err(cid, f"{qid}/{oid}: пустой text/explain")
            nx = o.get("next")
            if nx not in nodes:
                err(cid, f"{qid}/{oid}: next '{nx}' не найден в nodes")
            tgt = nodes[nx]
            if o.get("correct"):
                if tgt["type"] not in ("question", "outcome"):
                    err(cid, f"{qid}/{oid}: верный должен вести в вопрос/исход")
            else:
                if tgt["type"] != "info":
                    err(cid, f"{qid}/{oid}: неверный должен вести в info")
                info_refs[nx] = info_refs.get(nx, 0) + 1
                info_referrer_steps.setdefault(nx, []).append(q["step"])

    for iid, info in infos.items():
        if not info.get("body"):
            err(cid, f"{iid}: пустой body")
        nx = info.get("next")
        if nx not in nodes:
            err(cid, f"{iid}: next '{nx}' не найден")
        if nodes[nx]["type"] not in ("question", "outcome"):
            err(cid, f"{iid}: info должен сходиться в вопрос/исход")
        if iid not in info_refs:
            err(cid, f"{iid}: info-узел никем не используется (висячий)")

    # — пересечения веток: ≥3 info, в которые ведут ≥2 разных неверных option —
    shared = [i for i, c in info_refs.items() if c >= 2]
    if len(shared) < 3:
        err(cid, f"пересечений веток мало: общих info {len(shared)}, нужно ≥3")

    # — info.next всегда ВПЕРЁД (forward-DAG): если info ведёт в вопрос, его step
    #   должен быть строго больше step любого вопроса-источника. Иначе — обратное
    #   ребро/петля (как было в эталоне q3-b→info_wait_bank→q2). Эталон освобождён.
    if cid not in FORWARD_EXEMPT:
        for iid, info in infos.items():
            nx = info["next"]
            tgt = nodes[nx]
            if tgt["type"] == "question":
                max_src = max(info_referrer_steps.get(iid, [0]))
                if tgt["step"] <= max_src:
                    err(cid, f"{iid}: обратное ребро — info.next='{nx}' (step {tgt['step']}) "
                             f"не впереди вопроса-источника (step {max_src})")

    # — достижимость: верный путь q1→…→q5→outcome даёт 5 верных = 50 баллов —
    cur = s1["start"]
    correct_seen = 0
    guard = 0
    while True:
        guard += 1
        if guard > 20:
            err(cid, "верный путь зациклился (нет схождения к исходу)")
        node = nodes[cur]
        if node["type"] == "outcome":
            break
        if node["type"] != "question":
            err(cid, f"верный путь упёрся в не-вопрос '{cur}'")
        correct_opt = next(o for o in node["options"] if o.get("correct"))
        correct_seen += 1
        cur = correct_opt["next"]
    if correct_seen != 5:
        err(cid, f"верный путь проходит {correct_seen} вопросов, нужно 5 (stage1=50)")

    # — документирующие поля (если заданы) должны быть согласованы —
    if s1.get("correct_outcome") and s1["correct_outcome"] not in outcomes:
        err(cid, f"correct_outcome '{s1['correct_outcome']}' не найден среди исходов")


def _validate_stage2(cid: str, s2: dict) -> None:
    pool = s2.get("pool", [])
    seq = s2.get("correct_sequence", [])
    correct = [p for p in pool if p.get("is_correct")]
    distr = [p for p in pool if not p.get("is_correct")]
    if len(correct) != 7:
        err(cid, f"верных шагов {len(correct)}, нужно 7")
    if len(distr) != 5:
        err(cid, f"дистракторов {len(distr)}, нужно 5")
    if len(seq) != 7:
        err(cid, "correct_sequence должен быть длиной 7")
    if sorted(p["order"] for p in correct) != [1, 2, 3, 4, 5, 6, 7]:
        err(cid, "order верных шагов должен быть 1..7 без пропусков/дублей")
    if [p["id"] for p in sorted(correct, key=lambda x: x["order"])] != seq:
        err(cid, "correct_sequence не совпадает с порядком order")
    if any(p.get("order") is not None for p in distr):
        err(cid, "у дистрактора order должен быть None")
    ids = [p["id"] for p in pool]
    if len(ids) != len(set(ids)):
        err(cid, "дублирующиеся id в pool")
    for p in pool:
        if not p.get("text") or not p.get("explain"):
            err(cid, f"{p.get('id')}: пустой text/explain")


def validate(case: dict) -> None:
    cid = case.get("id", "<no-id>")
    for f in TOP_FIELDS:
        if f not in case:
            err(cid, f"нет поля {f}")
    if len(case["id"]) > 32:
        err(cid, "id > 32 символов")
    if len(case["title"]) > 256:
        err(cid, "title > 256")
    if len(case["category"]) > 128:
        err(cid, "category > 128")
    if case["category"] not in ALLOWED_CATEGORIES:
        err(cid, f"категория '{case['category']}' вне таксономии §5")
    if case["max_score"] != 100:
        err(cid, "max_score должен быть 100")
    if case["difficulty"] not in (1, 2, 3, 4, 5):
        err(cid, "difficulty 1..5")
    if not (10 <= case["estimated_minutes"] <= 18):
        err(cid, "estimated_minutes 10..18")
    if not case["expert_analysis"] or len(case["expert_analysis"]) < 120:
        err(cid, "expert_analysis слишком короткий (нужен содержательный разбор)")
    _validate_stage1(cid, case["stage1"])
    _validate_stage2(cid, case["stage2"])


def main() -> None:
    ids = [c["id"] for c in CASES]
    oidx = [c["order_index"] for c in CASES]
    if len(set(ids)) != len(ids):
        raise SystemExit("❌ дублирующиеся id кейсов")
    if len(set(oidx)) != len(oidx):
        raise SystemExit("❌ дублирующиеся order_index")
    for c in CASES:
        validate(c)
    if len(CASES) != TARGET:
        print(f"⚠ кейсов {len(CASES)}, цель {TARGET} — валидны, но каталог неполон")
    else:
        print(f"✅ OK: все {len(CASES)} кейсов валидны")
    print(f"   id: {', '.join(sorted(ids))}")


if __name__ == "__main__":
    main()
