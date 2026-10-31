# PROJECT MASTER BRIEF
## AI-Powered Digital Lending & Alternative Credit Scoring Platform

---

# 1. Project Vision

Build a two-sided, AI-powered digital lending marketplace that connects **Beneficiaries (Borrowers)** with **Independent Lenders**.

The platform enables beneficiaries to apply for loans using financial information and supporting documents. An AI/ML-based credit assessment system evaluates alternative financial indicators and generates risk insights to help lenders assess applicants, including first-time borrowers and individuals with limited or no conventional credit history.

Multiple independent lenders can review an application and make their own decisions. Beneficiaries can compare available loan offers and accept a suitable offer.

**The AI system provides decision support only. Lenders retain complete authority over lending decisions.**

The project is an academic prototype. It must clearly distinguish simulated functionality from real financial services.

# 2. Problem Statement

Traditional lending systems often rely heavily on conventional credit scores and historical repayment records.

This creates difficulties for:
- First-time borrowers.
- Individuals with limited credit history.
- Applicants who have never taken a formal loan.
- People whose financial stability is not adequately represented by conventional credit scores.

The platform aims to support more inclusive credit assessment by considering alternative financial indicators, such as:
- Monthly income.
- Monthly expenses.
- Existing EMIs and financial obligations.
- Debt-to-income ratio (DTI).
- Expense-to-income ratio.
- Available repayment history.
- Income stability, where supporting evidence exists.
- Electricity usage or payment indicators, where available and appropriate.
- Supporting financial documents.

Missing repayment history must never automatically be interpreted as poor repayment behaviour or high credit risk.

# 3. User Roles

The platform has two primary user roles.

## 3.1 Beneficiary (Borrower)

Beneficiaries should be able to:

- Register and log in.
- Complete and update their profile.
- Enter financial information.
- Submit loan applications.
- Specify requested loan amount and tenure.
- Upload supporting documents.
- Track application and document verification statuses.
- View AI-generated credit assessment insights, where appropriate.
- View lender decisions and information requests.
- Receive and compare loan offers from different lenders.
- Accept one suitable offer.
- Track approval and disbursement status.
- View notifications and application history.

## 3.2 Independent Lender

Lenders should be able to:

- Register and log in.
- Access their lender dashboard.
- View applications submitted to them.
- Review beneficiary profiles and financial information.
- Review uploaded documents and their verification status.
- View credit risk scores, categories and explanations.
- Independently evaluate applications.
- Approve by making an offer, reject, or request additional information.
- Create and manage loan offers.
- Track accepted offers and simulated disbursements.
- View their own lending activity and analytics.

**Privacy requirement:** Lenders may access beneficiary information only for applications submitted to them, subject to beneficiary consent. Do not provide unrestricted access to all beneficiary records.

# 4. Complete Platform Workflow

The expected end-to-end workflow is:

1. Beneficiary registers or logs in.
2. Beneficiary completes their profile.
3. Beneficiary enters financial details.
4. Beneficiary submits a loan application.
5. Beneficiary uploads available supporting documents.
6. The platform performs available document checks.
7. The credit assessment service evaluates the available financial information.
8. The platform generates risk insights, income classification, composite score and explanations.
9. The application becomes available to the relevant lenders.
10. Each lender independently reviews the application.
11. A lender can:
    - Make a loan offer.
    - Reject the application.
    - Request additional information.
    - Keep the application under review.
12. The beneficiary receives and compares available offers.
13. The beneficiary accepts one suitable offer.
14. The platform records the accepted offer.
15. The platform displays the simulated approval and disbursement progress.

A single application may receive decisions from multiple lenders. One lender's rejection must not automatically reject the entire application while other lenders are still reviewing it.

# 5. Alternative Credit Scoring System

The credit assessment system is a central component of the project.

Its purpose is to evaluate the applicant's financial profile using available conventional and alternative financial indicators.

## 5.1 Input Features

The assessment may use:

| Feature | Description |
|---|---|
| Monthly income | Applicant's reported monthly income |
| Monthly expenses | Applicant's monthly expenditure |
| Existing EMI | Current monthly loan obligations |
| Loan amount | Requested loan amount |
| Repayment history | good, average, poor or none |
| Electricity usage | Available electricity usage indicator |
| Supporting documents | Uploaded financial evidence, where available |

Additional features may be introduced only when explicitly approved and documented.

## 5.2 Important Financial Indicators

**Debt-to-Income Ratio (DTI)**

Measures the proportion of monthly income committed to debt obligations.

**Expense-to-Income Ratio**

Measures how much of the applicant's income is spent on monthly expenses.

**Monthly Surplus**

Estimates the money remaining after expenses and existing EMI obligations.

These indicators help evaluate the applicant's ability to manage additional financial commitments.

## 5.3 First-Time Borrowers and Thin-File Applicants

The system must distinguish between:

- Good repayment history.
- Average repayment history.
- Poor repayment history.
- No repayment history.

The value `none` represents a first-time borrower or an applicant without available repayment history.

Rules:
- No history is not equivalent to poor history.
- Missing history must not automatically increase risk.
- The UI must identify thin-file applicants using a data-driven `is_thin_file` field.
- The model should handle missing repayment information explicitly.
- The system must not fabricate repayment history.

## 5.4 Credit Assessment Outputs

The assessment should produce:

- Risk score.
- Risk category.
- Probability of default, when available.
- Model confidence, when available and appropriately evaluated.
- Income bracket.
- Composite score.
- Applicant segment.
- Thin-file indicator.
- Human-readable explanations.
- Explanation method.
- Document verification status.

# 6. Fixed Data Contracts and Scoring Conventions

**This section is authoritative. Do not rename, remove, reinterpret or invent fields and enum values without explicit approval.**

## 6.1 Credit Assessment Request

Valid JSON example:

```json
{
  "beneficiary_id": "DEMO001",
  "monthly_income": 18000,
  "monthly_expenses": 9000,
  "existing_emi": 2000,
  "loan_amount": 25000,
  "repayment_history": "good",
  "electricity_usage": 120
}
```

Allowed `repayment_history` values:

`good | average | poor | none`

## 6.2 Credit Assessment Response

Valid JSON example:

```json
{
  "beneficiary_id": "DEMO001",
  "risk_score": 28,
  "risk_category": "LOW",
  "probability_of_default": 0.08,
  "model_confidence": null,
  "income_bracket": "LOW_INCOME",
  "composite_score": 72,
  "segment": "LOW_INCOME_PRIME",
  "is_thin_file": false,
  "explanations": [
    "Monthly income is available for assessment."
  ],
  "explanation_method": "RULE_BASED",
  "verification_status": "DEMO_UNVERIFIED"
}
```

The example values are illustrative, not prescribed model results.

## 6.3 Fixed Enums

**Risk category**

`LOW | MEDIUM | HIGH`

**Income bracket**

`LOW_INCOME | MID_INCOME | HIGH_INCOME | UNKNOWN`

**Applicant segment**

`PRIME | STANDARD_PLUS | LOW_INCOME_PRIME | STANDARD | SUBPRIME | HIGH_RISK`

**Repayment history**

`good | average | poor | none`

**Explanation method**

`SHAP | RULE_BASED`

**Verification status**

`DEMO_UNVERIFIED | DOCUMENT_UPLOADED | CHECKS_PASSED | CHECKS_FAILED | NOT_PROVIDED`

## 6.4 Score Interpretation

| Field | Range | Meaning |
|---|---:|---|
| `risk_score` | 0–100 | Higher means greater risk |
| `composite_score` | 0–100 | Higher means a more favourable profile |
| `probability_of_default` | 0–1 | Estimated probability of default, when available |
| `model_confidence` | 0–1 or null | Confidence output, only when supported by the implemented and evaluated model |

Risk score and composite score must never be confused.

A high composite score indicates a more favourable profile. A high risk score indicates greater risk.

## 6.5 Optional Model Outputs

`probability_of_default` and `model_confidence` may be `null` when unavailable.

Rules:
- Do not invent probability or confidence values.
- Mock-mode outputs must be clearly labelled illustrative.
- Do not present synthetic model outputs as validated real-world predictions.
- Do not call a probability value validated model confidence without appropriate evaluation and calibration.
- If confidence is not implemented, show it as unavailable rather than displaying a fabricated percentage.

## 6.6 Explanation Honesty

Use `explanation_method` to identify how explanations were generated.

- `SHAP`: explanations generated using SHAP.
- `RULE_BASED`: explanations generated using predefined rules.

Do not label rule-based explanations as SHAP explanations.

SHAP explains model contributions; it does not establish that the model is fair or unbiased.

## 6.7 Error Response

Use this structure for validation errors:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": [
    {
      "field": "monthly_income",
      "issue": "Must be greater than zero"
    }
  ]
}
```

# 7. Lender Decisions and Application Status

These are separate data concepts and must be implemented separately.

## 7.1 Per-Lender Decision Status

Each lender's decision for an application must be stored independently.

Allowed values:

`PENDING | UNDER_REVIEW | INFO_REQUESTED | OFFER_MADE | REJECTED`

A lender's decision applies only to that lender's review of the application.

## 7.2 Beneficiary Application Status

The beneficiary-facing application status is an aggregate application-level status.

Allowed values:

`SUBMITTED | DOCUMENTS_REQUIRED | UNDER_REVIEW | OFFERS_AVAILABLE | OFFER_ACCEPTED | REJECTED | DISBURSED`

Rules:
- One lender rejecting an application does not automatically reject it for every lender.
- The application can remain under review while other lenders are reviewing it.
- `OFFERS_AVAILABLE` indicates that one or more offers are available.
- `OFFER_ACCEPTED` indicates that the beneficiary accepted an offer.
- `DISBURSED` indicates the recorded disbursement stage. In Phase 1 this is simulated.

Do not use one status field to represent both concepts.

# 8. Loan Offer Data Model

Each offer must contain the following fields:

```json
{
  "lender_id": "LENDER001",
  "amount": 25000,
  "interest_rate": 12.5,
  "tenure_months": 12,
  "status": "PENDING"
}
```

Allowed offer statuses:

`PENDING | ACCEPTED | DECLINED | EXPIRED | WITHDRAWN`

Requirements:
- Offers must be associated with the relevant application and lender.
- Beneficiaries must be able to compare available offers.
- A beneficiary can accept one suitable offer.
- The accepted offer must be identifiable.
- Offers and disbursement tracking are mock-only in Phase 1.
- Do not implement real money transfers or financial transactions.

# 9. Document Upload and Verification

The platform should support uploading relevant financial documents.

Examples:
- Income proof.
- Bank statements.
- Electricity bills.
- Other supporting financial documents.

Document statuses:

`DEMO_UNVERIFIED | DOCUMENT_UPLOADED | CHECKS_PASSED | CHECKS_FAILED | NOT_PROVIDED`

Important distinction:

- Uploading a document does not establish its authenticity.
- Basic file checks do not prove that a document is genuine.
- `CHECKS_PASSED` means only that the implemented basic checks passed.
- No government verification API should be claimed unless actually integrated.
- Demo verification must be clearly labelled as simulated or unverified.

# 10. Beneficiary Dashboard

The Beneficiary Dashboard is the primary borrower-facing interface.

## 10.1 Main Sections

1. Overview.
2. Apply for Loan.
3. My Applications.
4. Loan Offers.
5. Documents and Verification Status.
6. Disbursement Status.
7. Notifications.
8. Profile and Settings.

## 10.2 Overview

Display:
- Welcome message.
- Application summary.
- Current application status.
- Available offers.
- Accepted offer information, if any.
- Document status.
- Recent activity.

## 10.3 Apply for Loan

Provide a structured form for:
- Loan amount.
- Loan purpose, if included in the approved form.
- Requested tenure.
- Monthly income.
- Monthly expenses.
- Existing EMI.
- Repayment history.
- Available alternative financial information.
- Supporting document uploads.

Use appropriate validation and clear error messages.

## 10.4 My Applications

Display:
- Application ID.
- Requested loan amount.
- Submission date.
- Current aggregate application status.
- Lender review progress.
- Available actions.

## 10.5 Loan Offers

Display offer cards containing:
- Lender name.
- Offered amount.
- Interest rate.
- Tenure.
- Offer status.
- Accept or decline actions, as applicable.

Make comparison straightforward.

## 10.6 Design Direction

Use the previously generated Beneficiary Dashboard reference image as the primary visual inspiration.

Visual style:
- Dark charcoal/black background.
- Emerald green accents.
- Rounded cards.
- Clean typography.
- Minimalist layout.
- Clear application status and progress indicators.
- Good spacing and responsive design.

Avoid unnecessary duplicate sections, especially duplicate document sections.

# 11. Lender Dashboard

The Lender Dashboard is designed for independent lenders reviewing loan applications.

## 11.1 Main Sections

1. Overview.
2. Loan Applications.
3. Applicant Details.
4. Risk Analysis.
5. My Offers.
6. Disbursements.
7. Repayments.
8. Analytics.
9. Settings.

Only display information the lender is authorized to access.

## 11.2 Overview

Display:
- Total applications available to the lender.
- Applications under review.
- Offers made.
- Rejected applications.
- Accepted offers.
- Simulated disbursement summary.

## 11.3 Loan Applications

Display:
- Application ID.
- Beneficiary details permitted for review.
- Requested loan amount.
- Income information.
- Application date.
- Current lender-specific decision status.
- Risk category.

Allow lenders to open an application and review its details.

## 11.4 Applicant Details

Display:
- Relevant beneficiary profile.
- Financial inputs.
- Available supporting documents.
- Document verification status.
- Thin-file indicator.
- Repayment history, including `none`.
- Credit assessment outputs.

## 11.5 Risk Analysis

Display:
- Risk score.
- Risk category.
- Composite score.
- Income bracket.
- Applicant segment.
- Probability of default, if available.
- Model confidence, if available.
- Explanation list.
- Explanation method.

Clearly communicate which numbers are risk scores and which are composite scores.

## 11.6 Lender Actions

Allow the lender to:
- Mark an application under review.
- Request additional information.
- Make a loan offer.
- Reject the application.

These actions update that lender's decision only.

## 11.7 Design Direction

Use the previously generated Lender Dashboard reference image as the primary visual inspiration.

Visual style:
- Dark navy/charcoal background.
- Blue and emerald accents.
- Professional financial underwriting interface.
- Clean tables.
- Rounded cards.
- Clear status badges.
- Minimalist charts and analytics.

**Reference-image caveat:** The lender reference image contains a column labelled "Risk Score" where higher values indicate a better profile. Treat those displayed numbers as composite scores. The actual risk score convention remains higher = riskier. Do not copy the inverted interpretation.

# 12. Technology Stack

Use the following technology stack.

## Frontend
- React.
- TypeScript.
- Tailwind CSS.
- React Router.
- Axios.
- Recharts.
- React Hook Form.
- Zod.

## Backend
- Java 21.
- Spring Boot.
- REST APIs.

## Machine Learning Service
- Python.
- FastAPI.
- scikit-learn.
- SHAP, if implemented.

## Database
- MySQL.

## Development Tools
- Git.
- GitHub.
- VS Code.
- Antigravity.

Do not introduce additional frameworks, databases, or major dependencies without a clear requirement and approval.

# 13. Development Strategy and Phases

**Mandatory implementation order:**

Frontend → Backend → Machine Learning → Integration.

Do not skip ahead.

## Phase 1: Complete Frontend (Current Priority)

Build both Beneficiary and Lender dashboards using mock data.

Requirements:
- Implement both dashboards.
- Implement navigation and routing.
- Implement mock role switching for Beneficiary and Lender.
- Implement forms and validation using React Hook Form and Zod.
- Implement application submission using mock data.
- Implement application status tracking.
- Implement document upload UI and mock verification statuses.
- Implement lender application review.
- Implement lender-specific decisions.
- Implement mock loan offers.
- Implement offer comparison and acceptance.
- Implement simulated disbursement tracking.
- Use consistent, API-ready data structures.
- Keep the UI responsive.
- Clearly label mock data and simulated operations.

**Authentication:** Phase 1 must use a mock role switcher. Real registration, login, authentication, and authorization belong to Phase 2.

**Do not implement during Phase 1:**
- Spring Boot backend.
- MySQL database.
- FastAPI service.
- Real ML model training.
- Real authentication.
- Real financial transactions.
- Real disbursement.
- Government verification integrations.

### Phase 1 Quality Checks

Before considering the frontend complete, run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Resolve errors before moving to Phase 2.

## Phase 2: Backend Development

Implement:
- Spring Boot application.
- REST APIs.
- MySQL database.
- User and role management.
- Beneficiary profile management.
- Loan application management.
- Lender application access.
- Lender-specific decisions.
- Loan offer management.
- Document metadata and status management.
- Application status aggregation.

Implement authentication and role-based authorization.

Follow the fixed data contracts and enum definitions in this brief.

## Phase 3: Machine Learning Development

Implement the credit assessment service using Python, FastAPI and scikit-learn.

Requirements:
- Prepare the dataset.
- Handle missing values appropriately.
- Handle first-time borrowers explicitly.
- Engineer relevant financial features.
- Train and evaluate the model.
- Generate probability of default when supported.
- Generate risk score and category.
- Generate composite score and applicant segment.
- Generate explanations.
- Use SHAP only if genuinely implemented.
- Evaluate model performance.
- Evaluate probability calibration if displaying calibrated probabilities or confidence.

Synthetic data may be used for the academic prototype, but all synthetic predictions and model limitations must be disclosed.

Do not claim real-world predictive accuracy or fairness without suitable evidence.

## Phase 4: System Integration

Integrate:
- React frontend.
- Spring Boot backend.
- MySQL database.
- Python FastAPI ML service.

Connect the frontend to the backend APIs.

Connect the backend to the ML assessment service.

Test the complete beneficiary-to-lender workflow.

Verify:
- Application submission.
- Credit assessment.
- Document status handling.
- Multiple lender reviews.
- Independent lender decisions.
- Offer creation.
- Offer comparison.
- Offer acceptance.
- Application status aggregation.
- Simulated disbursement tracking.

## Phase 5: Testing and Finalization

Complete:
- Frontend testing.
- Backend API testing.
- ML service testing.
- Integration testing.
- Input validation.
- Error handling.
- Role-based access checks.
- Privacy checks.
- Responsive UI testing.
- Documentation.
- Final build verification.

# 14. Fairness, Privacy and Responsible AI

The platform must follow these principles:

1. AI must support lending decisions, not make final lending decisions.
2. Lenders independently decide whether to make offers.
3. Missing repayment history must not automatically mean poor creditworthiness.
4. Financial indicators must be interpreted carefully and transparently.
5. Electricity usage must not be assumed to be a universally reliable credit signal.
6. Alternative indicators, especially electricity usage, require separate fairness evaluation.
7. SHAP explanations do not prove model fairness.
8. Beneficiary data must be accessible only to authorized lenders for relevant applications, subject to consent.
9. Do not expose sensitive information unnecessarily.
10. Do not present synthetic predictions as validated real-world results.

# 15. UI and Implementation Rules for Antigravity

Follow these rules throughout development:

1. Read and understand the root `README.md` and this Master Brief before modifying code.
2. Treat both documents as the project's source of truth.
3. The README provides the concise project overview; this Master Brief provides detailed requirements.
4. Use the two supplied dashboard images as primary visual references.
5. Preserve the two user roles and their distinct dashboards.
6. Preserve all fixed field names, enum values and scoring conventions.
7. Do not invent API contracts, features, workflows or data fields.
8. Do not silently change the agreed technology stack.
9. Do not implement future development phases prematurely.
10. Use mock data during Phase 1 and label it clearly.
11. Keep frontend data structures ready for later backend integration.
12. Avoid unnecessary UI sections and duplicate components.
13. Maintain clean, modular and reusable code.
14. Preserve existing working functionality when modifying code.
15. Test changes and resolve errors before reporting completion.
16. If a requirement is unclear or conflicts with another requirement, ask for clarification instead of making assumptions.

# 16. Expected Final Outcome

The final system should be a functional academic prototype of an AI-powered digital lending marketplace.

It should demonstrate:

- A complete Beneficiary Dashboard.
- A complete Lender Dashboard.
- Loan application submission.
- Alternative credit assessment.
- First-time borrower and thin-file handling.
- Credit risk insights and explainability.
- Document status tracking.
- Independent decisions by multiple lenders.
- Loan offer generation and comparison.
- Offer acceptance.
- Application status tracking.
- Simulated disbursement tracking.
- Backend persistence and API integration.
- An independently running ML assessment service.

The platform should demonstrate how alternative financial indicators can help lenders assess applicants who may not have conventional credit histories, while keeping the lending decision with the lender.

**Final principle: Build a transparent, explainable and inclusive lending decision-support platform—not an automated loan approval system.**