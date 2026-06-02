"""Unit tests for the deterministic exam rule grader."""

import pytest

from app.services.exam_rule_grader import grade_rule_item


def test_mcq_correct_and_wrong():
    g = grade_rule_item("mcq", {"correct_option_id": "a"}, "a", 1)
    assert g.score == 1 and g.passed
    g = grade_rule_item("mcq", {"correct_option_id": "a"}, "b", 1)
    assert g.score == 0 and not g.passed


def test_multi_select_partial_and_penalised():
    key = {"correct_option_ids": ["a", "b", "c"]}
    # all correct
    assert grade_rule_item("multi_select", key, ["a", "b", "c"], 6).score == 6
    # 2 of 3 right, no wrong → 2/3
    assert grade_rule_item("multi_select", key, ["a", "b"], 6).score == pytest.approx(4.0)
    # 2 right + 1 wrong → (2-1)/3
    assert grade_rule_item("multi_select", key, ["a", "b", "z"], 6).score == pytest.approx(2.0)
    # all wrong → never below 0
    assert grade_rule_item("multi_select", key, ["x", "y", "z"], 6).score == 0.0


def test_numeric_tolerance_and_parsing():
    assert grade_rule_item("numeric", {"value": 30, "tolerance": 0}, "30", 1).passed
    assert grade_rule_item("numeric", {"value": 30, "tolerance": 0}, "30 дней", 1).passed
    assert grade_rule_item("numeric", {"value": 30, "tolerance": 2}, 31, 1).passed
    assert not grade_rule_item("numeric", {"value": 30, "tolerance": 0}, "31", 1).passed
    assert not grade_rule_item("numeric", {"value": 30, "tolerance": 0}, "abc", 1).passed


def test_sequencing_position_fraction():
    key = {"order": ["s1", "s2", "s3", "s4"]}
    assert grade_rule_item("sequencing", key, ["s1", "s2", "s3", "s4"], 4).score == 4
    # first two right, last two swapped → 2/4
    assert grade_rule_item("sequencing", key, ["s1", "s2", "s4", "s3"], 4).score == pytest.approx(2.0)
    assert grade_rule_item("sequencing", key, [], 4).score == 0.0


def test_matching_pair_fraction():
    key = {"pairs": {"l1": "r1", "l2": "r2", "l3": "r3", "l4": "r4"}}
    assert grade_rule_item("matching", key, {"l1": "r1", "l2": "r2", "l3": "r3", "l4": "r4"}, 4).score == 4
    assert grade_rule_item("matching", key, {"l1": "r1", "l2": "r2"}, 4).score == pytest.approx(2.0)
    assert grade_rule_item("matching", key, {"l1": "r9"}, 4).score == 0.0


def test_unknown_type_is_zero():
    g = grade_rule_item("freeform", {}, "whatever", 5)
    assert g.score == 0.0 and not g.passed
