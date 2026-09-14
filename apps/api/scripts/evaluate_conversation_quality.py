"""Read-only live calibration against the configured provider and legal corpus.

Run from apps/api: python -m scripts.evaluate_conversation_quality [--case NAME]
Uses synthetic/reference transcripts, never creates sessions or changes grades.
This is an explicit paid provider evaluation, not part of offline CI.
"""

import argparse
import asyncio
import json
import time
from pathlib import Path

from app.database import async_session
from app.services.conversation_quality import assess_conversation


async def main(name=None):
    fixtures = Path(__file__).parents[1] / "tests/fixtures/conversation_quality_calibration.json"
    failures = 0
    for case in json.loads(fixtures.read_text()):
        if name and case["name"] != name:
            continue
        started = time.monotonic()
        async with async_session() as db:
            try:
                result = await assess_conversation(case["history"], db=db)
                report = result["scoring_details"]["_quality_assessment"]
                violations = {d["category"] for d in report["deductions"]}
                passed = (
                    case["minimum"] <= result["total"] <= case["maximum"]
                    and not violations.intersection(case["forbidden_violations"])
                    and set(case["required_violations"]).issubset(violations)
                )
                output = {
                    "case": case["name"],
                    "passed": passed,
                    "total": result["total"],
                    "violations": sorted(violations),
                }
            except Exception as exc:
                passed = False
                output = {"case": case["name"], "passed": False, "error": type(exc).__name__}
            output["seconds"] = round(time.monotonic() - started, 1)
            print(json.dumps(output, ensure_ascii=False), flush=True)
            failures += not passed
    return int(failures > 0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--case")
    raise SystemExit(asyncio.run(main(parser.parse_args().case)))
