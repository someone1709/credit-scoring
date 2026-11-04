# BeneScore backend

The REST API for the lending platform: Java 21, Spring Boot and MySQL. The project brief is [`project_master_brief.md`](../project_master_brief.md).

> **Academic prototype.** No real loans, credit checks or payments happen. Disbursement and repayments are simulated.

## Run it

You need Java 21 and MySQL 8. The Maven wrapper (`./mvnw`) downloads Maven for you.

1. Create the database and a user. Choose your own password:

   ```sql
   CREATE DATABASE credit_scoring;
   CREATE USER 'credituser'@'localhost' IDENTIFIED BY 'choose-a-password';
   GRANT ALL PRIVILEGES ON credit_scoring.* TO 'credituser'@'localhost';
   ```

2. Copy `.env.example` to `.env` and fill it in. `.env` is git-ignored, so secrets never reach the repo.

3. Start the API. The tables are created on first start.

   ```bash
   ./mvnw spring-boot:run
   ```

4. Check it's up at <http://localhost:8080/api/v1/health>.

5. In `frontend/`, run `npm run dev:live` and open <http://localhost:5175>.

There's no lender until one registers. To get some right away, set `APP_SEED_DEMO_PASSWORD` in `.env`. That creates Unity Bank, Grameen Finance, Saha Cooperative Bank and a beneficiary, all using that password. Their emails are in `DemoDataSeeder.java`.

With Docker, put the same settings in a `.env` next to `docker-compose.yml` and run `docker compose up --build`. **The Docker setup hasn't been run yet**, because the machine this was built on has no Docker.

## Tests

```bash
./mvnw test
```

These run against an in-memory database, so they need no MySQL. They cover sign-in, who can see what, and every workflow rule through the real API.

## Project structure

```text
src/main/java/com/creditscore/backend/
├── config/       Security, CORS, settings, optional demo accounts
├── common/       Error format, ids
├── auth/         Sign-in, tokens, password reset, profile updates
├── user/         Users, beneficiary and lender profiles, lender directory
├── assessment/   The fixed contract, and the scoring behind AssessmentProvider
├── application/  Applications, decisions, offers, documents, disbursement
└── notification/ Notifications
src/main/resources/schema.sql   The database tables
```

`ApplicationService` holds the workflow rules, and `ApplicationMapper` is what keeps one lender from seeing another's data.

## Routes

All routes start with `/api/v1`. JSON is snake_case. `repayment_history` values are lowercase; other fixed enums are uppercase.

**Public**

| Route | Purpose |
|---|---|
| `GET /health` | Is the server up |
| `POST /auth/register` | `role, email, phone, password`, plus `name` for a beneficiary or `institution_name, contact_person, license_number` for a lender |
| `POST /auth/login` | `email, password, remember_me` |
| `POST /auth/refresh` | New access token, using the refresh cookie |
| `POST /auth/logout` | Ends this session |
| `POST /auth/forgot-password` | `email`. Answers the same whether or not the account exists |
| `POST /auth/reset-password` | `token, password` |

**Any signed-in user**

| Route | Purpose |
|---|---|
| `GET /auth/me` | The current user |
| `POST /auth/change-password` | `current_password, new_password` |
| `GET /notifications` | Your latest 100 |
| `POST /notifications/{id}/read`, `POST /notifications/read-all` | Mark as read |

**Beneficiary only**

| Route | Purpose |
|---|---|
| `PATCH /auth/me` | Update your profile |
| `GET /lenders` | Lenders you can share with, with no contact details |
| `GET /applications`, `GET /applications/{id}` | Your applications |
| `POST /applications` | Apply: loan and financial fields, `lender_ids`, `consent: true` |
| `POST /applications/{id}/offers/{offerId}/accept` | Accept one offer. The others are declined |
| `POST /applications/{id}/offers/{offerId}/decline` | Decline an offer |
| `POST /applications/{id}/documents/{documentId}` | Upload as multipart field `file` |

**Lender only**

| Route | Purpose |
|---|---|
| `GET /lender/applications`, `GET /lender/applications/{id}` | Applications shared with you |
| `POST /lender/applications/{id}/decision` | `status` (`UNDER_REVIEW`, `INFO_REQUESTED` or `REJECTED`) and `note` |
| `POST /lender/applications/{id}/offers` | `amount, interest_rate, tenure_months, features` |
| `POST /lender/applications/{id}/offers/{offerId}/withdraw` | Withdraw your live offer |
| `POST /lender/applications/{id}/disbursement/advance` | Move your accepted offer to the next simulated step |

**Errors** use the shape from brief §6.7, with status 400, 401, 403, 404, 409, 413 or 422:

```json
{ "error": "VALIDATION_ERROR", "message": "Invalid input", "details": [{ "field": "email", "issue": "Enter a valid email address" }] }
```

## Rules the server enforces

- **Lender privacy:** a lender can only reach applications the beneficiary chose to share, and any other id answers 404, the same as one that doesn't exist. Responses hold only that lender's own decision and offers. `status` is null unless their offer won, because it would reveal what other lenders did. Lenders never receive the applicant's email, phone or address.
- **Independent decisions:** one lender's rejection changes only that lender's decision. The application is `REJECTED` only when every chosen lender has rejected it.
- **One accepted offer:** each change locks the application row, and a unique database index blocks a second accepted offer even if the code were wrong.
- **No fabricated results:** `probability_of_default` and `model_confidence` stay null until a real model provides them. No repayment history adds no risk.
- **Documents:** type, size and the file's actual contents are checked. Only the name and result are stored, and the file is discarded. A passed check doesn't prove a document is genuine.

## Security

- Passwords are stored with BCrypt, and refresh and reset tokens as SHA-256 hashes.
- Access tokens last 15 minutes and stay in the browser's memory. The refresh token is in an `httpOnly`, `SameSite=Lax` cookie and is replaced on every use. An old token coming back later ends all of that user's sessions.
- Set `APP_COOKIE_SECURE=true` when serving over HTTPS.

**Not included yet:** real email (reset links are only printed to this server's log, and only when `APP_LOG_RESET_LINKS=true`), limits on repeated sign-in attempts, and checks on lender licenses. Add these before any real use.

## Connecting the ML service

`RuleBasedAssessmentProvider` is a placeholder that matches `frontend/src/lib/assessment.ts`. For Phase 3, write a class that implements `AssessmentProvider` and calls the FastAPI service using the fixed contract in `AssessmentContract`, then remove the placeholder's `@Component`. Nothing else needs to change.

The scoring thresholds are still placeholders for the team to confirm. They're listed under "Assumptions to confirm" in the [frontend README](../frontend/README.md).
