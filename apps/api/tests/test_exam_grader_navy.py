"""Real-navy calibration smoke for the exam grader (EXAM_TZ §9b).

Skipped by default — it hits live deepseek-v4-pro via navy and costs tokens. Run
it deliberately when tuning rubrics or after a model bump:

    EXAM_NAVY_SMOKE=1 pytest tests/test_exam_grader_navy.py -s

Asserts the calibration invariant the skeptic panel cares about: a correct,
on-point legal analysis scores high and a lazy "всё спишут" answer scores low.
Verified manually 2026-06-02: GOLD→100% (8.0/8.0), GARBAGE→0%.
"""

import os

import pytest

from app.config import settings
from app.services import exam_grader

pytestmark = pytest.mark.skipif(
    os.getenv("EXAM_NAVY_SMOKE") != "1" or not settings.local_llm_api_key,
    reason="set EXAM_NAVY_SMOKE=1 with navy creds to run the live calibration smoke",
)

_PROMPT = (
    "Должник: Иванов, доход 45 000 ₽/мес, единственное жильё — квартира 38 м². "
    "За 2 года до подачи подарил автомобиль брату. Иждивенцы: 2 ребёнка. "
    "Проанализируйте: единственное жильё, оспоримость дарения, реструктуризация vs реализация."
)
_RUBRIC = {"key_points": [
    {"id": "kp1", "text": "Единственное жильё защищено исполнительским иммунитетом (ст. 446 ГПК)", "weight": 3, "required": True},
    {"id": "kp2", "text": "Дарение авто брату оспоримо по ст. 61.2 ФЗ-127 (3 года, заинтересованное лицо)", "weight": 3, "required": True},
    {"id": "kp3", "text": "При доходе 45к и 2 иждивенцах реструктуризация маловероятна, скорее реализация", "weight": 2},
]}
_GOLD = (
    "Единственное жильё защищено исполнительским иммунитетом по ст. 446 ГПК РФ, в конкурсную массу не включается. "
    "Дарение автомобиля брату за 2 года — подозрительная сделка по п.2 ст. 61.2 ФЗ-127, брат заинтересованное лицо, "
    "фин.управляющий вправе оспорить и вернуть авто в массу. Реструктуризация маловероятна: при 45 000 ₽ за вычетом "
    "прожиточного минимума на должника и 2 детей на трёхлетний план средств нет — суд введёт реализацию имущества."
)
_GARBAGE = "Ну квартиру заберут наверное, машину тоже. Спишут все долги через месяц, ничего платить не надо."


@pytest.mark.asyncio
async def test_live_grader_separates_gold_from_garbage():
    gold = await exam_grader.grade_item(
        item_id="navy-smoke-gold", item_type="case_analysis", prompt=_PROMPT,
        user_answer=_GOLD, max_score=8.0, rubric=_RUBRIC,
    )
    garbage = await exam_grader.grade_item(
        item_id="navy-smoke-garbage", item_type="case_analysis", prompt=_PROMPT,
        user_answer=_GARBAGE, max_score=8.0, rubric=_RUBRIC,
    )
    assert gold is not None and garbage is not None, "navy returned None — check creds/model"
    assert gold.percent >= 80, f"golden answer should score high, got {gold.percent}"
    assert garbage.percent <= 25, f"garbage answer should score low, got {garbage.percent}"
    assert gold.score > garbage.score
