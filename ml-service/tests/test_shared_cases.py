"""The answers in shared/scoring_cases.json, which the website and the backend must also give."""

import json
from pathlib import Path

import pytest

from app.scoring import composite_score, income_bracket, risk_category, segment

CASES = json.loads((Path(__file__).resolve().parents[2] / "shared" / "scoring_cases.json").read_text())


@pytest.mark.parametrize("case", CASES["risk_categories"])
def test_risk_categories(case):
    assert risk_category(case["risk_score"]) == case["expected"]


@pytest.mark.parametrize("case", CASES["income_brackets"])
def test_income_brackets(case):
    assert income_bracket(case["monthly_income"]) == case["expected"]


@pytest.mark.parametrize("case", CASES["segments"])
def test_segments(case):
    assert segment(case["composite_score"], case["income_bracket"]) == case["expected"]


@pytest.mark.parametrize("case", CASES["composite_scores"], ids=lambda case: case["name"])
def test_composite_scores(case):
    result = composite_score(case["risk_score"], case["monthly_income"], case["monthly_expenses"], case["existing_emi"])
    assert result == case["expected"]
