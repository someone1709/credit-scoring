# AI-Powered Digital Lending & Alternative Credit Scoring Platform

A decision-support prototype connecting beneficiaries with lenders through credit risk assessment, income classification, and document-status tracking.

> **Academic prototype.** Uses synthetic data and demo-only verification. Scores are illustrative and are NOT lending decisions. OCR/checksum checks do not prove document authenticity, and no government API is integrated.

## Overview
Traditional lending relies heavily on credit history, which excludes first-time borrowers. This platform evaluates financial inputs and alternative indicators (income, expenses, EMI, repayment behaviour, electricity usage) to support lender decisions.

## Project Status
| Layer | Status |
|---|---|
| Frontend (React + JavaScript + Tailwind) | Built, runs on demo data or the backend |
| Backend (Spring Boot + MySQL) | Built, with labelled rule-based scoring if the ML service is down |
| ML service (FastAPI) | Built, trained on synthetic data only |
| Integration | Frontend, backend and ML service connected |

Development order: Frontend (mock) -> Backend -> ML -> Integration.

## Run it

```bash
./scripts/start-dev.sh
```

This starts MySQL, the ML service, the backend and the website, reusing anything already running, then prints the address. It needs `backend/.env` to exist, which [the backend README](backend/README.md) explains. Logs go to `.dev-logs/`, and `./scripts/stop-dev.sh` stops what it started.

New lenders have to be approved at `/admin/lenders`, using the `APP_ADMIN_KEY` from `backend/.env`.

## Hosting

The whole site can run at one address with Docker. **This is checked by CI, not on the machine it was built on**, which has no Docker. You need a server with Docker and a domain name.

1. Put a `.env` next to `docker-compose.yml`. Generate each secret, and keep them out of git:

   ```bash
   DB_USERNAME=credituser
   DB_PASSWORD=choose-a-password
   APP_JWT_SECRET=run: openssl rand -base64 48
   APP_DOCUMENT_KEY=run: openssl rand -base64 32
   APP_ADMIN_KEY=run: openssl rand -hex 24
   APP_FRONTEND_URL=https://your-domain
   APP_CORS_ORIGINS=https://your-domain
   APP_COOKIE_SECURE=true
   ```

   Add the `APP_MAIL_*` settings from `backend/.env.example` to send real email. Without them, nobody can reset a forgotten password.

2. Run `docker compose up --build -d`. The site answers on port 8088.

3. Put an HTTPS proxy such as Caddy in front of port 8088. Passwords and documents must never travel over plain HTTP.

4. Back up the database and `APP_DOCUMENT_KEY` together. Stored documents can't be read without that key.

This is an academic prototype on synthetic data, so don't host it for real borrowers.

## Key Features
**Beneficiary Portal:** apply for loans, upload documents, track application and document status, compare lender offers.
**Lender Portal:** review applications and beneficiary profiles, view risk insights, approve / reject / request info (demo actions), create offers, track disbursements (mock).
**Credit Assessment:** risk score and category (LOW / MEDIUM / HIGH), income bracket, composite score and segment, SHAP explanations.
**Document Status Tracking:** upload, basic checks, and a clearly labelled status showing what has and has not been verified.

## Score Conventions
- `risk_score` 0-100: higher = greater risk
- `composite_score` 0-100: higher = more favourable
- `verification_status`: DEMO_UNVERIFIED | DOCUMENT_UPLOADED | CHECKS_PASSED | CHECKS_FAILED | NOT_PROVIDED

## Tech Stack
React, JavaScript, Tailwind CSS, Recharts | Java 21, Spring Boot | Python, FastAPI, scikit-learn | MySQL | Git, GitHub

## Workflow
1. Beneficiary submits a loan request and optional documents.
2. System runs document checks and the credit assessment.
3. Lender reviews the application and risk insights.
4. Lender makes an offer or rejects.
5. Beneficiary compares and accepts an offer.

## Repository Structure
credit-scoring/
  frontend/  backend/  ml-service/
  shared/   Scoring answers that all three services are tested against
  scripts/  Start and stop everything for development


## Architecture

```text
Beneficiary / Lender
        |
   React Frontend
        |
  Spring Boot Backend
        |
   +----+------+
   |           |
 MySQL      FastAPI
 Database   ML Service
               |
        Credit Risk Assessment
```


![alt text](image.png)
![alt text](image-1.png)