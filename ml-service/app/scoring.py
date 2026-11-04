"""
Turns a probability into the platform's scores. These bands match the backend's and the frontend's,
and they're placeholders for the team to confirm.

Risk and composite are separate measures: higher risk is worse, higher composite is better.
"""

import math

from app.schemas import IncomeBracket, RiskCategory, Segment


def risk_score_from_probability(probability: float) -> int:
    """100 x sqrt(p). It spreads out the low probabilities, and gives 28 for the brief's example of 0.08."""
    return _clamp(_round_half_up(100 * math.sqrt(max(0.0, min(1.0, probability)))))


def risk_category(risk_score: int) -> RiskCategory:
    if risk_score <= 30:
        return "LOW"
    if risk_score <= 60:
        return "MEDIUM"
    return "HIGH"


def income_bracket(monthly_income: float) -> IncomeBracket:
    if monthly_income <= 0:
        return "UNKNOWN"
    if monthly_income >= 50000:
        return "HIGH_INCOME"
    if monthly_income >= 25000:
        return "MID_INCOME"
    return "LOW_INCOME"


def composite_score(risk: int, monthly_income: float, monthly_expenses: float, existing_emi: float) -> int:
    """70% inverse risk, 30% affordability, where keeping 50% of income scores full marks."""
    surplus_share = (monthly_income - monthly_expenses - existing_emi) / monthly_income if monthly_income > 0 else 0.0
    affordability = max(0.0, min(100.0, surplus_share * 200))
    return _clamp(_round_half_up(0.7 * (100 - risk) + 0.3 * affordability))


def segment(composite: int, bracket: IncomeBracket) -> Segment:
    if composite >= 75 and bracket == "HIGH_INCOME":
        return "PRIME"
    if composite >= 70 and bracket == "LOW_INCOME":
        return "LOW_INCOME_PRIME"
    if composite >= 70:
        return "STANDARD_PLUS"
    if composite >= 45:
        return "STANDARD"
    if composite >= 30:
        return "SUBPRIME"
    return "HIGH_RISK"


def _round_half_up(value: float) -> int:
    """Python's round() sends halves to the nearest even number. The backend and the website round them up."""
    return math.floor(value + 0.5)


def _clamp(score: int) -> int:
    return max(0, min(100, score))
