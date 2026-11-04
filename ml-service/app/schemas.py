"""The fixed credit assessment contract from Master Brief §6. Don't rename fields or enum values."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

RepaymentHistory = Literal["good", "average", "poor", "none"]
RiskCategory = Literal["LOW", "MEDIUM", "HIGH"]
IncomeBracket = Literal["LOW_INCOME", "MID_INCOME", "HIGH_INCOME", "UNKNOWN"]
Segment = Literal["PRIME", "STANDARD_PLUS", "LOW_INCOME_PRIME", "STANDARD", "SUBPRIME", "HIGH_RISK"]
ExplanationMethod = Literal["SHAP", "RULE_BASED"]
VerificationStatus = Literal["DEMO_UNVERIFIED", "DOCUMENT_UPLOADED", "CHECKS_PASSED", "CHECKS_FAILED", "NOT_PROVIDED"]

# Catches bad input. It isn't a lending rule.
SANITY_LIMIT = 1_000_000_000


class AssessmentRequest(BaseModel):
    beneficiary_id: str = Field(min_length=1, max_length=50)
    monthly_income: float = Field(gt=0, le=SANITY_LIMIT)
    monthly_expenses: float = Field(ge=0, le=SANITY_LIMIT)
    existing_emi: float = Field(ge=0, le=SANITY_LIMIT)
    loan_amount: float = Field(gt=0, le=SANITY_LIMIT)
    repayment_history: RepaymentHistory
    electricity_usage: Optional[float] = Field(default=None, ge=0, le=SANITY_LIMIT)


class AssessmentResponse(BaseModel):
    beneficiary_id: str
    risk_score: int = Field(ge=0, le=100)
    risk_category: RiskCategory
    probability_of_default: Optional[float] = Field(ge=0, le=1)
    model_confidence: Optional[float] = Field(ge=0, le=1)
    income_bracket: IncomeBracket
    composite_score: int = Field(ge=0, le=100)
    segment: Segment
    is_thin_file: bool
    explanations: list[str]
    explanation_method: ExplanationMethod
    verification_status: VerificationStatus


class FieldIssue(BaseModel):
    field: str
    issue: str


class ApiError(BaseModel):
    """The error body from Master Brief §6.7."""

    error: str
    message: str
    details: list[FieldIssue] = []
