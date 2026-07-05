"""Seed the exam-rebuild learning-content DB (exam_item) + per-exam mechanic.

EXAM_TZ §2-3, §10 stage 3. ONLY банкротство ФИЗЛИЦ / ФЗ-127.

  * exam-3 «Анализ дела» — the reference exam (DECISION-B): 3 deep case_analysis
    items with rubrics + RAG refs, AI-graded by deepseek-v4-pro.
  * exam-1/2/4/5 — skeleton items giving each exam its own DISTINCT mechanic
    (DoD #5) so the 5-mechanics contract holds; their deep content is the
    scale-out phase.

Idempotent: item ids are uuid5(NS, exam_id:order) so re-running updates in
place and keeps the grader's (item_id, answer) Redis cache stable. Definition
mechanic/blueprint/pass_threshold are upserted; the definition row itself must
already exist (run seed_exam_questions first, or it is created minimally here).

Usage: python -m scripts.seed_exam_content
"""
from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

from sqlalchemy import delete, select

from app.database import async_session
from app.models.exam import ExamDefinition, ExamItem

# Stable namespace so uuid5 item ids never drift between reseeds.
_NS = uuid.UUID("e6a1d3c2-7b4f-4e2a-9c1d-000000000003")

# Deep per-exam item banks live as JSON fixtures (authored + legally verified
# via the exam-scale /ultracode workflow). Data-driven so content can be edited
# without touching code. exam-3 stays inline below as the reference template.
_CONTENT_DIR = Path(__file__).resolve().parent / "exam_content"


def _load_fixture(exam_id: str) -> list[dict]:
    path = _CONTENT_DIR / f"{exam_id}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _item_id(exam_id: str, order: int) -> uuid.UUID:
    return uuid.uuid5(_NS, f"{exam_id}:{order}")


# ── Definition overrides: mechanic + blueprint + per-exam threshold ──────────
# `blueprint.items` = ordered [{type, count}] the start endpoint assembles into
# the attempt. `pass_threshold` replaces the hardcoded flat 88 (DECISION-D):
# AI-graded free-text exams use a realistic certifiable bar; rule-graded MCQ
# stays high.
DEFINITION_OVERRIDES: dict[str, dict] = {
    "exam-1": {
        "title": "Основы банкротства физлица",
        "description": "Жёсткие MCQ + числа и сроки ФЗ-127 (гл. X): пороги, сроки, прожиточный минимум.",
        "categories": ["Сроки и пороги", "Прожиточный минимум", "Процедуры физлиц"],
        "mechanic": "hard_mcq",
        "pass_threshold": 88,
        "blueprint": {"items": [{"type": "mcq", "count": 8}, {"type": "numeric", "count": 3}], "shuffle": False},
    },
    "exam-2": {
        "title": "Процедура банкротства физлица",
        "description": "Порядок процедур и сопоставление статей ↔ действий (sequencing / matching).",
        "categories": ["Порядок процедур", "Статьи и последствия", "Оспаривание сделок"],
        "mechanic": "sequencing",
        "pass_threshold": 88,
        "blueprint": {"items": [{"type": "sequencing", "count": 3}, {"type": "matching", "count": 3}], "shuffle": False},
    },
    "exam-3": {
        "title": "Анализ дела (банкротство физлица)",
        "description": "Дан факт-паттерн — напишите юридический анализ. AI-оценка по рубрике с заземлением на ФЗ-127.",
        "categories": ["Единственное жильё", "Оспоримые сделки", "Выбор процедуры"],
        "mechanic": "case_analysis",
        "pass_threshold": 88,
        "blueprint": {"items": [{"type": "case_analysis", "count": 3}], "shuffle": False},
    },
    "exam-4": {
        "title": "Документ по делу физлица",
        "description": "Составьте реальный процессуальный документ. AI-оценка полноты и юр-корректности.",
        "categories": ["Заявление о банкротстве", "Опись имущества", "МФЦ"],
        "mechanic": "document_drafting",
        "pass_threshold": 88,
        "blueprint": {"items": [{"type": "document_drafting", "count": 2}], "shuffle": False},
    },
    "exam-5": {
        "title": "Капстоун: мок-дело физлица",
        "description": "Сквозное симулированное дело: смешанные шаги, тайм-пресс, высокий порог. AI-оценка свободных шагов.",
        "categories": ["Комплексное дело", "Стратегия", "Все процедуры"],
        "mechanic": "multi_step",
        "pass_threshold": 88,
        "blueprint": {"items": [{"type": "multi_step", "count": 1}], "shuffle": False},
    },
}


# ── exam-3 reference content (deep) ──────────────────────────────────────────
EXAM3_ITEMS: list[dict] = [
    {
        "order_index": 0,
        "type": "case_analysis",
        "points": 8,
        "difficulty": 3,
        "article_reference": "ст. 446 ГПК РФ; Постановление КС РФ № 15-П от 26.04.2021; ст. 213.25 ФЗ-127",
        "prompt": "Проанализируйте, подлежит ли квартира реализации, и при каких условиях иммунитет может быть преодолён.",
        "payload": {
            "fact_pattern": (
                "Должник Петров, долги перед банками 4 млн ₽. Единственное жильё — 3-комнатная "
                "квартира 120 м² в центре Москвы, кадастровая стоимость 35 млн ₽, в залоге не находится. "
                "Кредитор в деле о банкротстве физлица требует включить квартиру в конкурсную массу "
                "как «роскошное жильё, явно превышающее разумные потребности»."
            ),
        },
        "rubric": {
            "key_points": [
                {"id": "kp1", "weight": 3, "required": True,
                 "text": "По ст. 446 ГПК РФ единственное пригодное для проживания жильё имеет исполнительский иммунитет и по общему правилу не включается в конкурсную массу."},
                {"id": "kp2", "weight": 3, "required": True,
                 "text": "Постановление КС РФ № 15-П от 26.04.2021 допускает преодоление иммунитета для явно избыточного («роскошного») жилья, НО только при предоставлении должнику замещающего жилья в том же населённом пункте по норме предоставления площади, по судебной процедуре."},
                {"id": "kp3", "weight": 2,
                 "text": "Само по себе превышение площади/стоимости не лишает иммунитета автоматически — требуется судебный механизм с гарантией замещающего жилья; произвольное изъятие недопустимо."},
            ],
        },
        "answer_key": {
            "model_answer": (
                "Квартира как единственное жильё защищена исполнительским иммунитетом (ст. 446 ГПК РФ) "
                "и по общему правилу в массу не включается. Иммунитет можно преодолеть для роскошного жилья "
                "(Постановление КС РФ № 15-П) лишь при предоставлении замещающего жилья в том же поселении "
                "по судебной процедуре. Автоматическое изъятие по мотиву площади/стоимости неправомерно."
            ),
        },
        "rag_chunk_refs": ["ст. 446 ГПК РФ", "ст. 213.25 ФЗ-127"],
        "explanation": "Ключ: иммунитет единственного жилья (446 ГПК) + механизм КС РФ № 15-П с замещающим жильём.",
    },
    {
        "order_index": 1,
        "type": "case_analysis",
        "points": 8,
        "difficulty": 3,
        "article_reference": "ст. 61.2, 61.6, 213.32 ФЗ-127; ст. 10, 168, 19 ГК/ФЗ-127",
        "prompt": "Какие сделки и по каким основаниям вправе оспорить финансовый управляющий? Каковы последствия?",
        "payload": {
            "fact_pattern": (
                "За 2 года до подачи заявления о банкротстве должник продал автомобиль (рыночная стоимость "
                "1,2 млн ₽) своему сыну за 100 000 ₽. За 4 года до подачи он подарил земельный участок другу. "
                "Кредиторы заявляют о выводе активов."
            ),
        },
        "rubric": {
            "key_points": [
                {"id": "kp1", "weight": 3, "required": True,
                 "text": "Продажа авто сыну по заниженной цене — подозрительная сделка с неравноценным встречным предоставлением (п.1 ст. 61.2, период 1 год) и/или во вред кредиторам (п.2 ст. 61.2, период 3 года); сын — заинтересованное лицо (ст. 19), действует презумпция цели причинения вреда."},
                {"id": "kp2", "weight": 3, "required": True,
                 "text": "Дарение участка за 4 года выходит за трёхлетний период подозрительности ст. 61.2, по специальным банкротным основаниям не оспаривается; возможна лишь общегражданская недействительность (ст. 10, 168 ГК) при доказывании злоупотребления."},
                {"id": "kp3", "weight": 2,
                 "text": "Последствие признания сделки недействительной — возврат имущества или его стоимости в конкурсную массу (ст. 61.6); приобретатель включается в реестр требований на возвращённое."},
            ],
        },
        "answer_key": {
            "model_answer": (
                "Авто, проданное сыну за бесценок 2 года назад, оспоримо по ст. 61.2 ФЗ-127 (неравноценность / вред, "
                "сын — заинтересованное лицо). Дарение участка 4 года назад за пределами трёхлетнего периода 61.2 — "
                "только по ст. 10, 168 ГК. Последствие — возврат в массу по ст. 61.6, приобретатель в реестр."
            ),
        },
        "rag_chunk_refs": ["ст. 61.2 ФЗ-127", "ст. 61.6 ФЗ-127", "ст. 213.32 ФЗ-127"],
        "explanation": "Ключ: периоды подозрительности (1/3 года), заинтересованное лицо, реституция в массу.",
    },
    {
        "order_index": 2,
        "type": "case_analysis",
        "points": 6,
        "difficulty": 2,
        "article_reference": "ст. 213.13, 213.14, 213.24 ФЗ-127",
        "prompt": "Обоснуйте, какая процедура применима, ключевые условия и срок.",
        "payload": {
            "fact_pattern": (
                "Должник 39 лет, официальный доход 90 000 ₽/мес, долги 1,5 млн ₽, иждивенцев нет, "
                "ранее банкротом не признавался, судимостей за экономические преступления нет."
            ),
        },
        "rubric": {
            "key_points": [
                {"id": "kp1", "weight": 2, "required": True,
                 "text": "Применима реструктуризация долгов: есть стабильный доход и соблюдены требования ст. 213.13 (доход, отсутствие судимости за эк. преступления, не банкротился 5 лет, нет плана реструктуризации за 8 лет)."},
                {"id": "kp2", "weight": 2,
                 "text": "План реструктуризации утверждается на срок не более 3 лет (ст. 213.14) и должен сохранять должнику средства не менее прожиточного минимума."},
                {"id": "kp3", "weight": 2,
                 "text": "Реализация имущества (ст. 213.24) вводится, если реструктуризация невозможна / план не одобрен / нарушен; при доходе 90к и долге 1,5 млн план реалистичен, поэтому первична реструктуризация."},
            ],
        },
        "answer_key": {
            "model_answer": (
                "Первична реструктуризация долгов: доход 90к стабилен, условия ст. 213.13 выполнены. План — "
                "до 3 лет (ст. 213.14) с сохранением прожиточного минимума. Реализация (213.24) — запасной "
                "вариант при срыве плана."
            ),
        },
        "rag_chunk_refs": ["ст. 213.13 ФЗ-127", "ст. 213.14 ФЗ-127", "ст. 213.24 ФЗ-127"],
        "explanation": "Ключ: критерии 213.13, срок плана ≤3 лет, реализация как субсидиарная процедура.",
    },
]


# ── skeleton items giving exam-1/2/4/5 their distinct mechanics ──────────────
SKELETON_ITEMS: dict[str, list[dict]] = {
    "exam-1": [
        {
            "order_index": 0, "type": "mcq", "points": 1, "difficulty": 2,
            "article_reference": "ст. 213.4 ФЗ-127",
            "prompt": "При какой сумме обязательств у гражданина возникает ОБЯЗАННОСТЬ подать заявление о собственном банкротстве?",
            "payload": {"options": [
                {"id": "a", "text": "500 000 ₽ и невозможность исполнить обязательства перед другими кредиторами"},
                {"id": "b", "text": "300 000 ₽"},
                {"id": "c", "text": "250 000 ₽"},
                {"id": "d", "text": "1 000 000 ₽"},
                {"id": "e", "text": "Любая сумма при наличии просрочки более трёх месяцев"},
            ]},
            "answer_key": {"correct_option_id": "a"},
            "explanation": "ст. 213.4 п.1 ФЗ-127: обязанность подать заявление возникает при совокупных обязательствах не менее 500 000 ₽ и невозможности расчёта с другими кредиторами (заявление — в 30 рабочих дней). Трёхмесячная просрочка относится к ст. 213.3/213.6 (возбуждение дела по заявлению кредитора / признаки неплатёжеспособности), а не к обязанности самого гражданина.",
        },
        {
            "order_index": 1, "type": "numeric", "points": 1, "difficulty": 2,
            "article_reference": "ст. 213.4 ФЗ-127",
            "prompt": "В течение скольких рабочих дней гражданин обязан подать заявление с момента, когда узнал о невозможности удовлетворить требования кредиторов?",
            "payload": {"unit": "рабочих дней", "input_hint": "число"},
            "answer_key": {"value": 30, "tolerance": 0},
            "explanation": "ст. 213.4 ФЗ-127 — не позднее 30 рабочих дней.",
        },
    ],
    "exam-2": [
        {
            "order_index": 0, "type": "sequencing", "points": 4, "difficulty": 2,
            "article_reference": "гл. X ФЗ-127",
            "prompt": "Расставьте этапы дела о банкротстве физлица в правильном порядке.",
            "payload": {"steps": [
                {"id": "s1", "text": "Подача заявления о банкротстве"},
                {"id": "s2", "text": "Проверка обоснованности заявления судом"},
                {"id": "s3", "text": "Реструктуризация долгов"},
                {"id": "s4", "text": "Реализация имущества"},
                {"id": "s5", "text": "Завершение процедуры и освобождение от обязательств"},
            ]},
            "answer_key": {"order": ["s1", "s2", "s3", "s4", "s5"]},
            "explanation": "Заявление → проверка обоснованности → реструктуризация → реализация → завершение/освобождение (гл. X ФЗ-127).",
        },
        {
            "order_index": 1, "type": "matching", "points": 4, "difficulty": 2,
            "article_reference": "ст. 213.4, 213.11, 213.24, 213.28 ФЗ-127",
            "prompt": "Сопоставьте статью ФЗ-127 с её содержанием.",
            "payload": {
                "left": [
                    {"id": "l1", "text": "ст. 213.4"},
                    {"id": "l2", "text": "ст. 213.11"},
                    {"id": "l3", "text": "ст. 213.24"},
                    {"id": "l4", "text": "ст. 213.28"},
                ],
                "right": [
                    {"id": "r1", "text": "Обязанность/право подать заявление"},
                    {"id": "r2", "text": "Последствия введения реструктуризации (мораторий)"},
                    {"id": "r3", "text": "Реализация имущества гражданина"},
                    {"id": "r4", "text": "Освобождение гражданина от обязательств"},
                ],
            },
            "answer_key": {"pairs": {"l1": "r1", "l2": "r2", "l3": "r3", "l4": "r4"}},
            "explanation": "213.4 — заявление; 213.11 — реструктуризация/мораторий; 213.24 — реализация; 213.28 — освобождение.",
        },
    ],
    "exam-4": [
        {
            "order_index": 0, "type": "document_drafting", "points": 10, "difficulty": 3,
            "article_reference": "ст. 213.4 ФЗ-127",
            "prompt": "Составьте заявление гражданина о признании его банкротом: перечислите обязательные сведения и приложения.",
            "payload": {"fact_pattern": "Должник: Сидорова А.А., долги перед 3 банками на 1,8 млн ₽, доход 60 000 ₽/мес, 1 иждивенец."},
            "rubric": {"key_points": [
                {"id": "kp1", "weight": 2, "required": True, "text": "Наименование арбитражного суда и сведения о должнике (ФИО, СНИЛС/ИНН, адрес)."},
                {"id": "kp2", "weight": 2, "required": True, "text": "Сумма задолженности с расшифровкой по каждому кредитору и обоснование неплатёжеспособности."},
                {"id": "kp3", "weight": 2, "text": "Опись имущества и список всех кредиторов и должников (ст. 213.4 п.3)."},
                {"id": "kp4", "weight": 2, "text": "Наименование СРО для выбора финансового управляющего."},
                {"id": "kp5", "weight": 2, "text": "Перечень приложений (документы, подтверждающие долги, доход, состав семьи, уплата госпошлины и внесение вознаграждения управляющего на депозит суда)."},
            ]},
            "answer_key": {"model_answer": "Заявление с реквизитами суда, данными должника, суммой долга по кредиторам, обоснованием неплатёжеспособности, описью имущества, списком кредиторов, указанием СРО и приложениями (ст. 213.4)."},
            "rag_chunk_refs": ["ст. 213.4 ФЗ-127"],
            "explanation": "Обязательные элементы заявления гражданина по ст. 213.4 ФЗ-127.",
        },
    ],
    "exam-5": [
        {
            "order_index": 0, "type": "multi_step", "points": 10, "difficulty": 3,
            "article_reference": "гл. X ФЗ-127",
            "prompt": "Сквозной разбор мок-дела: оцените процедуру, риски оспаривания сделок и судьбу единственного жилья, обоснуйте итоговую стратегию.",
            "payload": {
                "fact_pattern": (
                    "Должник Кузнецов, доход 70 000 ₽/мес, долги 3 млн ₽, 1 иждивенец. Единственное жильё — "
                    "квартира 54 м² (в ипотеке у банка). За 1 год до подачи продал гараж знакомому по рыночной цене."
                ),
                "steps": [
                    {"id": "st1", "text": "Какая процедура применима и почему?"},
                    {"id": "st2", "text": "Подлежит ли ипотечная квартира реализации?"},
                    {"id": "st3", "text": "Есть ли основания оспорить продажу гаража?"},
                ],
            },
            "rubric": {"key_points": [
                {"id": "kp1", "weight": 4, "required": True, "text": "Единственное жильё, находящееся в ипотеке (залоге), не пользуется исполнительским иммунитетом ст. 446 ГПК и подлежит реализации целиком как предмет залога; залоговый кредитор удовлетворяется преимущественно (ст. 213.27, 138 ФЗ-127)."},
                {"id": "kp2", "weight": 3, "required": True, "text": "Продажа гаража по рыночной цене не является неравноценной сделкой — оснований для оспаривания по п.1 ст. 61.2 нет; оспаривание возможно лишь при доказанной цели вреда и осведомлённости покупателя (п.2 ст. 61.2)."},
                {"id": "kp3", "weight": 3, "text": "При доходе 70к, долге 3 млн и иждивенце оценить реалистичность плана реструктуризации (ст. 213.13-213.14) против реализации (ст. 213.24) с сохранением прожиточного минимума."},
            ]},
            "answer_key": {"model_answer": "Ипотечная квартира реализуется как залог (иммунитет 446 ГПК не действует на залог); продажа гаража по рынку не оспорима без цели вреда; выбор реструктуризация vs реализация по доходу и плану."},
            "rag_chunk_refs": ["ст. 446 ГПК РФ", "ст. 61.2 ФЗ-127", "ст. 213.24 ФЗ-127"],
            "explanation": "Капстоун: ипотечное жильё ≠ иммунитет, рыночная сделка не оспорима, выбор процедуры.",
        },
    ],
}


async def _upsert_definition(session, exam_id: str, ov: dict) -> None:
    d = (await session.execute(
        select(ExamDefinition).where(ExamDefinition.id == exam_id)
    )).scalar_one_or_none()
    if d is None:
        # Minimal create so the seed is self-sufficient if questions weren't seeded.
        d = ExamDefinition(
            id=exam_id,
            title=ov.get("title", exam_id),
            description=ov.get("description", ""),
            categories=["Банкротство физлиц"],
            question_count=0,
            time_limit_minutes=45,
            unlock_condition={},
            order_index=int(exam_id.split("-")[-1]) if exam_id.split("-")[-1].isdigit() else 0,
        )
        session.add(d)
    if "title" in ov:
        d.title = ov["title"]
    if "description" in ov:
        d.description = ov["description"]
    d.mechanic = ov["mechanic"]
    d.blueprint = ov["blueprint"]
    d.pass_threshold = ov["pass_threshold"]
    # Full access: open every exam (no sequential lock). Restore per-exam gating
    # by setting `unlock_condition: {"required_exam": "exam-N"}` in the override.
    d.unlock_condition = ov.get("unlock_condition", {})
    if "categories" in ov:
        d.categories = ov["categories"]
    if "time_limit_minutes" in ov:
        d.time_limit_minutes = ov["time_limit_minutes"]
    # `question_count` = how many items the candidate actually answers per attempt
    # (sum of blueprint counts), so the card stops showing the stale legacy 30/35.
    bp_items = (ov.get("blueprint") or {}).get("items") or []
    d.question_count = ov.get("question_count") or sum(int(i.get("count", 0)) for i in bp_items) or d.question_count


async def _reseed_items(session, exam_id: str, items: list[dict]) -> None:
    await session.execute(delete(ExamItem).where(ExamItem.exam_id == exam_id))
    for it in items:
        session.add(ExamItem(
            id=_item_id(exam_id, it["order_index"]),
            exam_id=exam_id,
            order_index=it["order_index"],
            type=it["type"],
            prompt=it["prompt"],
            payload=it.get("payload", {}),
            answer_key=it.get("answer_key", {}),
            rubric=it.get("rubric"),
            points=it.get("points", 1),
            rag_chunk_refs=it.get("rag_chunk_refs"),
            difficulty=it.get("difficulty", 1),
            article_reference=it.get("article_reference"),
            explanation=it.get("explanation", ""),
            is_active=True,
        ))


async def main() -> None:
    # exam-3 is the inline reference template; exam-1/2/4/5 load their deep,
    # legally-verified item banks from JSON fixtures (fall back to the inline
    # skeletons only if a fixture is missing).
    items_by_exam: dict[str, list[dict]] = {"exam-3": EXAM3_ITEMS}
    for exam_id in ("exam-1", "exam-2", "exam-4", "exam-5"):
        items_by_exam[exam_id] = _load_fixture(exam_id) or SKELETON_ITEMS.get(exam_id, [])
    async with async_session() as session:
        for exam_id, ov in DEFINITION_OVERRIDES.items():
            await _upsert_definition(session, exam_id, ov)
            await _reseed_items(session, exam_id, items_by_exam.get(exam_id, []))
        await session.commit()

    # Report.
    async with async_session() as session:
        for exam_id in DEFINITION_OVERRIDES:
            d = (await session.execute(
                select(ExamDefinition).where(ExamDefinition.id == exam_id)
            )).scalar_one()
            n = len((await session.execute(
                select(ExamItem).where(ExamItem.exam_id == exam_id)
            )).scalars().all())
            print(f"{exam_id}: mechanic={d.mechanic} threshold={d.pass_threshold} items={n}")


if __name__ == "__main__":
    asyncio.run(main())
