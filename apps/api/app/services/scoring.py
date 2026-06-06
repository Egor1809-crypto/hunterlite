"""10-layer scoring engine v6 (P3 training-rework — ФЗ-127 legal consultation).

Weight distribution (constants L*_MAX / L*_MIN at module top — single source
of truth; positive maxima sum to EXACTLY 100):
    L1.  Script adherence    «Полнота выяснения обстоятельств»   max 18  (L1_MAX)
    L2.  Objection handling  «Отработка сомнений и страхов»       max 12  (L2_MAX)
    L3.  Communication       «Ясность и эмпатия»                  max 12  (L3_MAX)
    L4.  Anti-patterns       «Этические нарушения»          0..-15 penalty (L4_MIN)
    L5.  Result              «Корректность рекомендации»          max 18  (L5_MAX)
    L6.  Chain traversal     «Глубина разбора»                    max  5  (L6_MAX)
    L7.  Trap handling       DEAD — excluded from total                    (L7_MAX=0)
    L8.  Human Factor        «Поддержка должника»                 max 10  (L8_MAX)
    L9.  Narrative           DEAD — excluded from total                    (L9_MAX=0)
    L10. Legal Accuracy      «Правовая точность ФЗ-127»     -10..+25 weighty (L10_MIN/MAX)

  Σ positive = 18+12+12+18+5+10+25 = 100.
  total = clamp(0, 100, ΣLayers + L4(-) + L10(±) + α-judge[-8,+5]).

  The legacy v5 caps (22.5 / 18.75 / 15 / 11.25 / 7.5 / ±5) are RETIRED; this
  rebalance deliberately makes L5 (correct recommendation) and L10 (legal
  accuracy) the dominant signals of a *consultation*, not a sale.

Real-time layers: 1-8 (sent via WS hints)
Post-session layers: 9-10 (computed after session end)

Skill radar mapping (P3 — legal consultation rubric):
  empathy           → L3.empathy(40%) + L8.patience(30%) + L8.empathy_check(30%)
  knowledge         → L1(40%) + L10(60%)            [L7 dead → weight folded in]
  objection_handling → L2(60%) + L6(40%)            [L7 dead → weight folded in]
  stress_resistance → L4(40%) + L8.composure(30%) + L3.pace(30%)
  closing («Рекомендация») → L5(70%) + L2.check(30%) [L9 dead → weight folded in]
  qualification     → L1.discovery(40%) + L3.control(30%) + L3.listening(30%)
  time_management («Темп консультации») → L12(100%)
  legal_knowledge («Правовая точность ФЗ-127») → L10(100%) [L7 legal-trap dead]
  rapport_building  → L3.empathy(40%) + L8.warmth(30%) + L8.patience(30%)

  L7 (trap_handling) and L9 (narrative) are dead after P1 de-gamification:
  hidden from results and their radar weight redistributed above. The
  "adaptation" axis (L11 sales archetypes) is removed from the radar dict
  entirely — a 0-pinned axis misreads as a real weakness.
"""

import asyncio
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.scenario import Scenario
from app.models.training import Message, MessageRole, TrainingSession

logger = logging.getLogger(__name__)

# v3→v5 rescale factor: old 100pts → new 75pts
V3_RESCALE = 0.75

# ---------------------------------------------------------------------------
# P3 (training-rework) weight model — legal consultation (ФЗ-127).
#
# Single source of truth for every layer cap / floor. These constants are
# used EVERYWHERE a weight appears: layer-function caps, the `total` formula,
# the skill_radar normalizers, and the rule-based recommendation thresholds.
# Changing a weight here propagates with no risk of a desynced hardcoded
# denominator. Storage field names (ScoreBreakdown attrs, session.score_*,
# SKILL_NAMES / RUBRIC_METRICS keys) are NOT touched — only the numeric
# weights / caps / normalizers behind them.
#
# Positive maxima sum to EXACTLY 100:
#   L1 18 + L2 12 + L3 12 + L5 18 + L6 5 + L8 10 + L10 25 = 100
# L4 is a pure penalty (0..L4_MIN), L10 spans L10_MIN..L10_MAX. L7 and L9
# are dead after de-gamification (max = 0, excluded from `total`). The
# α-judge nudge ([JUDGE_MIN, JUDGE_MAX]) and L4/L10 negatives are applied
# on top, then `total` is clamped to [0, 100].
# ---------------------------------------------------------------------------
L1_MAX = 18.0    # script_adherence — «Полнота выяснения обстоятельств»
L2_MAX = 12.0    # objection_handling — «Отработка сомнений и страхов»
L3_MAX = 12.0    # communication — «Ясность и эмпатия»
L4_MIN = -15.0   # anti_patterns — «Этические нарушения» (penalty floor)
L5_MAX = 18.0    # result — «Корректность рекомендации»
L6_MAX = 5.0     # chain_traversal — «Глубина разбора»
L7_MAX = 0.0     # trap_handling — DEAD (excluded from total)
L8_MAX = 10.0    # human_factor — «Поддержка должника»
L9_MAX = 0.0     # narrative_progression — DEAD (excluded from total)
L10_MAX = 25.0   # legal_accuracy — «Правовая точность ФЗ-127» (positive cap)
L10_MIN = -10.0  # legal_accuracy — gross-error floor

# α LLM-judge nudge bounds (unchanged from prior model).
JUDGE_MIN = -8.0
JUDGE_MAX = 5.0

# Internal raw maxima of the legacy layer scorers, BEFORE rescale to the
# L*_MAX targets above. Each layer function builds a raw sub-score sum on
# these scales; we then linearly remap raw → [0, L*_MAX]. Keeping the raw
# math intact preserves the proven sub-score logic; only the final scale
# changes. (Legacy values: raw L1/L5 came in on a 0-10 *checkpoint/result*
# scale already multiplied by 0.225 / V3_RESCALE; see each function.)
_RAW_L2_MAX = 25.0   # 5 sub-scores × 5
_RAW_L3_MAX = 20.0   # 4 sub-scores × 5
_RAW_L5_MAX = 10.0   # path(5) + next_step(5)
_RAW_L8_MAX = 15.0   # patience(5) + empathy_check(5) + composure(5)
_RAW_L4_MIN = -15.0  # legacy penalty floor (false/intimidation/incorrect, etc.)
# legal_checker + vector both return a combined value on a [-5, +5] scale;
# we remap it asymmetrically to [L10_MIN, L10_MAX] so correctness is heavily
# rewarded and gross errors bite. See _score_legal_accuracy.
_RAW_L10_SPAN = 5.0  # combined ∈ [-5, +5]


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ScoreBreakdown:
    """Full 12-layer score breakdown (v6: DOC_06)."""
    # P3 weight model (caps = module constants L*_MAX / L*_MIN)
    script_adherence: float       # L1: 0..L1_MAX (18)
    objection_handling: float     # L2: 0..L2_MAX (12)
    communication: float          # L3: 0..L3_MAX (12)
    anti_patterns: float          # L4: L4_MIN..0 (-15..0)
    result: float                 # L5: 0..L5_MAX (18)
    chain_traversal: float        # L6: 0..L6_MAX (5)
    trap_handling: float          # L7: DEAD (0)

    # v5 layers
    human_factor: float           # L8: 0..L8_MAX (10)
    narrative_progression: float  # L9: DEAD (0)
    legal_accuracy: float         # L10: L10_MIN..L10_MAX (-10..+25)

    total: float                  # 0-100 clamped

    # v6 bonus layers (DOC_06)
    adaptation: float = 0.0       # L11: 0-7.5
    time_management: float = 0.0  # L12: 0-5.0
    details: dict = field(default_factory=dict)

    @property
    def base_score(self) -> float:
        """Sum of L1-L7 (the rescaled old layers)."""
        return (
            self.script_adherence
            + self.objection_handling
            + self.communication
            + self.anti_patterns
            + self.result
            + self.chain_traversal
            + self.trap_handling
        )

    @property
    def realtime_score(self) -> float:
        """Sum of L1-L8 + L11-L12 bonus (available during session via WS)."""
        return self.base_score + self.human_factor + self.adaptation + self.time_management

    @property
    def skill_radar(self) -> dict[str, float]:
        """Compute 10-skill radar from 12 layer scores (DOC_06). Returns 0-100 per skill.

        S3-07: All L3 and L8 sub-scores are now stored normalized to [0, 1].
        This eliminates the V3_RESCALE bias where L3 (max 3.75) was artificially
        33% lower than L8 (max 5.0) on skill radar visualization.
        """
        details = self.details

        # check_score sub-score is stored on the raw 0-5 scale (see
        # _score_objection_handling); normalize against that, not a layer cap.
        _L2_CHECK_MAX = 5.0

        # L10 spans [L10_MIN, L10_MAX]; normalize to [0,1] across the full
        # span so a 0 legal_accuracy lands at the neutral midpoint, not 0.
        def _norm_l10(v: float) -> float:
            span = L10_MAX - L10_MIN
            return _normalize(v - L10_MIN, span)

        # ── empathy (L3 empathy + L8 patience + L8 empathy_check) ──
        # S3-07: sub-scores are already [0,1] — use directly as weights
        empathy_l3 = details.get("communication", {}).get("empathy_score", 0)
        empathy_l8_patience = details.get("human_factor", {}).get("patience_score", 0)
        empathy_l8_empathy = details.get("human_factor", {}).get("empathy_check_score", 0)
        empathy = (
            empathy_l3 * 0.4
            + empathy_l8_patience * 0.3
            + empathy_l8_empathy * 0.3
        ) * 100

        # ── knowledge (L1·0.4 + L10·0.6) ──
        # P3: L7 (trap_handling) is dead after de-gamification — its 0.3
        # weight is folded into L1/L10 (L1 0.3→0.4, L10 0.4→0.6) so the
        # axis keeps a full [0,1] span instead of collapsing on a zeroed L7.
        knowledge_l1 = _normalize(self.script_adherence, L1_MAX) * 0.4
        knowledge_l10 = _norm_l10(self.legal_accuracy) * 0.6
        knowledge = (knowledge_l1 + knowledge_l10) * 100

        # ── objection_handling (L2·0.6 + L6·0.4) ──
        # P3: L7's 0.2 weight removed (dead); redistributed to L2/L6.
        oh_l2 = _normalize(self.objection_handling, L2_MAX) * 0.6
        oh_l6 = _normalize(self.chain_traversal, L6_MAX) * 0.4
        objection_handling_val = (oh_l2 + oh_l6) * 100

        # ── stress_resistance (L4 + L8 composure + L3 pace) ──
        # L4 ∈ [L4_MIN, 0]; shift by -L4_MIN so 0-penalty → 1.0, full → 0.0.
        sr_l4 = _normalize(self.anti_patterns - L4_MIN, -L4_MIN) * 0.4
        sr_l8_composure = details.get("human_factor", {}).get("composure_score", 0) * 0.3
        sr_l3_pace = details.get("communication", {}).get("pace_score", 0) * 0.3
        stress_resistance = (sr_l4 + sr_l8_composure + sr_l3_pace) * 100

        # ── closing → «Рекомендация» (L5·0.7 + L2check·0.3) ──
        # P3: L9 (narrative_progression) is dead after de-gamification —
        # its 0.3 weight folds into L5 (0.5→0.7). The FE relabels this axis
        # «Рекомендация» (correctness of the recommended path), not «Закрытие».
        closing_l5 = _normalize(self.result, L5_MAX) * 0.7
        closing_l2_check = _normalize(
            details.get("objection_handling", {}).get("check_score", 0), _L2_CHECK_MAX
        ) * 0.3
        closing = (closing_l5 + closing_l2_check) * 100

        # ── qualification (L1 discovery + L3 control + L3 listening) ──
        qual_l1_disc = _normalize(
            details.get("script_adherence", {}).get("discovery_score", 0), 10
        ) * 0.4
        qual_l3_ctrl = details.get("communication", {}).get("control_score", 0) * 0.3
        qual_l3_listen = details.get("communication", {}).get("listening_score", 0) * 0.3
        qualification = (qual_l1_disc + qual_l3_ctrl + qual_l3_listen) * 100

        # ── time_management → «Темп консультации» (100% from L12) ──
        time_management = _normalize(self.time_management, 5.0) * 100

        # ── legal_knowledge → «Правовая точность ФЗ-127» (L10·1.0) ──
        # P3: L7 legal-trap component removed (L7 dead). L10 is now the sole
        # legal signal and carries the full weight, normalized across its
        # full [L10_MIN, L10_MAX] span.
        legal_knowledge = _norm_l10(self.legal_accuracy) * 100

        # ── NEW: rapport_building (40% L3 empathy + 30% L8 warmth + 30% L8 patience) ──
        warmth_l8 = details.get("human_factor", {}).get("warmth_score", 0)
        rapport = (
            empathy_l3 * 0.4
            + warmth_l8 * 0.3
            + empathy_l8_patience * 0.3
        ) * 100

        def _clamp(v: float) -> float:
            return round(min(100, max(0, v)), 1)

        return {
            "empathy": _clamp(empathy),
            "knowledge": _clamp(knowledge),
            "objection_handling": _clamp(objection_handling_val),
            "stress_resistance": _clamp(stress_resistance),
            "closing": _clamp(closing),
            "qualification": _clamp(qualification),
            "time_management": _clamp(time_management),
            # P3: "adaptation" axis (L11 — sales archetypes) removed. L11 is
            # dead after de-gamification; an axis pinned at 0 misreads as a
            # real weakness. Dropped coherently here, in analytics.py, and
            # in the FE SKILL_LABELS so no consumer expects the key.
            "legal_knowledge": _clamp(legal_knowledge),
            "rapport_building": _clamp(rapport),
        }


def compose_total_from_layers(
    *,
    script_adherence: float,   # L1: 0..L1_MAX
    objection_handling: float, # L2: 0..L2_MAX
    communication: float,      # L3: 0..L3_MAX
    anti_patterns: float,      # L4: L4_MIN..0
    result: float,             # L5: 0..L5_MAX
    chain_traversal: float,    # L6: 0..L6_MAX
    human_factor: float,       # L8: 0..L8_MAX
    legal_accuracy: float,     # L10: L10_MIN..L10_MAX
    judge_score: float = 0.0,  # α: [JUDGE_MIN, JUDGE_MAX]
) -> float:
    """Compose the clamped 0-100 ``total`` from the live weighted layers.

    Single source of truth for the P3 weight model behind ``total``. L7 (trap)
    and L9 (narrative) are DEAD (L7_MAX=L9_MAX=0) and excluded. The positive
    maxima sum to EXACTLY 100 (L1+L2+L3+L5+L6+L8+L10 = 18+12+12+18+5+10+25);
    L4 and L10 may be negative, the α-judge adds [JUDGE_MIN, JUDGE_MAX], and
    the result is clamped to [0, 100].

    ``calculate_scores`` calls this so the runtime total and the regression
    tests assert on the same formula — no risk of a desynced inline sum.
    """
    total = (
        float(script_adherence or 0)
        + float(objection_handling or 0)
        + float(communication or 0)
        + float(anti_patterns or 0)
        + float(result or 0)
        + float(chain_traversal or 0)
        # L7 (trap) EXCLUDED — dead layer
        + float(human_factor or 0)
        # L9 (narrative) EXCLUDED — dead layer
        + float(legal_accuracy or 0)
        + float(judge_score or 0)
    )
    return max(0.0, min(100.0, total))


def _normalize(value: float, max_value: float) -> float:
    """Normalize value to 0-1 range."""
    if max_value <= 0:
        return 0.0
    return max(0.0, min(1.0, value / max_value))


# ---------------------------------------------------------------------------
# Objection-handling patterns (Russian) — unchanged from v3
# ---------------------------------------------------------------------------

OBJECTION_PATTERNS = [
    r"не\s*(уверен|знаю|хочу|нужн|интересн)",
    r"зачем\s+мне",
    r"у\s+меня\s+уже\s+есть",
    r"дорого|ставк[аи]\s+выше",
    r"мне\s+нужно\s+подумать",
    r"сомневаюсь",
    r"не\s+вижу\s+смысл",
    r"в\s+другом\s+банке",
    r"скрыт.+комисси",
    r"а\s+вдруг",
    r"а\s+если",
    r"боюсь",
    r"гарантии",
]

ACKNOWLEDGE_PATTERNS = [
    r"(я\s+)?вас?\s+понимаю",
    r"понимаю\s+ваш[еу]",
    r"вы\s+правы",
    r"хорош(ий|ая)\s+вопрос",
    r"справедлив",
    r"согласен",
    r"конечно",
    r"действительно",
    r"резонн",
]

CLARIFY_PATTERNS = [
    r"а\s+почему",
    r"расскажите\s+подробнее",
    r"что\s+именно\s+(вас|вам)",
    r"можете\s+уточнить",
    r"что\s+для\s+вас\s+важно",
    r"какой\s+опыт",
    r"с\s+чем\s+связан",
]

ARGUMENT_PATTERNS = [
    r"\d+\s*%",
    r"\d+\s*(рублей|тысяч|млн|руб)",
    r"например",
    r"в\s+отличие\s+от",
    r"преимущество",
    r"выгод[аы]",
    r"экономи[тья]",
    r"снижа[ея]т",
    r"потому\s+что",
    r"дело\s+в\s+том",
]

CHECK_PATTERNS = [
    r"это\s+отвечает",
    r"снял[аи]?\s+(ваш|этот)",
    r"остались\s+.*вопрос",
    r"что\s+думаете",
    r"как\s+вам",
    r"устраивает",
    r"подходит",
]


def _has_pattern(text: str, patterns: list[str]) -> bool:
    text_lower = text.lower()
    return any(re.search(p, text_lower) for p in patterns)


def count_human_moment_messages(user_messages: list[str]) -> int:
    """Count how many user messages are "human moments" (off-topic, typos, gibberish).

    Used to reduce scoring penalties: these messages should not be counted against
    the manager's script adherence, communication, or anti-pattern scores because
    the AI client is expected to react naturally, not continue the sales script.

    Returns count of messages that are human moments (0 = no adjustment needed).
    """
    from app.services.emotion_v6 import detect_human_moment

    count = 0
    for msg in user_messages:
        trigger = detect_human_moment(msg)
        if trigger is not None:
            count += 1
    return count


def apply_human_moment_adjustment(
    raw_score: float,
    max_score: float,
    human_moment_count: int,
    total_messages: int,
) -> float:
    """Adjust a layer score to compensate for human-moment messages.

    Logic: if 2 out of 20 messages were off-topic, don't penalize the manager
    for those 2 messages. Scale the score as if those messages didn't exist.

    The adjustment is capped at 20% of total messages to prevent abuse.
    """
    if human_moment_count == 0 or total_messages == 0:
        return raw_score

    # Cap: at most 20% of messages can be "forgiven"
    forgiven = min(human_moment_count, int(total_messages * 0.2))
    if forgiven == 0:
        return raw_score

    effective_messages = total_messages - forgiven
    if effective_messages <= 0:
        return raw_score

    # Scale score proportionally: if 18 of 20 messages were "real",
    # the score should be evaluated as if there were only 18 messages
    ratio = total_messages / effective_messages
    adjusted = raw_score * min(ratio, 1.15)  # Cap boost at 15%
    return min(adjusted, max_score)


# ---------------------------------------------------------------------------
# Layer scoring functions
# ---------------------------------------------------------------------------

def _score_objection_handling(
    user_messages: list[str],
    assistant_messages: list[str],
) -> tuple[float, dict]:
    """L2: «Отработка сомнений и страхов» (0..L2_MAX pts).

    Sub-scores (each 0-5, raw sum 0.._RAW_L2_MAX=25):
    recognized(5) + acknowledged(5) + clarified(5) + argued(5) + checked(5) = 25
    Raw is then linearly remapped to [0, L2_MAX] via _rescale_l2.
    The ``check_score`` sub-score is stored on the raw 0-5 scale.
    """
    def _rescale_l2(raw: float) -> float:
        return _normalize(raw, _RAW_L2_MAX) * L2_MAX
    objections_found = 0
    for msg in assistant_messages:
        if _has_pattern(msg, OBJECTION_PATTERNS):
            objections_found += 1

    if objections_found == 0:
        # If no user messages at all, award 0 (empty session exploit)
        if not user_messages:
            return 0.0, {
                "objections_found": 0,
                "note": "empty session — no user messages",
                "check_score": 0.0,
            }
        # No objections means easy conversation — award HALF credit, not full.
        _half_score = L2_MAX * 0.5  # 50% of max L2
        return _half_score, {
            "objections_found": 0,
            "note": "no objections raised — partial credit (easy scenario)",
            "check_score": 2.5,  # raw 0-5 scale
        }

    heard = False
    acknowledged = False
    clarified = False
    argued = False
    checked = False

    for user_msg in user_messages:
        # BUG-10 fix: "heard" means the manager acknowledged the objection,
        # not merely asked a clarifying question. Require ACKNOWLEDGE only.
        if _has_pattern(user_msg, ACKNOWLEDGE_PATTERNS):
            heard = True
            acknowledged = True
        if _has_pattern(user_msg, CLARIFY_PATTERNS):
            clarified = True
        if _has_pattern(user_msg, ARGUMENT_PATTERNS):
            argued = True
        if _has_pattern(user_msg, CHECK_PATTERNS):
            checked = True

    raw_score = 0.0
    if heard:
        raw_score += 5
    if acknowledged:
        raw_score += 5
    if clarified:
        raw_score += 5
    if argued:
        raw_score += 5
    if checked:
        raw_score += 5

    check_raw = 5.0 if checked else 0.0

    return _rescale_l2(raw_score), {
        "objections_found": objections_found,
        "heard": heard,
        "acknowledged": acknowledged,
        "clarified": clarified,
        "argued": argued,
        "checked": checked,
        "check_score": check_raw,  # raw 0-5 scale
    }


def _score_communication(user_messages: list[str]) -> tuple[float, dict]:
    """L3: «Ясность и эмпатия» (0..L3_MAX pts).

    Sub-scores (each 0-5, raw sum 0.._RAW_L3_MAX=20):
    empathy(5) + listening(5) + pace(5) + control(5) = 20 → remap to [0, L3_MAX].
    """
    if not user_messages:
        return 0.0, {"note": "no user messages"}

    score = 0.0
    details: dict[str, Any] = {}

    # 1. Empathy (5 pts raw)
    empathy_patterns = [
        r"понимаю.*(чувств|переживан|ситуаци)",
        r"на\s+вашем\s+месте",
        r"это\s+(важно|неприятно|сложно)",
        r"вас\s+понимаю",
        r"(ваши?\s+)?беспокойств",
        r"сочувств",
    ]
    empathy_found = any(_has_pattern(msg, empathy_patterns) for msg in user_messages)
    empathy_raw = 5.0 if empathy_found else 1.0
    details["empathy_detected"] = empathy_found
    # S3-07: Store normalized [0,1] sub-scores (not rescaled raw)
    details["empathy_score"] = round(empathy_raw / 5.0, 3)
    score += empathy_raw

    # 2. Active listening (5 pts raw)
    avg_len = sum(len(m) for m in user_messages) / len(user_messages)
    long_messages = sum(1 for m in user_messages if len(m) > 500)
    listening_raw = 5.0
    if long_messages > len(user_messages) * 0.5:
        listening_raw = 2.0
    details["avg_message_length"] = round(avg_len, 1)
    details["listening_score"] = round(listening_raw / 5.0, 3)
    score += listening_raw

    # 3. Pace (5 pts raw)
    if len(user_messages) > 1:
        lengths = [len(m) for m in user_messages]
        mean_len = sum(lengths) / len(lengths)
        variance = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
        cv = (variance ** 0.5) / max(mean_len, 1)
        pace_raw = 5.0 if cv < 1.5 else max(0, 5.0 - (cv - 1.5) * 2)
    else:
        pace_raw = 4.0
    details["pace_score"] = round(pace_raw / 5.0, 3)
    score += pace_raw

    # 4. Conversation control (5 pts raw)
    polite_patterns = [
        r"здравствуйте", r"добрый\s+(день|вечер|утро)",
        r"спасибо", r"пожалуйста", r"будьте\s+добры",
        r"извините", r"благодар",
    ]
    # Count MESSAGES containing any polite marker, not total pattern matches.
    # Previously counted each pattern match separately — a single message with
    # "спасибо, пожалуйста" was double-counted, saturating control_raw too easily.
    polite_count = sum(
        1 for msg in user_messages
        if any(re.search(pat, msg.lower()) for pat in polite_patterns)
    )
    control_raw = min(5.0, 2.0 + polite_count * 1.0)
    details["polite_markers"] = polite_count
    details["control_score"] = round(control_raw / 5.0, 3)
    score += control_raw

    return _normalize(min(_RAW_L3_MAX, score), _RAW_L3_MAX) * L3_MAX, details


async def _score_anti_patterns(
    user_messages: list[str],
    *,
    mistake_counts: dict[str, int] | None = None,
) -> tuple[float, dict]:
    """L4: «Этические нарушения» (0 to L4_MIN=-15 penalty).

    false promises(-5) + intimidation(-5) + incorrect info(-5) = -15 floor.
    The raw penalty scale already matches L4_MIN, so no rescale is applied —
    the per-category and aggregate penalties below are summed and floored
    at L4_MIN directly.

    Parameters
    ----------
    mistake_counts : optional ``{type: count}`` dict from
        ``mistake_aggregator.fetch_counts`` (BUG B3 v3 — β). When present,
        adds capped per-type penalties for monologue / talk_ratio_high /
        repeated_argument so absence-of-skill habits visible in the
        real-time coaching toasts also depress the final score. The
        existing ``-15.0`` floor at the end of this function bounds the
        combined L4 penalty unchanged.
    """
    from app.services.script_checker import detect_anti_patterns

    combined_text = " ".join(user_messages)
    detected = await detect_anti_patterns(combined_text)

    penalty = 0.0
    details: dict = {"detected": []}

    category_penalties = {
        "false_promises": -5.0,
        "intimidation": -5.0,
        "incorrect_info": -5.0,
        # 2026-05-04 (BUG B3 fix): rudeness/disrespect penalty.
        # Slightly heavier than the misleading-client categories because
        # it represents an unrecoverable client experience — the AI
        # client will hang up and the manager loses the lead. Without
        # this knob a session where the manager hurls insults still
        # accrued ~30+ baseline points from L1/L8 (verified prod
        # session f517266a-e127-4c38-aea9-ab47b90e81ad scored 34/100).
        # The -7.0 cap × V3_RESCALE 0.75 = -5.25 visible deduction;
        # combined with hangup L5=0 it now caps that pattern around
        # 25 instead of 34 and surfaces a "вы были грубы → клиент
        # повесил трубку" line in the breakdown.
        "disrespect_to_client": -7.0,
    }

    # Per-category cap: only the worst detection counts per category
    seen_categories: set[str] = set()
    for item in detected:
        cat = item["category"]
        if cat in seen_categories:
            # Already penalized this category — skip duplicate
            details["detected"].append({
                "category": cat,
                "score": item["score"],
                "penalty": 0.0,
                "note": "duplicate category — capped",
            })
            continue
        seen_categories.add(cat)
        pen = category_penalties.get(cat, -3.0)
        penalty += pen
        details["detected"].append({
            "category": cat,
            "score": item["score"],
            "penalty": pen,
        })

    # 2026-05-04 (BUG B3 fix): zero-open-questions penalty.
    # The mistake_detector emits a "no_open_question" coaching event in
    # real-time but its state is Redis-only and gets reset before
    # calculate_scores runs. Direct check on the full user_messages
    # array catches sessions where the manager NEVER asked a single
    # open question — a strong red flag a rule-based scorer should not
    # silently miss. Conservative: only fires after >=4 user messages
    # so we don't punish a 1-2-turn session that ended early.
    _OPEN_Q_RE = re.compile(
        r"\b(как|почему|зачем|что|когда|где|куда|откуда|расскажите|опишите|поделитесь|"
        r"какой|какая|какие|сколько|какая ситуация|в чём|в чем)\b",
        flags=re.IGNORECASE,
    )
    if len(user_messages) >= 4:
        any_open_q = any(
            "?" in m and _OPEN_Q_RE.search(m or "")
            for m in user_messages
        )
        if not any_open_q:
            zero_oq_penalty = -4.0
            penalty += zero_oq_penalty
            details["detected"].append({
                "category": "zero_open_questions",
                "score": 1.0,
                "penalty": zero_oq_penalty,
                "note": "За весь разговор не задано ни одного открытого вопроса",
            })

    # 2026-05-04 (BUG B3 v3 — β): aggregate penalties from real-time
    # mistake_detector firings. Toasts were visible in-session but the
    # scoring engine never saw them, so monologue / talk-ratio / repeat
    # habits had ZERO impact on the final score. Counts come from
    # ``mistake_aggregator.fetch_counts`` (Redis-backed, refreshed each
    # firing). Per-firing weights are deliberately conservative and
    # capped per-type because they aggregate across a long session;
    # the existing ``max(-15.0, penalty)`` floor below still bounds the
    # combined L4 penalty.
    if mistake_counts:
        aggregate_penalties = {
            "monologue": -1.5,         # per firing, capped at 3 firings
            "talk_ratio_high": -2.0,   # per firing, capped at 2 firings
            "repeated_argument": -1.0, # per firing, capped at 3 firings
            # no_open_question intentionally OMITTED — already covered
            # by the absence-based zero_open_questions penalty above.
            # early_pricing OMITTED — different stage-aware logic should
            # handle that, separate spike.
        }
        for mtype, per_pen in aggregate_penalties.items():
            n = int(mistake_counts.get(mtype, 0) or 0)
            if n <= 0:
                continue
            cap_n = 2 if mtype == "talk_ratio_high" else 3
            applied = per_pen * min(n, cap_n)
            penalty += applied
            details["detected"].append({
                "category": f"mistake_{mtype}",
                "score": float(n),
                "penalty": applied,
                "note": f"{mtype} сработало {n} раз(а) за разговор",
            })

    penalty = max(L4_MIN, penalty)
    return penalty, details


def _score_result(
    user_messages: list[str],
    emotion_timeline: list[dict] | None = None,
    *,
    rubric: dict | None = None,
) -> tuple[float, dict]:
    """L5: «Корректность рекомендации» (0..L5_MAX pts).

    P3 rework — this layer is FULLY DECOUPLED from any sale/deal/emotion
    outcome. It no longer reads ``call_outcome``, ``'agreed'``, acceptance,
    or the deal-emotion. It grades ONLY whether the consultant pointed the
    debtor to the *correct procedural path* under ФЗ-127 and closed with a
    concrete next step:

      path_recommended(0-5) — names a procedure (реструктуризация при
                              стабильном доходе / реализация имущества /
                              внесудебное банкротство через МФЦ) GROUNDED in
                              the debtor's situation, plus a добросовестность
                              (good-faith) caveat, not a false guarantee
      next_step(0-5)        — a concrete, lawful next step (документы /
                              заявление / подбор управляющего / запись на
                              разбор)
    Raw sum 0.._RAW_L5_MAX=10 is then remapped to [0, L5_MAX].

    PERSONA MODE: when ``rubric`` is supplied (persona.scoring_rubric), the
    "correct path" is judged against the persona's expected route. The rubric
    names the right procedure as free text inside ``metrics.result.criteria``
    (the validated schema location) — we extract procedure keywords from it and
    require the consultant to have recommended THAT route, not merely *a*
    procedure. (Legacy top-level ``correct_path`` / ``recommended_path`` keys
    are still read as a fallback but are not part of the seeded schema.) A
    consultant who proposes the wrong route for this debtor gets the
    "named a procedure" partial credit only, not the grounded full credit.

    ``emotion_timeline`` is accepted for signature compatibility but
    deliberately UNUSED — the prior version's emotion→deal coupling is gone.
    """
    score = 0.0
    details: dict = {}

    if not user_messages:
        return 0.0, {"note": "no messages"}

    # ── path_recommended (0-5) ──
    # A correct recommendation names a procedure (реструктуризация долгов or
    # реализация имущества) AND grounds it in the debtor's situation
    # (доход / имущество / план погашения). A bare mention of "банкротство"
    # with no path choice is partial credit.
    procedure_patterns = [
        r"реструктуризац",
        r"реализац(и|ии|ию)\s+имуществ",
        r"план\s+(погашен|реструктуриз)",
        r"процедур[аеуы]\s+(банкротств|реализац|реструктуриз)",
        r"внесудебн\w*\s+банкротств",
        r"упрощённ\w*\s+(порядок|банкротств)",
    ]
    grounding_patterns = [
        r"(?:ваш|при\s+таком)\s+доход",
        r"если\s+есть\s+(?:имуществ|доход|ипотек)",
        r"в\s+зависимости\s+от\s+(?:дохода|имущества|долга)",
        r"исходя\s+из\s+(?:вашей\s+ситуации|дохода|долга)",
        r"учитыва[яем].*(?:доход|имуществ|иждивен)",
    ]
    # A good-faith caveat — the lawful counterweight to a "всё спишут" promise.
    good_faith_patterns = [
        r"добросовестн",
        r"не\s+скрыва(?:ть|йте)\s+(?:имуществ|доход|сделк)",
        r"суд\s+(?:может\s+)?(?:не\s+освобод|откаж)",
        r"при\s+условии\s+добросовестн",
        r"если\s+(?:не\s+было|нет)\s+(?:фиктивн|преднамеренн)",
    ]

    procedure_named = any(_has_pattern(m, procedure_patterns) for m in user_messages)
    grounded = any(_has_pattern(m, grounding_patterns) for m in user_messages)
    good_faith = any(_has_pattern(m, good_faith_patterns) for m in user_messages)

    # ── PERSONA MODE: judge against the persona's expected correct path ──
    # The rubric's free-text correct-path hint is reduced to procedure
    # keyword-classes; we then check the consultant actually recommended
    # the RIGHT class for this debtor (not merely *some* procedure).
    _PATH_CLASSES = {
        "restructuring": [r"реструктуризац", r"план\s+погашен", r"стабильн\w*\s+доход"],
        "realization": [r"реализац(и|ии|ию)\s+имуществ", r"реализац\w*\s+имущества"],
        "mfc": [r"внесудебн", r"\bмфц\b", r"упрощённ\w*\s+(порядок|банкротств)"],
    }
    expected_class: str | None = None
    correct_path_match: bool | None = None
    if isinstance(rubric, dict):
        # The validated rubric schema (validate_personas.py) carries the
        # expected correct path as FREE TEXT inside metrics.result.criteria
        # (e.g. «Дал верную рекомендацию пути (реструктуризация при доходе…»).
        # The legacy top-level keys correct_path / recommended_path /
        # correct_recommendation are NOT part of the schema and are never
        # populated — reading them left this whole block inert. We read the
        # real location first and keep the legacy keys only as a fallback for
        # any hand-written rubric that happens to carry them.
        _cp_parts: list[str] = []
        _metrics = rubric.get("metrics")
        if isinstance(_metrics, dict):
            _result_metric = _metrics.get("result")
            if isinstance(_result_metric, dict):
                _cp_parts.append(str(_result_metric.get("criteria") or ""))
        for k in ("correct_path", "recommended_path", "correct_recommendation"):
            _cp_parts.append(str(rubric.get(k) or ""))
        _cp_text = " ".join(_cp_parts).lower()
        for _cls, _pats in _PATH_CLASSES.items():
            if any(re.search(p, _cp_text) for p in _pats):
                expected_class = _cls
                break
        if expected_class:
            consultant_text = " ".join(m.lower() for m in user_messages)
            correct_path_match = any(
                re.search(p, consultant_text) for p in _PATH_CLASSES[expected_class]
            )

    path_score = 0.0
    if procedure_named and grounded:
        path_score = 4.0
    elif procedure_named:
        path_score = 2.5
    if good_faith:
        path_score = min(5.0, path_score + 1.0)
    # Persona penalty: a procedure was named but it's the WRONG route for
    # this debtor → cap at partial credit (no grounded-full reward).
    if correct_path_match is False and path_score > 2.5:
        path_score = 2.5
        details["wrong_path_for_persona"] = True
    score += path_score

    details["path_recommended"] = procedure_named
    details["path_grounded_in_situation"] = grounded
    details["good_faith_caveat"] = good_faith
    details["path_score"] = round(path_score, 2)
    if expected_class is not None:
        details["expected_path_class"] = expected_class
        details["correct_path_match"] = correct_path_match

    # ── next_step (0-5) ──
    # A lawful, concrete next step — not a sales "meeting". Documents,
    # the заявление, choosing an arbitration manager, or booking a detailed
    # разбор all count.
    next_step_patterns = [
        r"подготов(?:им|ить|ьте)\s+(?:документ|заявлен)",
        r"собрать\s+(?:документ|справк|выписк)",
        r"подать\s+заявлен",
        r"список\s+кредитор",
        r"финансов\w*\s+управляющ",
        r"запиш[еи]\w*\s+на\s+(?:разбор|консультац)",
        r"следующ(?:ий|им)\s+шаг",
        r"что\s+(?:нужно|потребуется)\s+(?:сделать|подготовить)",
    ]
    next_step = any(_has_pattern(m, next_step_patterns) for m in user_messages)
    if next_step:
        score += 5.0
    details["next_step_given"] = next_step

    return _normalize(score, _RAW_L5_MAX) * L5_MAX, details


# ---------------------------------------------------------------------------
# L8: Human Factor Handling (0-15 pts) — NEW, real-time
# ---------------------------------------------------------------------------

def _score_human_factor(
    user_messages: list[str],
    assistant_messages: list[str],
    emotion_timeline: list[dict],
    custom_params: dict | None = None,
) -> tuple[float, dict]:
    """L8: «Поддержка должника» (0..L8_MAX pts).

    Raw sub-layer sum is on _RAW_L8_MAX=15 scale, remapped to [0, L8_MAX].

    Sub-layers:
    - Patience under aggression (0-5 pts): calm response to hostile/testing states
    - Empathy check (0-5 pts): emotional acknowledgment in negative states
    - Composure (0-5 pts): no counter-aggression, no panic phrases

    Also includes fake transition detection sub-score (bonus within patience).
    """
    score = 0.0
    details: dict[str, Any] = {}

    # ── Patience (0-5) ──
    hostile_turns = sum(
        1 for e in emotion_timeline
        if e.get("state") in ("hostile", "testing", "hangup")
    )
    total_turns = max(len(emotion_timeline), 1)
    hostile_ratio = hostile_turns / total_turns

    # Check if manager stayed calm during hostile states
    calm_during_hostile_patterns = [
        r"понимаю\s+(?:ваш[еу]?\s+)?(?:раздражение|недовольств|эмоц)",
        r"давайте\s+(?:спокойно|без\s+эмоц)",
        r"я\s+(?:вас?\s+)?слушаю",
        r"не\s+переживайте",
    ]
    aggressive_response_patterns = [
        r"(?:сам[иа]?\s+вы|да\s+вы\s+(?:что|как))",
        r"(?:не\s+кричите|хватит\s+(?:орать|кричать))",
        r"(?:грубит|хамит|невоспитанн)",
    ]

    calm_responses = 0
    aggressive_responses = 0
    for msg in user_messages:
        if _has_pattern(msg, calm_during_hostile_patterns):
            calm_responses += 1
        if _has_pattern(msg, aggressive_response_patterns):
            aggressive_responses += 1

    patience_score = 2.5  # base
    if hostile_ratio > 0.3:
        # Manager faced significant hostility
        if calm_responses >= 2 and aggressive_responses == 0:
            patience_score = 5.0
        elif calm_responses >= 1 and aggressive_responses == 0:
            patience_score = 4.0
        elif aggressive_responses > 0:
            patience_score = max(0, 2.5 - aggressive_responses * 1.0)
    elif hostile_ratio > 0:
        patience_score = 4.0 if aggressive_responses == 0 else 2.0
    else:
        patience_score = 3.0  # No hostility encountered — neutral score

    # Fake transition detection bonus (within patience)
    fake_detected = False
    if custom_params and custom_params.get("fake_transitions_detected"):
        fake_detected = True
        patience_score = min(5.0, patience_score + 1.0)
    # S3-07: Store normalized [0,1] sub-scores (unified scale with L3)
    details["patience_score"] = round(patience_score / 5.0, 3)
    details["fake_detected"] = fake_detected
    score += patience_score

    # ── Empathy check (0-5) ──
    negative_states = {"cold", "guarded", "hostile", "hangup"}
    negative_turns = [
        i for i, e in enumerate(emotion_timeline)
        if e.get("state") in negative_states
    ]

    empathy_in_negative_patterns = [
        r"(?:понимаю|представляю)\s+(?:как|что|ваш|каково)",
        r"(?:это|ваша)\s+(?:ситуация|проблема|беспокойство)\s+(?:понятн|серьёзн|важн)",
        r"(?:многие|другие)\s+(?:клиенты|люди)\s+(?:тоже|также)\s+(?:переживают|боятся|сомневаются)",
        r"(?:вы\s+не\s+один|мы\s+вместе|я\s+(?:помогу|на\s+вашей\s+стороне))",
    ]

    empathy_check_score = 2.0  # base
    if negative_turns:
        empathy_matches = sum(
            1 for msg in user_messages
            if _has_pattern(msg, empathy_in_negative_patterns)
        )
        if empathy_matches >= 3:
            empathy_check_score = 5.0
        elif empathy_matches >= 2:
            empathy_check_score = 4.0
        elif empathy_matches >= 1:
            empathy_check_score = 3.0
        else:
            empathy_check_score = 1.0
    details["empathy_check_score"] = round(empathy_check_score / 5.0, 3)
    score += empathy_check_score

    # ── Composure (0-5) ──
    panic_patterns = [
        r"(?:не\s+знаю\s+что\s+(?:делать|сказать)|я\s+(?:не\s+могу|теряюсь))",
        r"(?:подождите|секунду|минуточку|дайте\s+подумать)",
    ]
    panic_count = sum(1 for msg in user_messages if _has_pattern(msg, panic_patterns))

    composure_score = 5.0
    if aggressive_responses > 0:
        composure_score = max(0, composure_score - aggressive_responses * 2.0)
    if panic_count > 0:
        composure_score = max(0, composure_score - panic_count * 1.0)
    details["composure_score"] = round(composure_score / 5.0, 3)
    details["aggressive_responses"] = aggressive_responses
    details["panic_count"] = panic_count
    score += composure_score

    # ── Warmth (derived, not scored separately) ──
    # S3-07: warmth_score was referenced in skill_radar but never stored.
    # Derive from empathy_check + composure as a soft proxy.
    warmth_score = (empathy_check_score + composure_score) / 2.0
    details["warmth_score"] = round(warmth_score / 5.0, 3)

    # Raw sum is on _RAW_L8_MAX=15 scale → remap to [0, L8_MAX].
    return _normalize(min(_RAW_L8_MAX, score), _RAW_L8_MAX) * L8_MAX, details


# ---------------------------------------------------------------------------
# L9: Narrative Progression (0-10 pts) — post-session only
# ---------------------------------------------------------------------------

async def _score_narrative_progression(
    session_id: uuid.UUID,
    emotion_timeline: list[dict],
    db: AsyncSession,
) -> tuple[float, dict]:
    """L9: Narrative Progression (0-10 pts, post-session).

    Sub-layers:
    - Emotion arc quality (0-4): did the conversation progress logically?
    - Call objective met (0-3): was the goal of this specific call achieved?
    - Story advancement (0-3): for multi-call stories, did this call advance the arc?
    """
    score = 0.0
    details: dict[str, Any] = {}

    # ── Emotion arc quality (0-4) ──
    if not emotion_timeline:
        details["arc_score"] = 0.0
        details["arc_note"] = "no timeline"
    else:
        states = [e.get("state", "cold") for e in emotion_timeline]
        positive_states = {"curious", "considering", "negotiating", "deal"}
        terminal_positive = {"deal", "callback"}

        # Did conversation progress forward at any point?
        peak_index = 0
        state_order = {
            "cold": 0, "guarded": 1, "hostile": -1, "hangup": -2,
            "testing": 2, "curious": 3, "callback": 4,
            "considering": 5, "negotiating": 6, "deal": 7,
        }
        peak_val = state_order.get(states[0], 0)
        for idx, s in enumerate(states):
            v = state_order.get(s, 0)
            if v > peak_val:
                peak_val = v
                peak_index = idx

        # Score based on peak reached and ending
        final_state = states[-1]
        final_val = state_order.get(final_state, 0)

        arc_score = 0.0
        if final_state in terminal_positive:
            arc_score = 4.0
        elif peak_val >= 5:
            arc_score = 3.0 if final_val >= 3 else 2.0
        elif peak_val >= 3:
            arc_score = 2.0 if final_val >= 1 else 1.0
        else:
            arc_score = 0.5

        details["arc_score"] = arc_score
        details["peak_state"] = states[peak_index] if states else "cold"
        details["final_state"] = final_state
        score += arc_score

    # ── Call objective (0-3) ──
    session_result = await db.execute(
        select(TrainingSession).where(TrainingSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    objective_score = 0.0

    if session:
        # Check if session ended in a positive state
        emotion_tl = session.emotion_timeline or []
        if emotion_tl:
            last = emotion_tl[-1].get("state", "cold")
            if last == "deal":
                objective_score = 3.0
            elif last in ("callback", "considering", "negotiating"):
                objective_score = 2.0
            elif last in ("curious",):
                objective_score = 1.0

        # Multi-call bonus: check if this call was part of a story
        if session.client_story_id:
            objective_score = min(3.0, objective_score + 0.5)

    details["objective_score"] = objective_score
    score += objective_score

    # ── Story advancement (0-3) ──
    story_score = 0.0
    if session and session.client_story_id:
        from app.models.roleplay import ClientStory
        story_result = await db.execute(
            select(ClientStory).where(ClientStory.id == session.client_story_id)
        )
        story = story_result.scalar_one_or_none()
        if story:
            # Check progress through calls
            call_num = session.call_number_in_story or 1
            total_planned = story.total_calls_planned or 3
            progress_ratio = call_num / total_planned

            if story.is_completed:
                story_score = 3.0
            elif progress_ratio >= 0.66:
                story_score = 2.0
            elif progress_ratio >= 0.33:
                story_score = 1.5
            else:
                story_score = 1.0

            details["story_call"] = call_num
            details["story_total"] = total_planned
    details["story_score"] = story_score
    score += story_score

    # ── Hangup recovery bonus ──
    # If this call successfully recovered from a previous hangup in multi-call
    if session and session.scoring_details:
        _sd = session.scoring_details
        if _sd.get("had_hangup_recovery"):
            score += 5.0
            details["hangup_recovery_bonus"] = 5.0

    # ── 3.2: Promise fulfillment adjustment (CRM → Training link) ──
    # Kept promises boost L9, broken promises penalize it
    if session and session.scoring_details:
        promise_stats = session.scoring_details.get("_promise_stats")
        if promise_stats and promise_stats.get("total", 0) > 0:
            kept = promise_stats.get("kept", 0)
            broken = promise_stats.get("broken", 0)
            promise_bonus = min(1.5, kept * 0.5)       # +0.5 per kept, max +1.5
            promise_penalty = min(2.0, broken * 1.0)   # -1.0 per broken, max -2.0
            promise_delta = promise_bonus - promise_penalty
            score += promise_delta
            details["promise_kept"] = kept
            details["promise_broken"] = broken
            details["promise_delta"] = round(promise_delta, 1)

    return min(10.0, max(0.0, score)), details


# ---------------------------------------------------------------------------
# L10: Legal Accuracy (±5 modifier) — hybrid: regex (0.6) + vector (0.4)
# ---------------------------------------------------------------------------

async def _score_legal_accuracy_vector(
    session_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[float, dict]:
    """L10 vector component: semantic search against legal_knowledge_chunks.

    Checks manager messages against pgvector embeddings for nuanced accuracy.
    Returns score in [-5, +5] range and details dict.
    """
    from app.services.rag_legal import retrieve_legal_context

    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.sequence_number)
    )
    messages = msg_result.scalars().all()

    user_messages = [m.content for m in messages if m.role == MessageRole.user]
    if not user_messages:
        return 0.0, {"method": "vector", "claims_found": 0}

    # Legal claim indicators — quick keyword filter before expensive embedding
    _LEGAL_KEYWORDS = [
        "банкротств", "списан", "долг", "кредит", "имущество", "квартир",
        "суд", "127", "реструктуриз", "реализац", "управляющ", "госпошлин",
        "алимент", "ипотек", "кредитн", "мораторий", "арбитражн", "заявлен",
        "процедур", "освобожд", "обязательств", "конкурсн", "массы",
    ]

    score = 0.0
    checks = []
    claims_checked = 0

    for msg_text in user_messages:
        msg_lower = msg_text.lower()
        # Quick filter: skip messages without legal content
        if not any(kw in msg_lower for kw in _LEGAL_KEYWORDS):
            continue

        context = await retrieve_legal_context(msg_text, db, top_k=3, prefer_embedding=True)
        if not context.has_results:
            continue

        claims_checked += 1
        top = context.results[0]

        # Check if message matches a common error
        is_error = False
        for err in top.common_errors:
            if isinstance(err, str) and err.lower() in msg_lower:
                is_error = True
                score -= 2.0
                checks.append({
                    "type": "error",
                    "chunk_id": str(top.chunk_id),
                    "similarity": top.relevance_score,
                    "fact": top.fact_text[:100],
                    "matched_error": err[:80],
                    "method": context.method,
                })
                break

        if not is_error and top.relevance_score >= 0.5:
            # High similarity to a correct fact — positive signal
            score += 0.5
            checks.append({
                "type": "correct",
                "chunk_id": str(top.chunk_id),
                "similarity": top.relevance_score,
                "fact": top.fact_text[:100],
                "method": context.method,
            })

    clamped = max(-5.0, min(5.0, score))

    return clamped, {
        "method": "vector",
        "claims_checked": claims_checked,
        "vector_checks": checks[:10],
    }


async def _score_legal_accuracy(
    session_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[float, dict]:
    """L10: «Правовая точность ФЗ-127» (weighty: L10_MIN..L10_MAX modifier).

    Hybrid scoring: 0.6 × regex (legal_checker) + 0.4 × vector (rag_legal),
    each returning a value on the legacy [-5, +5] scale. The combined raw
    value is then remapped ASYMMETRICALLY to [L10_MIN, L10_MAX]: correct
    citations are rewarded heavily (up to +25) while gross legal errors bite
    (down to -10). The underlying RAG retrieval / regex matching logic (the
    L10 core) is unchanged — only the FINAL scale is widened.

    Falls back to 100% regex if vector search is unavailable.
    """
    REGEX_WEIGHT = 0.6
    VECTOR_WEIGHT = 0.4

    # ── Regex component (always available) ──
    regex_score = 0.0
    regex_details: dict = {"error": "legal_checker_unavailable"}
    try:
        from app.services.legal_checker import check_session_legal_accuracy
        result = await check_session_legal_accuracy(session_id, db)
        regex_score = result.total_score
        regex_details = {
            "checks_triggered": result.checks_triggered,
            "correct_cited": result.correct_cited,
            "correct": result.correct,
            "partial": result.partial,
            "incorrect": result.incorrect,
            "details": result.details[:10],
        }
    except Exception:
        logger.exception("L10 regex scoring failed for %s", session_id)

    # ── Vector component (may be unavailable) ──
    vector_score = 0.0
    vector_details: dict = {"method": "vector", "status": "skipped"}
    vector_available = False
    try:
        vector_score, vector_details = await _score_legal_accuracy_vector(session_id, db)
        vector_available = vector_details.get("claims_checked", 0) > 0
    except Exception:
        logger.warning("L10 vector scoring failed for %s — using regex only", session_id)

    # ── Combine ──
    if vector_available:
        combined = REGEX_WEIGHT * regex_score + VECTOR_WEIGHT * vector_score
        scoring_method = "hybrid"
    else:
        combined = regex_score
        scoring_method = "regex_only"

    # Clamp combined to the legacy [-_RAW_L10_SPAN, +_RAW_L10_SPAN] band first,
    # then remap ASYMMETRICALLY to [L10_MIN, L10_MAX]:
    #   combined > 0 → 0..L10_MAX   (correctness rewarded, scale ×5)
    #   combined < 0 → L10_MIN..0   (errors penalized, scale ×2)
    raw = max(-_RAW_L10_SPAN, min(_RAW_L10_SPAN, combined))
    if raw >= 0:
        scaled = (raw / _RAW_L10_SPAN) * L10_MAX
    else:
        scaled = (raw / _RAW_L10_SPAN) * (-L10_MIN)
    scaled = max(L10_MIN, min(L10_MAX, round(scaled, 2)))

    return scaled, {
        "scoring_method": scoring_method,
        "regex_weight": REGEX_WEIGHT if vector_available else 1.0,
        "vector_weight": VECTOR_WEIGHT if vector_available else 0.0,
        "regex_score": round(regex_score, 2),
        "vector_score": round(vector_score, 2),
        "raw_combined": round(combined, 2),
        "combined_score": round(scaled, 2),
        "l10_range": [L10_MIN, L10_MAX],
        "regex": regex_details,
        "vector": vector_details,
    }


# ---------------------------------------------------------------------------
# L11: Adaptation (DOC_06) — 0-7.5 pts
# ---------------------------------------------------------------------------

def _score_adaptation(
    user_messages: list[str],
    emotion_timeline: list[dict],
    archetype_code: str | None,
    details: dict,
) -> tuple[float, dict]:
    """L11: How well the manager adapts to the archetype. 3 sub-scores × 2.5."""
    import math
    import re

    TRIGGER_DETECTORS = {
        "facts": [r"\d+\s*%", r"\d+\s*(рублей|тысяч|млн)", r"статистик", r"исследован"],
        "social_proof": [r"другие\s+клиенты", r"многие\s+(?:люди|должники)", r"похожая\s+ситуация"],
        "empathy": [r"понимаю", r"сочувств", r"на\s+вашем\s+месте", r"чувств"],
        "patience": [r"не\s+торопитесь", r"давайте\s+не\s+спеша", r"без\s+давления"],
        "authority": [r"(?:закон|статья|127|ФЗ|кодекс)", r"(?:суд|арбитраж)", r"(?:эксперт|специалист)"],
        "urgency": [r"срочно", r"прямо\s+сейчас", r"не\s+откладыв", r"время\s+(?:идёт|уходит)"],
    }

    def _extract_triggers(msgs: list[str]) -> dict[str, float]:
        counts = {k: 0 for k in TRIGGER_DETECTORS}
        for msg in msgs:
            low = msg.lower()
            for trigger, patterns in TRIGGER_DETECTORS.items():
                if any(re.search(p, low) for p in patterns):
                    counts[trigger] += 1
        total = max(1, sum(counts.values()))
        return {k: v / total for k, v in counts.items()}

    def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
        keys = set(a) | set(b)
        dot = sum(a.get(k, 0) * b.get(k, 0) for k in keys)
        na = math.sqrt(sum(a.get(k, 0) ** 2 for k in keys))
        nb = math.sqrt(sum(b.get(k, 0) ** 2 for k in keys))
        return dot / (na * nb) if na > 0 and nb > 0 else 0.0

    # Sub-score 1: archetype_recognition (0-2.5)
    # Ideal trigger profiles per archetype group (DOC_05 §6.2)
    ARCHETYPE_IDEAL_TRIGGERS = {
        "resistance": {"facts": 0.8, "authority": 0.6, "patience": 0.4},
        "emotional": {"empathy": 0.9, "social_proof": 0.5, "patience": 0.6},
        "control": {"authority": 0.7, "facts": 0.6, "urgency": 0.5},
        "avoidance": {"patience": 0.8, "urgency": 0.6, "facts": 0.4},
        "special": {"empathy": 0.5, "facts": 0.5, "social_proof": 0.5},
        "cognitive": {"facts": 0.8, "urgency": 0.7, "patience": 0.3},
        "social": {"empathy": 0.8, "social_proof": 0.6, "patience": 0.4},
        "temporal": {"empathy": 0.6, "authority": 0.5, "urgency": 0.5},
        "professional": {"facts": 0.7, "authority": 0.6, "patience": 0.4},
        "compound": {"empathy": 0.5, "facts": 0.5, "authority": 0.5},
    }

    # Map archetype_code to group: use first segment before '_' or fallback
    _arch_group = (archetype_code or "").split("_")[0].lower()
    if _arch_group not in ARCHETYPE_IDEAL_TRIGGERS:
        # Heuristic mapping for known prefixes
        _GROUP_MAP = {
            "skeptic": "resistance", "denier": "resistance", "legal": "resistance",
            "angry": "emotional", "crying": "emotional", "anxious": "emotional",
            "dominant": "control", "micromanager": "control",
            "ghosting": "avoidance", "passive": "avoidance",
            "vip": "special", "celebrity": "special",
            "analytical": "cognitive", "engineer": "cognitive",
            "family": "social", "community": "social",
            "busy": "temporal", "deadline": "temporal",
            "expert": "professional", "cfo": "professional",
        }
        _arch_group = _GROUP_MAP.get(_arch_group, "compound")

    actual_triggers = _extract_triggers(user_messages)
    ideal_triggers = ARCHETYPE_IDEAL_TRIGGERS.get(_arch_group, ARCHETYPE_IDEAL_TRIGGERS["compound"])
    _sim = _cosine(actual_triggers, ideal_triggers)
    recognition_score = min(2.5, max(0.0, _sim * 2.5))

    # Sub-score 2: style_shift (0-2.5)
    style_shift_score = 1.5  # default
    if len(user_messages) >= 4:
        mid = len(user_messages) // 2
        first_half = _extract_triggers(user_messages[:mid])
        second_half = _extract_triggers(user_messages[mid:])
        shift_distance = 1 - _cosine(first_half, second_half)

        STATE_ORDER = {"cold": 0, "hostile": 0, "hangup": 0, "guarded": 1, "testing": 2,
                       "curious": 3, "callback": 4, "considering": 5, "negotiating": 6, "deal": 7}
        states = [e.get("state", "cold") for e in emotion_timeline if "state" in e]
        if len(states) >= 3:
            e_start = STATE_ORDER.get(states[0], 0)
            e_mid = STATE_ORDER.get(states[len(states) // 2], 0)
            e_end = STATE_ORDER.get(states[-1], 0)
            if e_mid <= e_start and shift_distance > 0.3 and e_end > e_mid:
                style_shift_score = 2.5
            elif e_mid <= e_start and shift_distance > 0.3:
                style_shift_score = 1.5
            elif e_end > e_start:
                style_shift_score = 2.0
            else:
                style_shift_score = 0.5

    # Sub-score 3: archetype_counter (0-2.5)
    # Checks if manager used the archetype's weakness trigger or
    # matched the recommended approach for the archetype group.
    counter_score = 1.0  # baseline
    if archetype_code and emotion_timeline:
        # If client reached deal/negotiating → manager found the right approach
        final_states = [e.get("state") for e in emotion_timeline[-3:] if "state" in e]
        if any(s in ("deal", "negotiating", "considering") for s in final_states):
            counter_score = 2.0
            # Bonus: if reached deal quickly (< 60% of messages)
            deal_idx = next(
                (i for i, e in enumerate(emotion_timeline) if e.get("state") in ("deal", "negotiating")),
                len(emotion_timeline),
            )
            if deal_idx < len(emotion_timeline) * 0.6:
                counter_score = 2.5
        elif any(s in ("curious",) for s in final_states):
            counter_score = 1.5
        elif any(s in ("hostile", "hangup") for s in final_states):
            counter_score = 0.0

    # v6 bonus: emotion awareness (0-1.25 extra)
    emotion_awareness_bonus = 0.0
    try:
        from app.services.emotion_v6 import score_emotion_awareness, IntensityLevel
        if emotion_timeline and len(emotion_timeline) >= 3:
            _last_state = emotion_timeline[-1].get("state", "cold")
            _last_intensity = IntensityLevel.MEDIUM  # default
            _manager_triggers = list(actual_triggers.keys())
            emotion_awareness_bonus = score_emotion_awareness(
                current_state=_last_state,
                intensity=_last_intensity,
                compound=None,
                micro=None,
                manager_triggers=_manager_triggers,
                archetype_group=_arch_group,
            )
    except Exception:
        pass

    total = min(7.5, recognition_score + style_shift_score + counter_score + emotion_awareness_bonus)
    adapt_details = {
        "recognition_score": round(recognition_score, 2),
        "style_shift_score": round(style_shift_score, 2),
        "counter_score": round(counter_score, 2),
        "emotion_awareness_bonus": round(emotion_awareness_bonus, 2),
    }
    return total, adapt_details


# ---------------------------------------------------------------------------
# L12: Time Management (DOC_06) — 0-5.0 pts
# ---------------------------------------------------------------------------

def _score_time_management(
    user_messages: list[str],
    assistant_messages: list[str],
    session_duration_seconds: float | None,
    typical_duration_minutes: float,
) -> tuple[float, dict]:
    """L12: Session pacing, timing, talk-listen balance. 3 sub-scores + penalties."""
    # Sub-score 1: optimal_duration (0-2.0)
    target_min = typical_duration_minutes or 10.0
    actual_min = (session_duration_seconds or 0) / 60.0
    ratio = actual_min / target_min if target_min > 0 else 1.0

    if 0.7 <= ratio <= 1.3:
        duration_score = 2.0
    elif 0.5 <= ratio < 0.7:
        duration_score = 1.0 + (ratio - 0.5) / 0.2
    elif 1.3 < ratio <= 1.6:
        duration_score = 1.0 + (1.6 - ratio) / 0.3
    else:
        duration_score = 0.0

    # Sub-score 2: silence_handling (0-1.5)
    short_client = sum(1 for m in assistant_messages if len(m.strip()) < 20)
    total_client = max(1, len(assistant_messages))
    silence_ratio = short_client / total_client

    CLARIFY_PATTERNS = [r"\?$", r"можете.*уточн", r"расскажите.*подробн", r"что.*имеете.*в виду"]
    import re
    clarifying = sum(1 for msg in user_messages if any(re.search(p, msg.lower()) for p in CLARIFY_PATTERNS))

    if silence_ratio > 0.3:
        silence_score = 1.5 if clarifying >= 2 else (1.0 if clarifying >= 1 else 0.5)
    else:
        silence_score = 1.0

    # Sub-score 3: talk_listen_ratio (0-1.5)
    user_chars = sum(len(m) for m in user_messages)
    assist_chars = sum(len(m) for m in assistant_messages)
    total_chars = max(1, user_chars + assist_chars)
    talk_ratio = user_chars / total_chars

    if talk_ratio <= 0.40:
        ratio_score = 1.5
    elif talk_ratio <= 0.50:
        ratio_score = 1.2
    elif talk_ratio <= 0.55:
        ratio_score = 1.0
    elif talk_ratio <= 0.70:
        ratio_score = 0.5
    else:
        ratio_score = 0.0

    # Penalties
    penalties = 0.0
    if talk_ratio > 0.70:
        penalties -= 2.0
    if (session_duration_seconds or 0) < 180:
        penalties -= 1.5

    total = max(0.0, min(5.0, duration_score + silence_score + ratio_score + penalties))
    tm_details = {
        "duration_score": round(duration_score, 2),
        "silence_score": round(silence_score, 2),
        "ratio_score": round(ratio_score, 2),
        "talk_ratio": round(talk_ratio, 3),
        "penalties": round(penalties, 2),
    }
    return total, tm_details


# ---------------------------------------------------------------------------
# Real-time scoring (L1-L8) — called during session via WS
# ---------------------------------------------------------------------------

async def calculate_realtime_scores(
    session_id: str | uuid.UUID,
    db: AsyncSession,
) -> dict:
    """Calculate real-time scores (L1-L8) for WS hints during active session.

    Phase 2 (B9): All 8 real-time layers calculated and sent.
    L9 (narrative) and L10 (legal) are post-session only.

    Returns a dict suitable for WS emission.
    """
    if isinstance(session_id, str):
        session_id = uuid.UUID(session_id)

    result = await db.execute(
        select(TrainingSession).where(TrainingSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        return {"error": "session_not_found", "total": 0}

    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.sequence_number)
    )
    messages = msg_result.scalars().all()

    user_messages = [m.content for m in messages if m.role == MessageRole.user]
    assistant_messages = [m.content for m in messages if m.role == MessageRole.assistant]
    emotion_timeline = session.emotion_timeline or []

    # L1: Script adherence (0-22.5)
    l1_score = 0.0
    try:
        scenario_result = await db.execute(
            select(Scenario).where(Scenario.id == session.scenario_id)
        )
        scenario = scenario_result.scalar_one_or_none()
        if scenario and scenario.script_id:
            from app.services.script_checker import get_session_checkpoint_progress
            message_history = [{"role": m.role.value, "content": m.content} for m in messages]
            progress = await get_session_checkpoint_progress(scenario.script_id, message_history)
            l1_score = progress["total_score"] / 100.0 * L1_MAX
    except Exception:
        logger.warning("Scoring layer L1 failed", exc_info=True)

    # L2: Objection handling (0-18.75)
    l2_score, _ = _score_objection_handling(user_messages, assistant_messages)

    # L3: Communication (0-15)
    l3_score, _ = _score_communication(user_messages)

    # L4: Anti-patterns (0 to -11.25 penalty)
    l4_penalty = 0.0
    try:
        l4_penalty, _ = await _score_anti_patterns(user_messages)
    except Exception:
        logger.warning("Scoring layer L4 failed", exc_info=True)

    # L5: Result (0-7.5)
    l5_score, _ = _score_result(user_messages, emotion_timeline)

    # L6: «Глубина разбора» (0..L6_MAX) — chain_score is 0-10 → remap.
    l6_score = 0.0
    try:
        from app.services.objection_chain import calculate_chain_score
        chain_data = await calculate_chain_score(session_id)
        l6_score = _normalize(float(chain_data.get("chain_score", 0)), 10.0) * L6_MAX
    except Exception:
        logger.warning("Scoring layer L6 failed", exc_info=True)

    # L7: Trap handling — DEAD (L7_MAX=0). Kept for payload shape only,
    # excluded from realtime_total below.
    l7_score = 0.0

    # L8: Human Factor (0-15)
    l8_score, _ = _score_human_factor(
        user_messages, assistant_messages, emotion_timeline,
        session.custom_params,
    )

    # v6.1: Human moment adjustment — don't penalize for off-topic/typo messages
    hm_count = count_human_moment_messages(user_messages)
    if hm_count > 0:
        total_user = len(user_messages)
        l1_score = apply_human_moment_adjustment(l1_score, L1_MAX, hm_count, total_user)
        l3_score = apply_human_moment_adjustment(l3_score, L3_MAX, hm_count, total_user)
        # Reduce anti-pattern penalty (human moments shouldn't count as anti-patterns)
        if l4_penalty < 0:
            forgiven = min(hm_count, int(total_user * 0.2))
            l4_penalty = l4_penalty * (1.0 - forgiven / max(total_user, 1) * 0.5)

    # Total (live L1-L8, excluding L7 dead + L9/L10 post-session).
    realtime_total = l1_score + l2_score + l3_score + l4_penalty + l5_score + l6_score + l8_score
    # Positive realtime maxima: L1+L2+L3+L5+L6+L8 = 18+12+12+18+5+10 = 75
    # (L4 penalty only, L7 dead). L10's +25 lands only after session end.
    max_possible = L1_MAX + L2_MAX + L3_MAX + L5_MAX + L6_MAX + L8_MAX  # 75

    return {
        "script_adherence": round(l1_score, 1),
        "objection_handling": round(l2_score, 1),
        "communication": round(l3_score, 1),
        "anti_patterns": round(l4_penalty, 1),
        "result": round(l5_score, 1),
        "chain_traversal": round(l6_score, 1),
        "trap_handling": round(l7_score, 1),
        "human_factor": round(l8_score, 1),
        "realtime_estimate": round(max(0, realtime_total), 1),
        "max_possible_realtime": round(max_possible, 1),
        "layers_count": 8,
        "note": "L9 (narrative) and L10 (legal) calculated after session end",
    }


# ---------------------------------------------------------------------------
# Full scoring (L1-L10) — called after session end
# ---------------------------------------------------------------------------

async def calculate_scores(
    session_id: str | uuid.UUID,
    db: AsyncSession,
) -> ScoreBreakdown:
    """Calculate full 10-layer scores for a completed training session.

    Layers 1-8: real-time capable
    Layers 9-10: post-session only
    Total: 0-100 clamped
    """
    if isinstance(session_id, str):
        session_id = uuid.UUID(session_id)

    result = await db.execute(
        select(TrainingSession).where(TrainingSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        logger.error("Session %s not found for scoring", session_id)
        return ScoreBreakdown(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, {"error": "session_not_found"})

    msg_result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.sequence_number)
    )
    messages = msg_result.scalars().all()

    user_messages = [m.content for m in messages if m.role == MessageRole.user]
    assistant_messages = [m.content for m in messages if m.role == MessageRole.assistant]

    # Guard: empty session (0 user messages) → all zeros, skip all LLM calls
    if len(user_messages) == 0:
        logger.warning("Session %s has 0 user messages — returning zero scores", session_id)
        return ScoreBreakdown(
            script_adherence=0,
            objection_handling=0,
            communication=0,
            anti_patterns=0,
            result=0,
            chain_traversal=0,
            trap_handling=0,
            human_factor=0,
            narrative_progression=0,
            legal_accuracy=0,
            total=0,
            details={"_completeness": 0.0, "_empty_session": True},
        )

    emotion_timeline = session.emotion_timeline or []
    all_details: dict = {}

    # ── L1: Script adherence (22.5 pts) ──
    script_score = 0.0
    script_details: dict = {"note": "no script assigned", "discovery_score": 0.0}

    scenario_result = await db.execute(
        select(Scenario).where(Scenario.id == session.scenario_id)
    )
    scenario = scenario_result.scalar_one_or_none()

    if scenario and scenario.script_id:
        from app.services.script_checker import get_session_checkpoint_progress
        message_history = [
            {"role": m.role.value, "content": m.content}
            for m in messages
        ]
        progress = await get_session_checkpoint_progress(
            scenario.script_id, message_history
        )
        raw_score = progress["total_score"]  # 0-100
        script_score = raw_score / 100.0 * L1_MAX  # Scale to [0, L1_MAX]
        script_details = {
            "raw_score": raw_score,
            "checkpoints": progress.get("checkpoints", []),
            "reached_count": progress.get("reached_count", 0),
            "total_count": progress.get("total_count", 0),
            "discovery_score": min(10.0, progress.get("reached_count", 0) * 2.5),
        }
    all_details["script_adherence"] = script_details

    # ── P3: load persona.scoring_rubric EARLY (before L1/L5 scoring) ──
    # The rubric is needed by:
    #   • L1 must_clarify coverage override (below, replaces checkpoint L1),
    #   • L5 _score_result(rubric=...) correct-path judging,
    #   • the diagnostic rubric_eval overlay + α-judge (later in this fn).
    # Loaded once here; downstream blocks reuse `_rubric`. fail-soft to {}.
    _rubric: dict = {}
    _persona_slug = (session.custom_params or {}).get("reference_persona_slug")
    if _persona_slug:
        try:
            from app.models.reference_persona import ReferencePersona
            _persona = (await db.execute(
                select(ReferencePersona).where(
                    ReferencePersona.slug == _persona_slug,
                )
            )).scalar_one_or_none()
            _rubric = (_persona.scoring_rubric or {}) if _persona else {}
        except Exception:
            logger.warning(
                "Persona rubric load failed for session %s", session_id,
                exc_info=True,
            )
            _rubric = {}

    # ── P3: L1 «Полнота выяснения обстоятельств» — persona must_clarify ──
    # When the session has a persona rubric with a must_clarify list, L1 is
    # measured by the FRACTION of must_clarify topics the consultant actually
    # raised (состав/сумма долга, доход, иждивенцы, жильё/ипотека, сделки,
    # стадия взыскания, …). Each rubric item carries topic keyword-classes;
    # we scan the consultant's turns for coverage. For non-persona sessions
    # the legacy checkpoint mechanic above stays as the fallback (script_score
    # is left untouched).
    _must_clarify = [str(x) for x in (_rubric.get("must_clarify") or [])]
    if _must_clarify:
        _TOPIC_PATTERNS = {
            "debt": [r"долг", r"задолжен", r"сумм\w*\s+долг", r"кредит", r"займ"],
            "income": [r"доход", r"зарплат", r"заработок", r"работа\w*", r"пенси"],
            "dependents": [r"иждивен", r"дет(и|ей|ям)", r"супруг", r"семь"],
            "housing": [r"жиль[её]", r"квартир", r"ипотек", r"дом\b", r"единствен\w*\s+жиль"],
            "deals": [r"сделк", r"продал\w*", r"подарил\w*", r"переоформ", r"дарени"],
            "collection_stage": [r"взыскан", r"пристав", r"суд\b", r"исполнительн", r"приказ"],
            "property": [r"имуществ", r"машин\w*|авто", r"вклад\w*|счет"],
        }
        _consultant_text = " ".join(m.lower() for m in user_messages)

        def _topic_classes(item_text: str) -> list[str]:
            low = item_text.lower()
            hit: list[str] = []
            for cls, pats in _TOPIC_PATTERNS.items():
                if any(re.search(p, low) for p in pats):
                    hit.append(cls)
            return hit

        covered = 0
        per_item: list[dict] = []
        for _item in _must_clarify:
            classes = _topic_classes(_item) or ["__generic__"]
            if classes == ["__generic__"]:
                # No recognizable topic-class in the rubric text — fall back
                # to a literal token search so an unusual must_clarify item
                # still has a chance to register as covered.
                toks = [t for t in re.findall(r"[а-яё]{4,}", _item.lower())]
                is_cov = any(t in _consultant_text for t in toks) if toks else False
            else:
                is_cov = any(
                    any(re.search(p, _consultant_text) for p in _TOPIC_PATTERNS[c])
                    for c in classes
                )
            if is_cov:
                covered += 1
            per_item.append({"item": _item, "covered": is_cov, "classes": classes})

        coverage = covered / len(_must_clarify) if _must_clarify else 0.0
        script_score = coverage * L1_MAX
        script_details["persona_must_clarify"] = {
            "covered": covered,
            "total": len(_must_clarify),
            "coverage": round(coverage, 3),
            "items": per_item,
        }
        script_details["discovery_score"] = min(10.0, covered * 2.5)
        all_details["script_adherence"] = script_details

    # ── P5 (2026-05-04): parallelise independent layers ──
    # Layers L2-L10 are independent given the immutable inputs above
    # (`messages`, `user_messages`, `assistant_messages`, `emotion_timeline`,
    # `session.scoring_details`). They each return a (score, details)
    # tuple that we assemble into `all_details` AFTER the gather. None
    # of them write to shared state during execution.
    #
    # Sync layers are dispatched via `asyncio.to_thread` so they don't
    # block the event loop while async layers do real network I/O.
    # Gathered together, finalize wall-clock drops from ~18 s
    # (sequential) to ~6 s in production traces (the slowest layer
    # dominates instead of the sum).
    #
    # Feature-flag gated: ``scoring_parallel_layers=True`` (default)
    # picks the gather path. ``False`` falls back to the historical
    # sequential block — kept for fast rollback if a layer turns out
    # to share hidden state we missed.

    # L4 prereq: fetch mistake_counts BEFORE the gather so the L4 coro
    # can use it as a captured value (avoids passing mutable through
    # the gather machinery).
    mistake_counts: dict[str, int] = {}
    try:
        from app.services.mistake_aggregator import fetch_counts as _fetch_mistake_counts
        from app.core.redis_pool import get_redis as _get_redis
        mistake_counts = await _fetch_mistake_counts(_get_redis(), str(session_id))
    except Exception:
        logger.debug("mistake_aggregator.fetch_counts failed for %s", session_id, exc_info=True)

    if getattr(settings, "scoring_parallel_layers", True):
        async def _l2() -> tuple[float, dict]:
            return await asyncio.to_thread(
                _score_objection_handling, user_messages, assistant_messages,
            )

        async def _l3() -> tuple[float, dict]:
            return await asyncio.to_thread(_score_communication, user_messages)

        async def _l4() -> tuple[float, dict]:
            return await _score_anti_patterns(
                user_messages, mistake_counts=mistake_counts,
            )

        # Run L2/L3/L4 in parallel. L1 (script_adherence) ran above
        # because it depends on the scenario lookup; L5-L10 keep their
        # current ordering since some read state from prior layers
        # (e.g. L5 reads call_outcome). This first wave alone is the
        # biggest win — L4's _llm_batch_similarity is the slowest in
        # the suite, and L2/L3 are pure-CPU sync that we trivially
        # offload to threads while L4 awaits network I/O.
        (
            (objection_score, objection_details),
            (comm_score, comm_details),
            (anti_penalty, anti_details),
        ) = await asyncio.gather(_l2(), _l3(), _l4())
    else:
        # Fallback path — bit-for-bit the previous sequential block.
        objection_score, objection_details = _score_objection_handling(
            user_messages, assistant_messages
        )
        comm_score, comm_details = _score_communication(user_messages)
        anti_penalty, anti_details = await _score_anti_patterns(
            user_messages, mistake_counts=mistake_counts,
        )

    all_details["objection_handling"] = objection_details
    all_details["communication"] = comm_details
    all_details["anti_patterns"] = anti_details

    # ── L5: Result (7.5 pts) ──
    # Check for hangup outcome — hangup = 0 pts for L5
    _scoring_details = session.scoring_details or {}
    _call_outcome = _scoring_details.get("call_outcome")
    if _call_outcome == "hangup":
        result_score = 0.0
        result_details = {
            "note": "должник прервал разговор — рекомендация не дана",
            "path_recommended": False,
            "next_step_given": False,
        }
    else:
        result_score, result_details = _score_result(
            user_messages, emotion_timeline, rubric=_rubric or None,
        )
        # Bonus for recovery after hangup in multi-call (scaled to L5_MAX).
        if _scoring_details.get("had_hangup_recovery"):
            result_score = min(result_score + L5_MAX * 0.25, L5_MAX)
            result_details["hangup_recovery_bonus"] = True
    all_details["result"] = result_details

    # ── L6: «Глубина разбора» (0..L6_MAX pts) ──
    # calculate_chain_score returns chain_score on a 0-10 scale; remap to
    # [0, L6_MAX]. (Legacy mapped 0-10 → 7.5 via V3_RESCALE.)
    chain_bonus = 0.0
    chain_details: dict = {"has_chain": False}
    try:
        from app.services.objection_chain import calculate_chain_score
        chain_data = await calculate_chain_score(session_id)
        _chain_raw = float(chain_data.get("chain_score", 0))
        chain_bonus = _normalize(_chain_raw, 10.0) * L6_MAX
        chain_details = chain_data.get("chain_details", {})
    except Exception:
        logger.debug("Chain scoring unavailable for session %s", session_id)
    all_details["chain_traversal"] = chain_details

    # ── L7: Trap handling (-7.5 to +7.5) ──
    trap_score = 0.0
    trap_details: dict = {"traps": [], "net_score": 0}
    try:
        from app.services.trap_detector import get_session_trap_state
        trap_state = await get_session_trap_state(session_id)
        trap_score = float(trap_state.net_score) * V3_RESCALE
        trap_details = {
            "traps": [
                {
                    "name": t.trap_name,
                    "category": t.category,
                    "status": t.status,
                    "delta": t.score_delta * V3_RESCALE,
                    "client_phrase": t.client_phrase,
                    "correct_example": t.correct_example,
                    "explanation": t.explanation,
                    "law_reference": t.law_reference,
                    "correct_keywords": t.correct_keywords_found,
                    "wrong_keywords": t.wrong_keywords_found,
                    "detection_level": t.detection_level,
                }
                for t in trap_state.activated
            ],
            "total_penalty": trap_state.total_penalty * V3_RESCALE,
            "total_bonus": trap_state.total_bonus * V3_RESCALE,
            "net_score": trap_state.net_score * V3_RESCALE,
        }
    except Exception:
        logger.debug("Trap scoring unavailable for session %s", session_id)
    all_details["trap_handling"] = trap_details

    # ── L8: Human Factor Handling (0-15 pts) ──
    human_score, human_details = _score_human_factor(
        user_messages, assistant_messages, emotion_timeline,
        session.custom_params,
    )
    all_details["human_factor"] = human_details

    # ── L9: Narrative Progression (0-10 pts, post-session) ──
    narrative_score, narrative_details = await _score_narrative_progression(
        session_id, emotion_timeline, db
    )
    all_details["narrative_progression"] = narrative_details

    # ── L10: Legal Accuracy (±5 modifier, post-session) ──
    legal_score, legal_details = await _score_legal_accuracy(session_id, db)
    all_details["legal_accuracy"] = legal_details

    # L10 accuracy metrics logging
    _l10_method = legal_details.get("scoring_method", "unknown")
    _l10_regex = legal_details.get("regex_score", 0)
    _l10_vector = legal_details.get("vector_score", 0)
    _l10_claims = legal_details.get("vector", {}).get("claims_checked", 0)
    logger.info(
        "L10 metrics session=%s method=%s regex=%.1f vector=%.1f combined=%.1f claims=%d",
        session_id, _l10_method, _l10_regex, _l10_vector, legal_score, _l10_claims,
    )

    # ── RAG Feedback Loop: capture L10 validation results ──
    try:
        from app.services.rag_feedback import record_training_feedback
        vector_checks = legal_details.get("vector", {}).get("vector_checks", [])
        if vector_checks:
            validation_results = []
            for vc in vector_checks:
                chunk_id = vc.get("chunk_id")
                if not chunk_id:
                    continue
                validation_results.append({
                    "chunk_id": chunk_id,
                    "accuracy": vc.get("type", "partial"),
                    "manager_statement": vc.get("fact", ""),
                    "score_delta": -2.0 if vc.get("type") == "error" else 0.5,
                })
            if validation_results:
                await record_training_feedback(
                    db,
                    session_id=session_id,
                    user_id=session.user_id,  # BUG-3 fix: was session_id
                    validation_results=validation_results,
                )
    except Exception as e:
        logger.warning("RAG feedback from L10 failed (non-critical): %s", e)

    # ── v6.1: Human moment adjustment (full scoring) ──
    hm_count = count_human_moment_messages(user_messages)
    if hm_count > 0:
        total_user = len(user_messages)
        script_score = apply_human_moment_adjustment(script_score, L1_MAX, hm_count, total_user)
        comm_score = apply_human_moment_adjustment(comm_score, L3_MAX, hm_count, total_user)
        if anti_penalty < 0:
            forgiven = min(hm_count, int(total_user * 0.2))
            anti_penalty = anti_penalty * (1.0 - forgiven / max(total_user, 1) * 0.5)
        all_details["_human_moment_count"] = hm_count
        all_details["_human_moment_adjustment"] = True

    # ── Completeness factor: scale scores by conversation depth ──
    # Short conversations (2-3 messages) shouldn't get inflated scores.
    # Factor: 3msg=0.3, 6msg=0.6, 10+=1.0
    user_msg_count = len(user_messages)
    completeness = min(1.0, user_msg_count / 10.0) if user_msg_count < 10 else 1.0
    all_details["_completeness"] = round(completeness, 2)
    all_details["_user_message_count"] = user_msg_count

    if completeness < 1.0:
        script_score *= completeness
        objection_score *= completeness
        comm_score *= completeness
        result_score *= completeness
        human_score *= completeness
        chain_bonus *= completeness
        # L4/L7/L9/L10 are penalties/bonuses — don't scale down penalties
        logger.info(
            "Session %s: short conversation (%d msgs), completeness=%.1f",
            session_id, user_msg_count, completeness,
        )

    # ── P3 (training-rework): consume persona.scoring_rubric ──
    # When the session was started from a ReferencePersona (slug lives in
    # custom_params["reference_persona_slug"]), load the persona and apply its
    # per-session scoring rubric:
    #   • metrics{script_adherence,objection_handling,communication,result}
    #     give per-session target/weight → we compute a normalized ATTAINMENT
    #     ratio (actual / target) for each mapped layer (L1/L2/L3/L5) and store
    #     it in details["rubric_eval"] for the results UI and analytics. This
    #     is a DIAGNOSTIC overlay only — it deliberately does NOT mutate the
    #     layer scores or the `total` math (per the cascade-normalization
    #     invariant: layer weights / total summing stay untouched).
    #   • must_clarify / red_flags are forwarded to the α-judge below so the
    #     LLM cross-checks the transcript against the persona's expected
    #     discovery items and known legal pitfalls.
    # Metric keys are STABLE mapping ids (do not rename) → fixed layer mapping.
    # NOTE: `_rubric` and `_persona_slug` were already loaded EARLY (before
    # L1/L5 scoring) so the layer functions could consume them. We reuse them
    # here for the diagnostic overlay + α-judge forwarding — no second DB read.
    _rubric_must_clarify: list[str] = []
    _rubric_red_flags: list[str] = []
    if _persona_slug:
        try:
            if _rubric:
                _metrics = _rubric.get("metrics", {}) or {}
                # Stable metric-id → (actual layer points, layer max) mapping.
                # Denominators are the P3 weight constants (no hardcoded caps).
                _METRIC_LAYER_MAP = {
                    "script_adherence": (script_score, L1_MAX),
                    "objection_handling": (objection_score, L2_MAX),
                    "communication": (comm_score, L3_MAX),
                    "result": (result_score, L5_MAX),
                }
                _metric_eval: dict[str, dict] = {}
                for _mkey, (_actual, _max) in _METRIC_LAYER_MAP.items():
                    _spec = _metrics.get(_mkey)
                    if not isinstance(_spec, dict):
                        continue
                    _target = float(_spec.get("target", 0) or 0)
                    _weight = float(_spec.get("weight", 0) or 0)
                    _norm_actual = _normalize(float(_actual or 0), _max)
                    # attainment: how close to the persona-specific target the
                    # manager got (1.0 = hit target; >1.0 = exceeded). Guard
                    # against target=0 to avoid div-by-zero.
                    _attainment = (
                        round(min(1.5, _norm_actual / _target), 3)
                        if _target > 0 else None
                    )
                    _metric_eval[_mkey] = {
                        "target": _target,
                        "weight": _weight,
                        "normalized_actual": round(_norm_actual, 3),
                        "attainment": _attainment,
                        "met": (_attainment is not None and _attainment >= 1.0),
                    }
                # weighted attainment across rubric metrics (diagnostic scalar).
                _wsum = sum(
                    e["weight"] for e in _metric_eval.values()
                    if e.get("attainment") is not None
                )
                _weighted = (
                    round(
                        sum(
                            min(1.0, e["attainment"]) * e["weight"]
                            for e in _metric_eval.values()
                            if e.get("attainment") is not None
                        ) / _wsum,
                        3,
                    )
                    if _wsum > 0 else None
                )
                _rubric_must_clarify = [
                    str(x) for x in (_rubric.get("must_clarify") or [])
                ]
                _rubric_red_flags = [
                    str(x) for x in (_rubric.get("red_flags") or [])
                ]
                all_details["rubric_eval"] = {
                    "persona_slug": _persona_slug,
                    "metrics": _metric_eval,
                    "weighted_attainment": _weighted,
                    "must_clarify": _rubric_must_clarify,
                    "red_flags": _rubric_red_flags,
                }
        except Exception:
            logger.warning(
                "Persona rubric consumption failed for session %s", session_id,
                exc_info=True,
            )

    # ── α (BUG B3 v3): LLM-as-judge nudge over the full transcript ──
    # Single shot at finalize time, range [-8, +5], fail-soft to 0.
    # Skip entirely on tiny conversations (cost guard — too short to score
    # meaningfully) and on any unexpected error (so a flaky LLM never
    # breaks finalize).
    judge_verdict = None
    judge_score = 0.0
    if len(user_messages) >= 4:
        try:
            from app.services.scoring_llm_judge import judge_transcript
            _custom_params = session.custom_params or {}
            _archetype = (
                _custom_params.get("archetype_code")
                or _custom_params.get("archetype")
            )
            _emotion_arc = [
                e.get("state") or e.get("emotion") or ""
                for e in emotion_timeline
                if isinstance(e, dict)
            ]
            _call_outcome = str(
                (session.scoring_details or {}).get("call_outcome") or "unknown"
            )
            _redis = None
            try:
                from app.core.redis_pool import get_redis
                _redis = get_redis()
            except Exception:
                _redis = None
            judge_verdict = await judge_transcript(
                session_id=str(session_id),
                user_messages=user_messages,
                assistant_messages=assistant_messages,
                archetype=_archetype,
                emotion_arc=_emotion_arc,
                call_outcome=_call_outcome,
                redis_client=_redis,
                must_clarify=_rubric_must_clarify,
                red_flags_checklist=_rubric_red_flags,
            )
            judge_score = float(judge_verdict.score_adjust)
        except Exception:
            logger.exception(
                "LLM judge failed for session %s — fail-soft to 0", session_id
            )
            judge_verdict = None
            judge_score = 0.0
    all_details["judge"] = (
        judge_verdict.model_dump() if judge_verdict is not None else None
    )

    # ── Total: sum live layers, clamp to [0, 100] ──
    # Positive maxima sum to EXACTLY 100 (L1_MAX+L2_MAX+L3_MAX+L5_MAX+L6_MAX
    # +L8_MAX+L10_MAX = 18+12+12+18+5+10+25 = 100). L4 and L10 may go
    # negative; the α-judge adds [JUDGE_MIN, JUDGE_MAX]. L7 (trap) and L9
    # (narrative) are DEAD (L7_MAX=L9_MAX=0) and are EXCLUDED from the sum —
    # their scores are still computed/stored for the details payload but
    # contribute zero weight.
    total = compose_total_from_layers(
        script_adherence=script_score,   # L1: 0..L1_MAX (18)
        objection_handling=objection_score,  # L2: 0..L2_MAX (12)
        communication=comm_score,        # L3: 0..L3_MAX (12)
        anti_patterns=anti_penalty,      # L4: L4_MIN..0 (-15..0)
        result=result_score,             # L5: 0..L5_MAX (18)
        chain_traversal=chain_bonus,     # L6: 0..L6_MAX (5)
        # L7 (trap_score) EXCLUDED — dead layer (L7_MAX=0)
        human_factor=human_score,        # L8: 0..L8_MAX (10)
        # L9 (narrative_score) EXCLUDED — dead layer (L9_MAX=0)
        legal_accuracy=legal_score,      # L10: L10_MIN..L10_MAX (-10..+25)
        judge_score=judge_score,         # α: LLM judge nudge, [JUDGE_MIN, JUDGE_MAX]
    )

    breakdown = ScoreBreakdown(
        script_adherence=round(script_score, 2),
        objection_handling=round(objection_score, 2),
        communication=round(comm_score, 2),
        anti_patterns=round(anti_penalty, 2),
        result=round(result_score, 2),
        chain_traversal=round(chain_bonus, 2),
        trap_handling=round(trap_score, 2),
        human_factor=round(human_score, 2),
        narrative_progression=round(narrative_score, 2),
        legal_accuracy=round(legal_score, 2),
        total=round(total, 1),
        details=all_details,
    )

    return breakdown


# ---------------------------------------------------------------------------
# Recommendations (LLM-based, updated for v5)
# ---------------------------------------------------------------------------

def _generate_rule_based_recommendations(scores: ScoreBreakdown) -> str:
    """Generate recommendations from 10-layer scores without LLM.

    Always works, instant. Returns markdown-formatted numbered list.

    P3: when the session had a persona rubric, this function ALSO consumes
    ``scores.details`` to ground its advice in the persona's expectations —
    NOT just the LLM-judge:
      • uncovered ``must_clarify`` topics → a targeted "выясните …" line
        (from ``details.script_adherence.persona_must_clarify.items``),
      • triggered ``red_flags`` / wrong-path-for-persona → a corrective line
        (from ``details.rubric_eval.red_flags`` and the L5 path-match flag).
    """
    # Thresholds = 2/3 of the new caps (constants — keep in sync via L*_MAX).
    LAYER_RULES = [
        ("script_adherence", L1_MAX * 2 / 3, L1_MAX,
         "**Полнота выяснения обстоятельств:** Соберите всю картину должника: сумма и состав долгов, доход, иждивенцы, жильё и ипотека, сделки за последние 3 года, стадия взыскания. Без этих фактов рекомендация по ФЗ-127 не может быть корректной."),
        ("objection_handling", L2_MAX * 2 / 3, L2_MAX,
         "**Отработка сомнений и страхов:** Используйте схему: услышать → признать → уточнить → объяснить → проверить. Самый частый страх — «отнимут квартиру»; снимайте его фактами закона, а не ложными гарантиями."),
        ("communication", L3_MAX * 2 / 3, L3_MAX,
         "**Ясность и эмпатия:** Объясняйте простыми словами, без канцелярита. Признавайте тяжесть ситуации: «Понимаю, это непростое решение». Слушайте и перефразируйте сказанное должником."),
        ("human_factor", L8_MAX * 2 / 3, L8_MAX,
         "**Поддержка должника:** Сохраняйте спокойствие и терпение. Если должник раздражён или напуган — не отвечайте резко, покажите, что вы на его стороне в рамках закона."),
        ("result", L5_MAX * 2 / 3, L5_MAX,
         "**Корректность рекомендации:** Назовите верный путь — реструктуризация долгов или реализация имущества — исходя из дохода и имущества должника. Предупредите о требовании добросовестности и дайте конкретный следующий шаг (документы, заявление, разбор)."),
        ("chain_traversal", L6_MAX * 2 / 3, L6_MAX,
         "**Глубина разбора:** На разные сомнения приводите разные доводы. Если довод не убедил — зайдите с другой стороны, а не повторяйте тот же аргумент."),
    ]

    recs: list[str] = []
    _details = scores.details or {}

    # ── P3: persona-rubric–driven recommendations (highest priority) ──
    # 1) Uncovered must_clarify topics → name them explicitly.
    _mc = (_details.get("script_adherence") or {}).get("persona_must_clarify")
    if isinstance(_mc, dict):
        _uncovered = [
            str(i.get("item"))
            for i in (_mc.get("items") or [])
            if isinstance(i, dict) and not i.get("covered")
        ]
        if _uncovered:
            _shown = "; ".join(_uncovered[:5])
            recs.append(
                "**Не выяснены ключевые обстоятельства:** по эталону этого должника "
                f"вы не уточнили: {_shown}. Без этих фактов рекомендация по ФЗ-127 "
                "не может быть корректной — задайте эти вопросы в начале консультации."
            )

    # 2) Persona red_flags / wrong path for this debtor → corrective line.
    _rubric_eval = _details.get("rubric_eval")
    _red_flags: list[str] = []
    if isinstance(_rubric_eval, dict):
        _red_flags = [str(x) for x in (_rubric_eval.get("red_flags") or [])]
    _wrong_path = bool((_details.get("result") or {}).get("wrong_path_for_persona"))
    if _wrong_path or _red_flags:
        _parts: list[str] = []
        if _wrong_path:
            _parts.append(
                "вы предложили путь, не подходящий этому должнику — сверьте процедуру "
                "(реструктуризация при стабильном доходе / реализация / внесудебное МФЦ) "
                "с его доходом и имуществом"
            )
        if _red_flags:
            _parts.append(
                "избегайте недопустимых формулировок по эталону: "
                + "; ".join(_red_flags[:4])
            )
        recs.append("**Корректность пути по ФЗ-127:** " + ". ".join(_parts) + ".")

    for attr, threshold, max_val, text in LAYER_RULES:
        val = getattr(scores, attr, 0) or 0
        pct = val / max_val if max_val > 0 else 0
        if val < threshold:
            recs.append(text)

    # Anti-patterns (negative score = bad)
    if (scores.anti_patterns or 0) < -3:
        recs.append(
            "**Этические нарушения:** Обнаружены недопустимые приёмы (ложные гарантии «спишем всё», "
            "запугивание, давление). Никогда не обещайте гарантированное списание и не пугайте должника — "
            "опирайтесь только на нормы ФЗ-127 и реальные последствия процедуры."
        )

    # Legal accuracy
    if (scores.legal_accuracy or 0) < -1:
        recs.append(
            "**Правовая точность ФЗ-127:** Были допущены неточности в правовой информации. "
            "Перечитайте ключевые положения 127-ФЗ: основания, сроки, условия добросовестности, "
            "последствия реструктуризации и реализации имущества."
        )

    # Completeness
    completeness = (scores.details or {}).get("_completeness", 1.0)
    if completeness < 0.6:
        user_count = (scores.details or {}).get("_user_message_count", 0)
        recs.insert(0,
            f"**Внимание:** Разговор был очень коротким ({user_count} сообщ.). "
            "Для полноценной оценки проведите сессию с 10+ репликами."
        )

    if not recs:
        recs.append("Отличная работа! Все показатели на высоком уровне. Продолжайте в том же духе.")

    return "\n".join(f"{i+1}. {r}" for i, r in enumerate(recs[:5]))


async def generate_recommendations(
    session_id: str | uuid.UUID,
    db: AsyncSession,
    scores: ScoreBreakdown | None = None,
) -> str:
    """Generate recommendations: rule-based instant + LLM enrichment if available."""
    # Step 1: Instant rule-based recommendations (always works)
    rule_based = ""
    if scores:
        rule_based = _generate_rule_based_recommendations(scores)

    if not rule_based:
        rule_based = "Недостаточно данных для анализа."

    # Step 2: Try LLM enrichment (may fail — that's OK)
    try:
        from app.services.llm import generate_response

        if isinstance(session_id, str):
            session_id = uuid.UUID(session_id)

        msg_result = await db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.sequence_number)
        )
        messages = msg_result.scalars().all()

        user_messages = [m.content for m in messages if m.role == MessageRole.user]
        if len(user_messages) < 4:
            # Too short for LLM — use rule-based only
            return rule_based

        from app.services.scenario_engine import _sanitize_db_prompt
        dialog_summary = "\n".join(
            f"{'Консультант' if m.role == MessageRole.user else 'Должник'}: {_sanitize_db_prompt(m.content or '', 'dialog_msg')}"
            for m in messages[:30]
            if m.role in (MessageRole.user, MessageRole.assistant)
        )

        score_info = ""
        if scores:
            # P3: L7 (ловушки) и L9 (нарратив) скрыты — мёртвые слои.
            score_info = (
                f"\nОценки консультации (рубрика ФЗ-127):\n"
                f"  L1 Полнота выяснения обстоятельств: {scores.script_adherence}/{L1_MAX:g}\n"
                f"  L2 Отработка сомнений и страхов: {scores.objection_handling}/{L2_MAX:g}\n"
                f"  L3 Ясность и эмпатия: {scores.communication}/{L3_MAX:g}\n"
                f"  L4 Этические нарушения: {scores.anti_patterns} (0..{L4_MIN:g})\n"
                f"  L5 Корректность рекомендации: {scores.result}/{L5_MAX:g}\n"
                f"  L6 Глубина разбора: {scores.chain_traversal}/{L6_MAX:g}\n"
                f"  L8 Поддержка должника: {scores.human_factor}/{L8_MAX:g}\n"
                f"  L10 Правовая точность ФЗ-127: {scores.legal_accuracy} ({L10_MIN:g}..+{L10_MAX:g})\n"
                f"  ИТОГО: {scores.total}/100\n"
            )

        system_prompt = (
            "Ты — опытный наставник юриста-консультанта по банкротству физических лиц "
            "(127-ФЗ). Проанализируй диалог консультанта с должником и дай 3-5 конкретных "
            "рекомендаций. Оценивай: полноту выяснения обстоятельств, отработку сомнений и "
            "страхов (особенно «отнимут квартиру») без ложных гарантий, ясность и эмпатию, "
            "корректность рекомендованного пути (реструктуризация/реализация) и правовую "
            "точность по ФЗ-127. "
            "Формат: нумерованный список. Каждая рекомендация — 1-2 предложения. "
            "Фокусируйся на самых слабых местах. Будь конкретен, избегай общих фраз. "
            "Если были правовые ошибки (L10) — укажи верную информацию со ссылкой на 127-ФЗ. "
            "Тон спокойный, без продажного жаргона. Пиши на русском."
        )

        # 2026-06-05 (latency): рекомендации — блокирующий шаг перед /results
        # (пользователь ждёт). Уводим на быструю модель (gemini-3.5-flash, ~2с)
        # вместо медленного reasoning-дефолта. Пустой override → дефолт.
        _fast_model = (settings.local_llm_persona_model or "").strip() or None
        result = await generate_response(
            system_prompt=system_prompt,
            messages=[{
                "role": "user",
                "content": f"Диалог:\n{dialog_summary}\n{score_info}\n\nДай рекомендации консультанту.",
            }],
            emotion_state="cold",
            task_type="coach",
            prefer_provider="local",
            model_override=_fast_model,
        )
        if result and result.content and len(result.content) > 20:
            return result.content  # LLM succeeded — use richer response
    except Exception:
        logger.info("LLM recommendations unavailable — using rule-based fallback")

    return rule_based


# ---------------------------------------------------------------------------
# Per-layer explanations with message references (Task 2.1)
# ---------------------------------------------------------------------------

@dataclass
class LayerExplanation:
    """Human-readable explanation for a single scoring layer."""
    layer: str              # e.g. "L1", "L2"
    label: str              # e.g. "Следование скрипту"
    score: float
    max_score: float
    percentage: float       # 0-100
    summary: str            # e.g. "Completed 4/6 stages"
    highlights: list[dict] = field(default_factory=list)
    # Each highlight: {"message_index": int, "role": "user"|"assistant",
    #                   "excerpt": str, "impact": str, "delta": float}


def generate_layer_explanations(
    breakdown: ScoreBreakdown,
    messages: list[dict],
) -> list[LayerExplanation]:
    """Generate human-readable explanations for the user-facing layers.

    P3: layers are relabelled to the legal-consultation rubric. L7
    (trap_handling) and L9 (narrative) are DEAD after de-gamification and
    are NOT emitted here — they must not appear in any user-facing list.

    Args:
        breakdown: Full ScoreBreakdown from calculate_scores()
        messages: List of {"role": "user"|"assistant", "content": str, "index": int}

    Returns:
        List of LayerExplanation for L1-L6, L8, L10 (L7/L9 hidden).
    """
    details = breakdown.details
    explanations: list[LayerExplanation] = []

    user_msgs = [(m["index"], m["content"]) for m in messages if m["role"] == "user"]
    asst_msgs = [(m["index"], m["content"]) for m in messages if m["role"] == "assistant"]

    # ── L1: Script Adherence ──
    l1 = details.get("script_adherence", {})
    reached = l1.get("reached_count", 0)
    total = l1.get("total_count", 0)
    checkpoints = l1.get("checkpoints", [])
    l1_highlights = []
    missed = [cp for cp in checkpoints if not cp.get("reached")]
    for cp in missed[:3]:
        l1_highlights.append({
            "message_index": -1,
            "role": "system",
            "excerpt": cp.get("name", ""),
            "impact": f"Пропущен этап: {cp.get('name', 'N/A')}",
            "delta": 0,
        })
    explanations.append(LayerExplanation(
        layer="L1", label="Полнота выяснения обстоятельств",
        score=breakdown.script_adherence, max_score=L1_MAX,
        percentage=round(_normalize(breakdown.script_adherence, L1_MAX) * 100, 1),
        summary=(
            f"Выяснено {reached}/{total} ключевых обстоятельств "
            "(долги, доход, иждивенцы, жильё/ипотека, сделки, стадия взыскания)."
            if total > 0 else "Чек-лист обстоятельств не задан сценарием."
        ),
        highlights=l1_highlights,
    ))

    # ── L2: Objection Handling ──
    l2 = details.get("objection_handling", {})
    obj_count = l2.get("objections_found", 0)
    steps = ["heard", "acknowledged", "clarified", "argued", "checked"]
    step_labels = {
        "heard": "Услышано", "acknowledged": "Признано",
        "clarified": "Уточнено", "argued": "Аргументировано", "checked": "Проверено",
    }
    done_steps = [s for s in steps if l2.get(s)]
    missed_steps = [s for s in steps if not l2.get(s)]
    l2_summary = f"Сомнений/страхов отмечено: {obj_count}. "
    if missed_steps:
        l2_summary += f"Пропущены шаги: {', '.join(step_labels[s] for s in missed_steps)}."
    else:
        l2_summary += "Все шаги отработки пройдены."

    l2_highlights = []
    # Find messages where the debtor voiced a doubt / fear
    for idx, msg in asst_msgs:
        if _has_pattern(msg, OBJECTION_PATTERNS):
            l2_highlights.append({
                "message_index": idx, "role": "assistant",
                "excerpt": msg[:80] + ("..." if len(msg) > 80 else ""),
                "impact": "Сомнение/страх должника", "delta": 0,
            })
            if len(l2_highlights) >= 3:
                break
    explanations.append(LayerExplanation(
        layer="L2", label="Отработка сомнений и страхов",
        score=breakdown.objection_handling, max_score=L2_MAX,
        percentage=round(_normalize(breakdown.objection_handling, L2_MAX) * 100, 1),
        summary=l2_summary, highlights=l2_highlights,
    ))

    # ── L3: Communication ──
    l3 = details.get("communication", {})
    empathy_found = l3.get("empathy_detected", False)
    avg_len = l3.get("avg_message_length", 0)
    l3_notes = []
    if not empathy_found:
        l3_notes.append("Эмпатия не обнаружена")
    if avg_len > 500:
        l3_notes.append(f"Слишком длинные ответы (ср. {int(avg_len)} символов)")
    polite = l3.get("polite_markers", 0)
    if polite == 0:
        l3_notes.append("Нет вежливых маркеров (здравствуйте, спасибо)")
    l3_summary = "; ".join(l3_notes) if l3_notes else "Ясное и эмпатичное объяснение."
    explanations.append(LayerExplanation(
        layer="L3", label="Ясность и эмпатия",
        score=breakdown.communication, max_score=L3_MAX,
        percentage=round(_normalize(breakdown.communication, L3_MAX) * 100, 1),
        summary=l3_summary, highlights=[],
    ))

    # ── L4: Anti-patterns ──
    l4 = details.get("anti_patterns", {})
    detected_patterns = l4.get("detected", [])
    l4_highlights = []
    for ap in detected_patterns[:3]:
        l4_highlights.append({
            "message_index": -1, "role": "user",
            "excerpt": ap.get("category", ""),
            "impact": f"Этическое нарушение: {ap.get('category', 'N/A')} ({ap.get('penalty', 0):+.1f})",
            "delta": ap.get("penalty", 0),
        })
    l4_summary = (
        f"Этических нарушений отмечено: {len(detected_patterns)}."
        if detected_patterns else "Этических нарушений не обнаружено."
    )
    explanations.append(LayerExplanation(
        layer="L4", label="Этические нарушения",
        score=breakdown.anti_patterns, max_score=0,
        percentage=round(max(0, _normalize(breakdown.anti_patterns - L4_MIN, -L4_MIN)) * 100, 1),
        summary=l4_summary, highlights=l4_highlights,
    ))

    # ── L5: Корректность рекомендации ──
    l5 = details.get("result", {})
    path = l5.get("path_recommended", False)
    grounded = l5.get("path_grounded_in_situation", False)
    good_faith = l5.get("good_faith_caveat", False)
    next_step = l5.get("next_step_given", False)
    l5_parts = []
    if path:
        l5_parts.append(
            "назван путь (реструктуризация/реализация)"
            + (", с опорой на ситуацию должника" if grounded else "")
        )
    else:
        l5_parts.append("корректный путь по ФЗ-127 не предложен")
    if good_faith:
        l5_parts.append("дано предупреждение о добросовестности")
    if next_step:
        l5_parts.append("обозначен конкретный следующий шаг")
    else:
        l5_parts.append("следующий шаг не обозначен")
    l5_summary = "Рекомендация: " + "; ".join(l5_parts) + "."
    explanations.append(LayerExplanation(
        layer="L5", label="Корректность рекомендации",
        score=breakdown.result, max_score=L5_MAX,
        percentage=round(_normalize(breakdown.result, L5_MAX) * 100, 1),
        summary=l5_summary, highlights=[],
    ))

    # ── L6: Chain Traversal → отработка цепочек сомнений ──
    l6 = details.get("chain_traversal", {})
    has_chain = l6.get("has_chain", False)
    l6_summary = (
        "Цепочки сомнений отработаны разными аргументами."
        if has_chain else "Цепочек сомнений не возникло либо они не отработаны."
    )
    explanations.append(LayerExplanation(
        layer="L6", label="Глубина разбора",
        score=breakdown.chain_traversal, max_score=L6_MAX,
        percentage=round(_normalize(breakdown.chain_traversal, L6_MAX) * 100, 1),
        summary=l6_summary, highlights=[],
    ))

    # ── L7: Trap Handling — HIDDEN (P3) ──
    # L7 is a dead sales-trap layer after de-gamification. It is intentionally
    # NOT emitted as a user-facing explanation and its radar weight was
    # redistributed (knowledge/objection_handling/legal_knowledge). The
    # stored `breakdown.trap_handling` field is kept (migration cascade) but
    # never surfaced here.

    # ── L8: Human Factor ──
    l8 = details.get("human_factor", {})
    patience = l8.get("patience_score", 0)
    empathy_check = l8.get("empathy_check_score", 0)
    composure = l8.get("composure_score", 0)
    aggressive_cnt = l8.get("aggressive_responses", 0)
    panic_cnt = l8.get("panic_count", 0)
    l8_notes = []
    if aggressive_cnt > 0:
        l8_notes.append(f"{aggressive_cnt} агрессивных ответов")
    if panic_cnt > 0:
        l8_notes.append(f"{panic_cnt} паник-фраз")
    if l8.get("fake_detected"):
        l8_notes.append("обнаружена фейковая смена настроения (+бонус)")
    # S3-07: sub-scores are now [0,1] — display as ×5 for human-readable /5 scale
    l8_summary = (
        f"Терпение: {patience * 5:.0f}/5, Эмпатия: {empathy_check * 5:.0f}/5, Самообладание: {composure * 5:.0f}/5."
    )
    if l8_notes:
        l8_summary += " " + "; ".join(l8_notes) + "."

    l8_highlights = []
    # Find aggressive response messages
    aggressive_patterns_check = [
        r"(?:сам[иа]?\s+вы|да\s+вы\s+(?:что|как))",
        r"(?:не\s+кричите|хватит\s+(?:орать|кричать))",
    ]
    for idx, msg in user_msgs:
        if _has_pattern(msg, aggressive_patterns_check):
            l8_highlights.append({
                "message_index": idx, "role": "user",
                "excerpt": msg[:80] + ("..." if len(msg) > 80 else ""),
                "impact": "Резкий ответ консультанта (-2 самообладание)",
                "delta": -2.0,
            })
    explanations.append(LayerExplanation(
        layer="L8", label="Поддержка должника",
        score=breakdown.human_factor, max_score=L8_MAX,
        percentage=round(_normalize(breakdown.human_factor, L8_MAX) * 100, 1),
        summary=l8_summary, highlights=l8_highlights[:3],
    ))

    # ── L9: Narrative Progression — HIDDEN (P3) ──
    # L9 is a dead story/emotion-arc sales layer after de-gamification. It is
    # intentionally NOT emitted as a user-facing explanation; its radar weight
    # folded into the «Рекомендация» (closing) axis. The stored
    # `breakdown.narrative_progression` field is kept (migration cascade) but
    # never surfaced here.

    # ── L10: Legal Accuracy ──
    l10 = details.get("legal_accuracy", {})
    method = l10.get("scoring_method", "unknown")
    regex_details = l10.get("regex", {})
    correct = regex_details.get("correct", 0)
    incorrect = regex_details.get("incorrect", 0)
    checks = regex_details.get("checks_triggered", 0)
    l10_highlights = []
    for check in regex_details.get("details", [])[:3]:
        if isinstance(check, dict) and check.get("result") == "incorrect":
            l10_highlights.append({
                "message_index": -1, "role": "user",
                "excerpt": check.get("claim", "")[:80],
                "impact": f"Юридическая ошибка: {check.get('correction', 'N/A')[:80]}",
                "delta": -2.0,
            })
    l10_summary = f"{correct} верных, {incorrect} ошибок из {checks} проверок ({method})."
    explanations.append(LayerExplanation(
        layer="L10", label="Правовая точность ФЗ-127",
        score=breakdown.legal_accuracy, max_score=L10_MAX,
        percentage=round(_normalize(breakdown.legal_accuracy - L10_MIN, L10_MAX - L10_MIN) * 100, 1),
        summary=l10_summary, highlights=l10_highlights,
    ))

    return explanations


def layer_explanations_to_dict(explanations: list[LayerExplanation]) -> list[dict]:
    """Convert LayerExplanations to JSON-serializable dicts for API response."""
    return [
        {
            "layer": e.layer,
            "label": e.label,
            "score": e.score,
            "max_score": e.max_score,
            "percentage": e.percentage,
            "summary": e.summary,
            "highlights": e.highlights,
        }
        for e in explanations
    ]
