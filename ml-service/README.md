# BeneScore ML service

Assesses credit risk for the lending platform: Python, FastAPI, scikit-learn and SHAP. The project brief is [`project_master_brief.md`](../project_master_brief.md), and the results are in [`reports/model_report.md`](reports/model_report.md).

> **Trained on synthetic data only.** The defaults in the training data come from rules written for this project. So the results show that the pipeline works, not how real borrowers behave, and they don't show that the model is fair. It supports a lender's decision and never makes one.

## Run it

Requires Python 3.12 or newer.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m training.train
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The training step builds the model and rewrites the report. It takes a few seconds and gives the same model each time. The model file isn't in git, so everyone builds their own and nobody loads a binary from the repo.

To use it, set `ML_SERVICE_URL=http://localhost:8000` in `backend/.env` and start the backend. Only the backend should call this service. It has no sign-in, so don't expose it to the internet.

## Tests

```bash
.venv/bin/python -m pytest
```

These check the rules on the model that was actually trained, so train first.

## API

**`POST /assess`** takes and returns the fixed contract from brief §6:

```json
{ "beneficiary_id": "DEMO001", "monthly_income": 18000, "monthly_expenses": 9000, "existing_emi": 2000, "loan_amount": 25000, "repayment_history": "good", "electricity_usage": 120 }
```

```json
{
  "beneficiary_id": "DEMO001",
  "risk_score": 21,
  "risk_category": "LOW",
  "probability_of_default": 0.0433,
  "model_confidence": null,
  "income_bracket": "LOW_INCOME",
  "composite_score": 79,
  "segment": "LOW_INCOME_PRIME",
  "is_thin_file": false,
  "explanations": ["Requested amount of 11.6% of annual income lowered the estimated risk.", "..."],
  "explanation_method": "SHAP",
  "verification_status": "DEMO_UNVERIFIED"
}
```

The backend replaces `verification_status` with the status worked out from the application's documents, because this request carries no document data.

**`GET /health`** reports whether a model is loaded. Bad input gets a 422 in the error shape from brief §6.7. If no model has been trained, `/assess` answers 503 rather than inventing a result.

## How it works

| Step | File |
|---|---|
| Generates 20,000 fictional borrowers from documented rules | `training/generate_data.py` |
| Turns applications into model features, for both training and live use | `app/features.py` |
| Trains two models, picks one, evaluates it and writes the report | `training/train.py` |
| Turns a probability into the platform's scores | `app/scoring.py` |
| Scores one application and writes its explanations | `app/assessor.py` |

## Decisions, and why

- **No repayment history is the neutral baseline.** `none` has no feature of its own, so the model has nothing to learn a penalty on. Good history lowers risk from there, and average and poor raise it. Training stops if the weights ever break that order, and a test checks it across a grid of applicants.
- **Only ratios go in.** Raw income isn't a feature, so two people with the same ratios get the same risk whatever they earn.
- **Electricity usage isn't scored.** It's accepted and noted, but brief §14 says it isn't a reliable signal without a separate fairness evaluation, and synthetic data can't provide one. Any link to default would only be a rule written for this project.
- **The simpler model wins unless the other is clearly better.** Logistic regression and gradient boosting compete on a validation split, and boosting must beat it by 0.001 log loss. Logistic regression won, so each score is easy to explain.
- **Explanations are real SHAP values.** A test confirms they add up to the model's actual prediction. SHAP explains how this model reached a score. It doesn't show that the model is fair or that the reasons are causal.
- **`model_confidence` is always null,** because no confidence measure has been implemented and evaluated (brief §6.5).
- **`risk_score` is 100 x sqrt(probability),** which gives the brief's example of 28 for 0.08. The other scoring bands match the backend's, and they're placeholders for the team to confirm.

## If this service is down

The backend waits up to 3 seconds, then uses its rule-based scoring and labels the result `RULE_BASED`, with no probability. Applying keeps working, and nothing is passed off as a model's output.

## Using real data later

Replace `training/generate_data.py` with real repayment outcomes that have the same columns, then retrain and read the report again. Check the results by group and get a proper fairness evaluation before relying on it.
