"""Loads the trained model and turns one request into the contract's response."""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app import scoring
from app.features import FEATURES, FINANCIAL_FEATURES, build_features
from app.schemas import AssessmentRequest, AssessmentResponse

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "credit_risk.joblib"

# Below this, a factor barely moved the score, so calling it a reason would overstate it.
NEGLIGIBLE_LOG_ODDS = 0.03

NO_HISTORY_NOTE = "No repayment history is on record. This is not treated as poor history."
ELECTRICITY_NOTE = "Electricity usage was provided but does not affect this score, because it is not assumed to be a reliable credit signal."
METHOD_NOTE = "Factors are compared with the average applicant in the synthetic training data. This model has not been validated on real borrowers."


def _effect(value: float) -> str:
    if abs(value) < NEGLIGIBLE_LOG_ODDS:
        return "had little effect on the estimated risk"
    return "raised the estimated risk" if value > 0 else "lowered the estimated risk"


def _describe_financial(name: str, request: AssessmentRequest, value: float) -> str:
    income = request.monthly_income
    surplus = income - request.monthly_expenses - request.existing_emi
    if name == "dti":
        return f"Debt-to-income ratio of {request.existing_emi / income:.1%} {_effect(value)}."
    if name == "expense_ratio":
        return f"Expense-to-income ratio of {request.monthly_expenses / income:.1%} {_effect(value)}."
    if name == "low_surplus":
        return f"Monthly surplus of {surplus / income:.1%} of income {_effect(value)}."
    return f"Requested amount of {request.loan_amount / (income * 12):.1%} of annual income {_effect(value)}."


class Assessor:
    def __init__(self, bundle: dict):
        if bundle["features"] != FEATURES:
            raise ValueError("This model was trained with different features. Run `python -m training.train`.")
        self.model = bundle["model"]
        self.model_name = bundle["model_name"]
        self.explainer = bundle["explainer"]
        self.card = bundle["card"]

    @classmethod
    def load(cls, path: Path = MODEL_PATH) -> "Assessor":
        return cls(joblib.load(path))

    def contributions(self, features: pd.DataFrame) -> dict[str, float]:
        """SHAP values for one applicant, in log-odds, by feature."""
        return dict(zip(FEATURES, np.ravel(self.explainer.shap_values(features)).tolist()))

    def assess(self, request: AssessmentRequest) -> AssessmentResponse:
        frame = pd.DataFrame([request.model_dump()])
        features = build_features(frame)
        probability = float(self.model.predict_proba(features)[0, 1])

        risk = scoring.risk_score_from_probability(probability)
        bracket = scoring.income_bracket(request.monthly_income)
        composite = scoring.composite_score(risk, request.monthly_income, request.monthly_expenses, request.existing_emi)

        return AssessmentResponse(
            beneficiary_id=request.beneficiary_id,
            risk_score=risk,
            risk_category=scoring.risk_category(risk),
            probability_of_default=round(probability, 4),
            # No confidence measure has been implemented and evaluated (Master Brief §6.5).
            model_confidence=None,
            income_bracket=bracket,
            composite_score=composite,
            segment=scoring.segment(composite, bracket),
            is_thin_file=request.repayment_history == "none",
            explanations=self._explanations(request, self.contributions(features)),
            explanation_method="SHAP",
            # The request carries no document data, so the backend replaces this with the real status.
            verification_status="DEMO_UNVERIFIED",
        )

    def _explanations(self, request: AssessmentRequest, shap_values: dict[str, float]) -> list[str]:
        lines = [(name, shap_values[name]) for name in FINANCIAL_FEATURES]
        lines.sort(key=lambda item: abs(item[1]), reverse=True)
        explanations = [_describe_financial(name, request, value) for name, value in lines]

        if request.repayment_history == "none":
            # Stated plainly, with no direction. `none` is the model's neutral baseline, and SHAP's comparison
            # with the average applicant would wrongly read as a penalty.
            explanations.append(NO_HISTORY_NOTE)
        else:
            history_value = sum(shap_values[name] for name in FEATURES if name.startswith("repayment_"))
            explanations.append(f"Repayment history reported as {request.repayment_history} {_effect(history_value)}.")

        if request.electricity_usage is not None:
            explanations.append(ELECTRICITY_NOTE)
        explanations.append(METHOD_NOTE)
        return explanations
