"""Regression: a long persona lead_source must not crash session-start.

Reference personas store a descriptive source sentence (up to ~86 chars) in
ClientProfile.lead_source. The column was varchar(50) → flush raised
StringDataRightTruncationError → the WS session went to `error`
("СВЯЗЬ ОБОРВАНА"). Two guards:
  1. the column is widened (≥ 100) so real persona sources fit, and
  2. _clamp_client_profile_strings truncates any String column to its declared
     length as a safety net so no value can ever crash a flush again.
"""
from app.models.roleplay import ClientProfile
from app.services.client_generator import _clamp_client_profile_strings


def test_lead_source_column_is_wide_enough_for_persona_sources():
    length = ClientProfile.__table__.columns["lead_source"].type.length
    assert length >= 100, f"lead_source varchar({length}) too narrow for persona source sentences"


def test_clamp_truncates_overlong_string_columns():
    p = ClientProfile()
    # archetype_code is varchar(50) — feed it 120 chars.
    p.archetype_code = "x" * 120
    p.gender = "y" * 80  # varchar(20)
    _clamp_client_profile_strings(p)
    assert len(p.archetype_code) == 50
    assert len(p.gender) == 20


def test_clamp_leaves_fitting_values_untouched():
    p = ClientProfile()
    src = "обратился по рекомендации знакомого, после определения арбитражного суда о субсидиарке"  # 86
    p.lead_source = src
    _clamp_client_profile_strings(p)
    assert p.lead_source == src  # fits in the widened column, not truncated
