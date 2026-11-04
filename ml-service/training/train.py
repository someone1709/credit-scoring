"""
Trains and evaluates the credit risk model, then saves it with a report.

    python -m training.train

Two candidates compete on a validation split. The simpler one wins unless the other is clearly better.
The held-out test split is only used once, for the final numbers.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
import sklearn
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import train_test_split

from app.features import FEATURES, build_features
from app.scoring import income_bracket
from training.generate_data import DEFAULT_ROWS, DEFAULT_SEED, HISTORY_EFFECT, generate

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "models" / "credit_risk.joblib"
REPORT_DIR = ROOT / "reports"

# Gradient boosting must beat logistic regression by this much log-loss to justify being harder to explain.
SIMPLICITY_MARGIN = 0.001
BACKGROUND_ROWS = 500

# Risk may only rise with debt and strain, and repayment history pushes each way relative to `none`.
GB_MONOTONIC = {
    "dti": 1,
    "expense_ratio": 1,
    "low_surplus": 1,
    "loan_to_annual_income": 1,
    "repayment_good": -1,
    "repayment_average": 1,
    "repayment_poor": 1,
}


@dataclass
class Candidate:
    name: str
    model: object


def candidates() -> list[Candidate]:
    return [
        Candidate("logistic_regression", LogisticRegression(C=1.0, max_iter=2000)),
        Candidate(
            "gradient_boosting",
            HistGradientBoostingClassifier(
                max_depth=3,
                learning_rate=0.05,
                max_iter=250,
                monotonic_cst=[GB_MONOTONIC[name] for name in FEATURES],
                random_state=DEFAULT_SEED,
            ),
        ),
    ]


def metrics(y_true, probabilities) -> dict:
    return {
        "auc": float(roc_auc_score(y_true, probabilities)),
        "log_loss": float(log_loss(y_true, probabilities)),
        "brier": float(brier_score_loss(y_true, probabilities)),
        "accuracy_at_0_5": float(accuracy_score(y_true, probabilities >= 0.5)),
        "base_rate": float(np.mean(y_true)),
    }


def calibration_table(y_true, probabilities, bins: int = 10) -> tuple[list[dict], float]:
    """Compares predicted and actual default rates in equal-sized groups. ECE is their weighted gap."""
    order = np.argsort(probabilities)
    rows, ece = [], 0.0
    for chunk in np.array_split(order, bins):
        predicted, observed = float(probabilities[chunk].mean()), float(np.asarray(y_true)[chunk].mean())
        ece += abs(predicted - observed) * len(chunk) / len(order)
        rows.append({"rows": int(len(chunk)), "mean_predicted": predicted, "observed": observed})
    return rows, float(ece)


def group_table(frame: pd.DataFrame, probabilities, group_names: pd.Series) -> list[dict]:
    """How the model treats each group. Similar predicted and observed rates mean no systematic over-scoring."""
    rows = []
    y_true = frame["defaulted"].to_numpy()
    for group in sorted(group_names.unique()):
        mask = (group_names == group).to_numpy()
        rows.append(
            {
                "group": str(group),
                "rows": int(mask.sum()),
                "observed_default": float(y_true[mask].mean()),
                "mean_predicted": float(probabilities[mask].mean()),
                "auc": float(roc_auc_score(y_true[mask], probabilities[mask])) if 0 < y_true[mask].sum() < mask.sum() else None,
            }
        )
    return rows


def check_guardrails(model, name: str) -> dict:
    """Refuses to save a model that breaks the brief's rule about repayment history."""
    if name == "logistic_regression":
        coefficients = dict(zip(FEATURES, model.coef_[0]))
        if not (coefficients["repayment_good"] < 0 < coefficients["repayment_average"] < coefficients["repayment_poor"]):
            raise SystemExit(f"Guardrail failed: repayment coefficients are out of order: {coefficients}")
        return {key: float(value) for key, value in coefficients.items()} | {"intercept": float(model.intercept_[0])}
    return {}


def build_explainer(model, name: str, background: pd.DataFrame):
    if name == "logistic_regression":
        return shap.LinearExplainer(model, shap.maskers.Independent(background, max_samples=BACKGROUND_ROWS))
    return shap.TreeExplainer(model, data=background, model_output="raw")


def write_report(card: dict) -> None:
    REPORT_DIR.mkdir(exist_ok=True)
    (REPORT_DIR / "model_card.json").write_text(json.dumps(card, indent=2) + "\n")

    test = card["test_metrics"]
    lines = [
        "# Credit risk model report",
        "",
        "> **Trained and tested on synthetic data only.** Defaults in this data come from rules written for the project, so these numbers show that the",
        "> pipeline recovers those rules. They say nothing about how real borrowers behave, and they don't show that the model is fair.",
        "",
        f"Generated by `python -m training.train` with seed {card['seed']}, using scikit-learn {card['sklearn_version']} and SHAP {card['shap_version']}.",
        "",
        "## Model",
        "",
        f"- **Chosen:** {card['model_name']}",
        f"- **Why:** {card['selection_reason']}",
        f"- **Data:** {card['rows']['total']:,} fictional borrowers, split {card['rows']['train']:,} train, {card['rows']['validation']:,} validation, {card['rows']['test']:,} test",
        f"- **Features:** {', '.join(FEATURES)}",
        "- **Left out on purpose:** raw income, so low income isn't penalised for being low, and electricity usage, which needs a separate fairness evaluation (brief §14).",
        "- **`model_confidence`:** always null, because no confidence measure has been implemented and evaluated (brief §6.5).",
        "",
        "## Candidates on the validation split",
        "",
        "| Model | AUC | Log loss | Brier |",
        "|---|---:|---:|---:|",
    ]
    for name, values in card["validation_metrics"].items():
        lines.append(f"| {name} | {values['auc']:.3f} | {values['log_loss']:.4f} | {values['brier']:.4f} |")
    lines += [
        "",
        "## Final results on the held-out test split",
        "",
        "| Metric | Value |",
        "|---|---:|",
        f"| AUC | {test['auc']:.3f} |",
        f"| Log loss | {test['log_loss']:.4f} |",
        f"| Brier score | {test['brier']:.4f} |",
        f"| Accuracy at 0.5 | {test['accuracy_at_0_5']:.3f} |",
        f"| Default rate in this split | {test['base_rate']:.3f} |",
        f"| Expected calibration error | {card['calibration_ece']:.4f} |",
        "",
        "Accuracy alone is misleading here, because most fictional borrowers don't default. Always predicting no default would score "
        f"{1 - test['base_rate']:.3f}.",
        "",
        "## Calibration on the test split",
        "",
        "Each row is an equal-sized group, from lowest to highest predicted risk.",
        "",
        "| Group | Mean predicted | Actual default rate |",
        "|---:|---:|---:|",
    ]
    for index, row in enumerate(card["calibration"], start=1):
        lines.append(f"| {index} | {row['mean_predicted']:.3f} | {row['observed']:.3f} |")

    for title, key, note in (
        ("By repayment history", "by_history", "`none` should sit between `good` and `average`, which is how the synthetic data was written, so the model isn't treating no history as poor history."),
        ("By income bracket", "by_income", "A close match between predicted and actual rates means the model isn't systematically over-scoring a group in this data. It doesn't prove fairness on real people."),
    ):
        lines += ["", f"## {title}", "", note, "", "| Group | Rows | Actual default rate | Mean predicted | AUC |", "|---|---:|---:|---:|---:|"]
        for row in card[key]:
            auc = "n/a" if row["auc"] is None else f"{row['auc']:.3f}"
            lines.append(f"| {row['group']} | {row['rows']:,} | {row['observed_default']:.3f} | {row['mean_predicted']:.3f} | {auc} |")

    if card["coefficients"]:
        lines += ["", "## Model weights", "", "Log-odds per unit of each feature. Positive raises risk. `none` is the baseline, so it has no weight.", "", "| Feature | Weight |", "|---|---:|"]
        lines += [f"| {key} | {value:+.3f} |" for key, value in card["coefficients"].items()]

    lines += [
        "",
        "## Limitations",
        "",
        "- Synthetic labels: a real deployment would need real repayment outcomes and a fresh evaluation.",
        "- SHAP explains how this model reached a score. It doesn't show that the model is fair or that the reasons are causal (brief §6.6).",
        "- Scores support a lender's decision. They never make it (brief §14).",
        "",
    ]
    (REPORT_DIR / "model_report.md").write_text("\n".join(lines))


def main() -> None:
    frame = generate(DEFAULT_ROWS, DEFAULT_SEED)
    features = build_features(frame)
    labels = frame["defaulted"]

    train_idx, holdout_idx = train_test_split(frame.index, test_size=0.3, random_state=DEFAULT_SEED, stratify=labels)
    val_idx, test_idx = train_test_split(holdout_idx, test_size=0.5, random_state=DEFAULT_SEED, stratify=labels.loc[holdout_idx])

    fitted, validation = {}, {}
    for candidate in candidates():
        candidate.model.fit(features.loc[train_idx], labels.loc[train_idx])
        fitted[candidate.name] = candidate.model
        validation[candidate.name] = metrics(labels.loc[val_idx], candidate.model.predict_proba(features.loc[val_idx])[:, 1])

    simple, complex_ = validation["logistic_regression"], validation["gradient_boosting"]
    improvement = simple["log_loss"] - complex_["log_loss"]
    if improvement > SIMPLICITY_MARGIN:
        name = "gradient_boosting"
        reason = f"It beat logistic regression by {improvement:.4f} log loss on validation, more than the {SIMPLICITY_MARGIN} margin."
    else:
        name = "logistic_regression"
        reason = f"Gradient boosting didn't beat logistic regression by the required {SIMPLICITY_MARGIN} log loss on validation (it changed log loss by {-improvement:+.4f}), so the simpler, easier-to-explain model stays."
    model = fitted[name]
    coefficients = check_guardrails(model, name)

    test_probabilities = model.predict_proba(features.loc[test_idx])[:, 1]
    calibration, ece = calibration_table(labels.loc[test_idx], test_probabilities)
    test_frame = frame.loc[test_idx].reset_index(drop=True)
    by_history = group_table(test_frame, test_probabilities, test_frame["repayment_history"])
    by_income = group_table(test_frame, test_probabilities, test_frame["monthly_income"].map(income_bracket))

    background = features.loc[train_idx].sample(BACKGROUND_ROWS, random_state=DEFAULT_SEED)
    explainer = build_explainer(model, name, background)

    card = {
        "model_name": name,
        "selection_reason": reason,
        "trained_on": "synthetic",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seed": DEFAULT_SEED,
        "sklearn_version": sklearn.__version__,
        "shap_version": shap.__version__,
        "rows": {"total": len(frame), "train": len(train_idx), "validation": len(val_idx), "test": len(test_idx)},
        "synthetic_history_effect": HISTORY_EFFECT,
        "validation_metrics": validation,
        "test_metrics": metrics(labels.loc[test_idx], test_probabilities),
        "calibration": calibration,
        "calibration_ece": ece,
        "by_history": by_history,
        "by_income": by_income,
        "coefficients": coefficients,
    }

    MODEL_PATH.parent.mkdir(exist_ok=True)
    joblib.dump({"model": model, "model_name": name, "explainer": explainer, "features": FEATURES, "card": card}, MODEL_PATH)
    write_report(card)

    print(json.dumps({"chosen": name, "reason": reason, "test": card["test_metrics"], "ece": ece}, indent=2))
    print(f"Saved {MODEL_PATH} and the report in {REPORT_DIR}")


if __name__ == "__main__":
    main()
