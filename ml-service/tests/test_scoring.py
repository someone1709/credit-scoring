from app import scoring


def test_the_briefs_example_probability_gives_its_risk_score():
    assert scoring.risk_score_from_probability(0.08) == 28


def test_risk_score_stays_in_range():
    assert scoring.risk_score_from_probability(0.0) == 0
    assert scoring.risk_score_from_probability(1.0) == 100


def test_category_bands():
    assert [scoring.risk_category(score) for score in (0, 30, 31, 60, 61, 100)] == ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"]


def test_income_brackets():
    assert [scoring.income_bracket(value) for value in (0, 24999, 25000, 49999, 50000)] == ["UNKNOWN", "LOW_INCOME", "MID_INCOME", "MID_INCOME", "HIGH_INCOME"]


def test_composite_is_not_just_the_inverse_of_risk():
    assert scoring.composite_score(30, 24000, 9000, 0) == 79
    assert scoring.composite_score(30, 24000, 20000, 3000) != scoring.composite_score(30, 24000, 9000, 0)


def test_segments():
    assert scoring.segment(80, "HIGH_INCOME") == "PRIME"
    assert scoring.segment(72, "LOW_INCOME") == "LOW_INCOME_PRIME"
    assert scoring.segment(72, "MID_INCOME") == "STANDARD_PLUS"
    assert scoring.segment(50, "LOW_INCOME") == "STANDARD"
    assert scoring.segment(35, "HIGH_INCOME") == "SUBPRIME"
    assert scoring.segment(10, "MID_INCOME") == "HIGH_RISK"
