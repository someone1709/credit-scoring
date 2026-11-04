"""The brief's non-negotiable rules, checked on the model that was actually trained."""

import itertools

import numpy as np
import pandas as pd
import pytest

from app.assessor import MODEL_PATH, METHOD_NOTE, NO_HISTORY_NOTE, Assessor
from app.features import FEATURES, build_features
from app.schemas import AssessmentRequest

pytestmark = pytest.mark.skipif(not MODEL_PATH.exists(), reason="Run `python -m training.train` first")


@pytest.fixture(scope="module")
def assessor():
    return Assessor.load()


def request(**overrides) -> AssessmentRequest:
    values = {
        "beneficiary_id": "T1",
        "monthly_income": 24000,
        "monthly_expenses": 9000,
        "existing_emi": 0,
        "loan_amount": 40000,
        "repayment_history": "none",
        "electricity_usage": None,
    }
    return AssessmentRequest(**(values | overrides))


PROFILES = list(itertools.product((8000, 24000, 90000), (0.2, 0.5, 0.9), (0.0, 0.2, 0.5), (0.2, 1.0, 4.0)))


def probability(assessor, history, income, expense_share, emi_share, loan_multiple):
    response = assessor.assess(
        request(
            monthly_income=income,
            monthly_expenses=income * expense_share,
            existing_emi=income * emi_share,
            loan_amount=income * loan_multiple,
            repayment_history=history,
        )
    )
    return response.probability_of_default


def test_no_history_is_never_scored_as_poor_or_average_history(assessor):
    for profile in PROFILES:
        none = probability(assessor, "none", *profile)
        assert none < probability(assessor, "average", *profile), profile
        assert none < probability(assessor, "poor", *profile), profile
        assert probability(assessor, "good", *profile) < none, profile


def test_no_history_has_no_feature_of_its_own():
    assert not [name for name in FEATURES if "none" in name]
    row = pd.DataFrame([request().model_dump()])
    assert build_features(row)[["repayment_good", "repayment_average", "repayment_poor"]].sum(axis=1).iloc[0] == 0


def test_risk_rises_as_finances_worsen(assessor):
    base = (24000, 0.4, 0.0, 1.0)
    assert probability(assessor, "good", 24000, 0.4, 0.3, 1.0) > probability(assessor, "good", *base)
    assert probability(assessor, "good", 24000, 0.8, 0.0, 1.0) > probability(assessor, "good", *base)
    assert probability(assessor, "good", 24000, 0.4, 0.0, 4.0) > probability(assessor, "good", *base)


def test_income_alone_does_not_change_the_score(assessor):
    assert probability(assessor, "good", 8000, 0.4, 0.1, 2.0) == probability(assessor, "good", 200000, 0.4, 0.1, 2.0)


def test_electricity_changes_nothing_but_a_note(assessor):
    without = assessor.assess(request())
    with_low = assessor.assess(request(electricity_usage=5))
    with_high = assessor.assess(request(electricity_usage=900))
    for response in (with_low, with_high):
        assert response.probability_of_default == without.probability_of_default
        assert response.risk_score == without.risk_score
        assert response.composite_score == without.composite_score
        assert any("Electricity usage" in line for line in response.explanations)
    assert not any("Electricity usage" in line for line in without.explanations)


def test_results_are_repeatable(assessor):
    assert assessor.assess(request()) == assessor.assess(request())


def test_output_is_honest(assessor):
    response = assessor.assess(request())
    assert response.model_confidence is None
    assert response.explanation_method == "SHAP"
    assert 0 <= response.probability_of_default <= 1
    assert response.is_thin_file is True
    assert METHOD_NOTE in response.explanations


def test_the_no_history_explanation_states_no_penalty(assessor):
    response = assessor.assess(request(repayment_history="none"))
    assert NO_HISTORY_NOTE in response.explanations
    assert not any("history" in line.lower() and "raised" in line for line in response.explanations)


def test_explanations_are_real_shap_values_that_add_up_to_the_prediction(assessor):
    features = build_features(pd.DataFrame([request(existing_emi=4000, repayment_history="poor").model_dump()]))
    values = assessor.contributions(features)
    expected_value = float(np.ravel(assessor.explainer.expected_value)[0])
    probability_value = assessor.model.predict_proba(features)[0, 1]
    log_odds = np.log(probability_value / (1 - probability_value))
    assert sum(values.values()) + expected_value == pytest.approx(log_odds, abs=1e-6)


def test_explanations_point_the_right_way(assessor):
    strained = assessor.assess(request(existing_emi=12000, monthly_expenses=15000, repayment_history="poor"))
    text = " ".join(strained.explanations)
    assert "Debt-to-income ratio of 50.0% raised" in text
    assert "Repayment history reported as poor raised" in text
    healthy = assessor.assess(request(monthly_expenses=4000, repayment_history="good"))
    assert "Repayment history reported as good lowered" in " ".join(healthy.explanations)


def test_extreme_input_stays_valid(assessor):
    response = assessor.assess(request(monthly_income=1, monthly_expenses=1_000_000, existing_emi=1_000_000, loan_amount=1_000_000_000))
    assert 0 <= response.risk_score <= 100
    assert response.risk_category in ("LOW", "MEDIUM", "HIGH")
