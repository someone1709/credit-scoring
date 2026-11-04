import pytest
from fastapi.testclient import TestClient

from app.assessor import MODEL_PATH
from app.main import app, state

# The brief's request example (§6.1).
BRIEF_EXAMPLE = {
    "beneficiary_id": "DEMO001",
    "monthly_income": 18000,
    "monthly_expenses": 9000,
    "existing_emi": 2000,
    "loan_amount": 25000,
    "repayment_history": "good",
    "electricity_usage": 120,
}

CONTRACT_FIELDS = {
    "beneficiary_id", "risk_score", "risk_category", "probability_of_default", "model_confidence", "income_bracket",
    "composite_score", "segment", "is_thin_file", "explanations", "explanation_method", "verification_status",
}

needs_model = pytest.mark.skipif(not MODEL_PATH.exists(), reason="Run `python -m training.train` first")


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@needs_model
def test_health_reports_the_model(client):
    body = client.get("/health").json()
    assert body["status"] == "UP"
    assert body["trained_on"] == "synthetic"


@needs_model
def test_the_briefs_example_returns_the_exact_contract(client):
    response = client.post("/assess", json=BRIEF_EXAMPLE)
    assert response.status_code == 200
    body = response.json()
    assert set(body) == CONTRACT_FIELDS
    assert body["beneficiary_id"] == "DEMO001"
    assert isinstance(body["risk_score"], int) and isinstance(body["composite_score"], int)
    assert body["income_bracket"] == "LOW_INCOME"
    assert body["explanation_method"] == "SHAP"
    assert body["model_confidence"] is None
    assert body["is_thin_file"] is False


@needs_model
def test_all_repayment_values_are_accepted(client):
    for history in ("good", "average", "poor", "none"):
        assert client.post("/assess", json=BRIEF_EXAMPLE | {"repayment_history": history}).status_code == 200


@needs_model
def test_electricity_is_optional(client):
    assert client.post("/assess", json={key: value for key, value in BRIEF_EXAMPLE.items() if key != "electricity_usage"}).status_code == 200


@pytest.mark.parametrize(
    "change, field",
    [
        ({"monthly_income": 0}, "monthly_income"),
        ({"monthly_expenses": -1}, "monthly_expenses"),
        ({"loan_amount": 0}, "loan_amount"),
        ({"repayment_history": "excellent"}, "repayment_history"),
        ({"beneficiary_id": ""}, "beneficiary_id"),
    ],
)
def test_bad_input_uses_the_briefs_error_shape(client, change, field):
    response = client.post("/assess", json=BRIEF_EXAMPLE | change)
    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "VALIDATION_ERROR"
    assert body["message"] == "Invalid input"
    assert body["details"][0]["field"] == field


def test_a_missing_model_is_reported_not_invented(client):
    saved = state["assessor"]
    state["assessor"] = None
    try:
        response = client.post("/assess", json=BRIEF_EXAMPLE)
        assert response.status_code == 503
        assert response.json()["error"] == "MODEL_UNAVAILABLE"
        assert client.get("/health").json()["status"] == "NO_MODEL"
    finally:
        state["assessor"] = saved
