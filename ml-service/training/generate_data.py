"""
Fictional borrowers for the academic prototype. NOT real lending data.

Defaults come from the rules below plus random noise for everything a form can't capture. So any model
trained on this learns these rules back: its scores on this data show the pipeline works, and say
nothing about how real borrowers behave.
"""

import numpy as np
import pandas as pd

# The "true" effect of each input on the log-odds of default. These are assumptions, not findings.
# `none` is exactly 0, because having no repayment history must not raise risk (Master Brief §5.3).
HISTORY_EFFECT = {"good": -0.70, "none": 0.0, "average": 0.45, "poor": 1.30}
HISTORY_SHARE = {"good": 0.45, "none": 0.25, "average": 0.22, "poor": 0.08}
INTERCEPT = -3.90
DTI_EFFECT = 3.0
EXPENSE_EFFECT = 1.6
LOW_SURPLUS_EFFECT = 1.0
LOAN_EFFECT = 0.55
UNOBSERVED_NOISE_SD = 0.8

DEFAULT_ROWS = 20_000
DEFAULT_SEED = 42


def generate(rows: int = DEFAULT_ROWS, seed: int = DEFAULT_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    income = np.clip(rng.lognormal(mean=np.log(28_000), sigma=0.60, size=rows), 6_000, 300_000).round(-2)

    # Lower incomes tend to spend a larger share of what they earn.
    income_scale = np.clip(np.log(income / 28_000), -1.0, 1.5)
    expense_share = np.clip(rng.beta(6, 7, size=rows) - 0.07 * income_scale, 0.10, 1.10)
    expenses = (income * expense_share).round(-1)

    history = rng.choice(list(HISTORY_SHARE), size=rows, p=list(HISTORY_SHARE.values()))

    # First-time borrowers mostly have no loan to repay. Others often do.
    has_emi = np.where(history == "none", rng.random(rows) < 0.08, rng.random(rows) < 0.65)
    emi_share = np.where(has_emi, rng.beta(2, 8, size=rows), 0.0)
    emi = (income * emi_share).round(-1)

    # Requests scale with what someone earns: typically about three months' income.
    loan = np.clip(income * rng.lognormal(mean=np.log(3.0), sigma=0.65, size=rows), 1_000, 5_000_000).round(-2)

    dti = emi / income
    expense_ratio = expenses / income
    surplus_share = (income - expenses - emi) / income
    loan_to_annual = loan / (income * 12)

    log_odds = (
        INTERCEPT
        + DTI_EFFECT * dti
        + EXPENSE_EFFECT * expense_ratio
        + LOW_SURPLUS_EFFECT * (surplus_share < 0.10)
        + LOAN_EFFECT * np.minimum(loan_to_annual, 3.0)
        + np.vectorize(HISTORY_EFFECT.get)(history)
        + rng.normal(0, UNOBSERVED_NOISE_SD, size=rows)
    )
    defaulted = rng.random(rows) < 1 / (1 + np.exp(-log_odds))

    return pd.DataFrame(
        {
            "monthly_income": income,
            "monthly_expenses": expenses,
            "existing_emi": emi,
            "loan_amount": loan,
            "repayment_history": history,
            "defaulted": defaulted.astype(int),
        }
    )
