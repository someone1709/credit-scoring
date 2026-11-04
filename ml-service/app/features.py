"""
Features the model sees. Training and the live service both use this file, so they can't drift apart.

Two deliberate choices:
- Only ratios go in, never raw income, so a low income isn't penalised for being low.
- `none` is the baseline for repayment history: it has no feature of its own, so the model has nothing
  to learn a penalty on. Electricity usage isn't a feature (Master Brief §14).
"""

import numpy as np
import pandas as pd

FINANCIAL_FEATURES = ["dti", "expense_ratio", "low_surplus", "loan_to_annual_income"]
REPAYMENT_FEATURES = ["repayment_good", "repayment_average", "repayment_poor"]
FEATURES = FINANCIAL_FEATURES + REPAYMENT_FEATURES

# Below this share of income left over, a borrower has little room for another instalment.
LOW_SURPLUS_SHARE = 0.10


def build_features(frame: pd.DataFrame) -> pd.DataFrame:
    income = frame["monthly_income"].astype(float)
    expenses = frame["monthly_expenses"].astype(float)
    emi = frame["existing_emi"].astype(float)
    surplus_share = (income - expenses - emi) / income

    return pd.DataFrame(
        {
            # Capped so one extreme entry can't dominate a score.
            "dti": (emi / income).clip(upper=2.0),
            "expense_ratio": (expenses / income).clip(upper=2.0),
            "low_surplus": (surplus_share < LOW_SURPLUS_SHARE).astype(float),
            "loan_to_annual_income": (frame["loan_amount"].astype(float) / (income * 12)).clip(upper=5.0),
            "repayment_good": (frame["repayment_history"] == "good").astype(float),
            "repayment_average": (frame["repayment_history"] == "average").astype(float),
            "repayment_poor": (frame["repayment_history"] == "poor").astype(float),
        },
        columns=FEATURES,
    ).astype(np.float64)
