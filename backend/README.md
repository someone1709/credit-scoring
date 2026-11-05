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

3. Start the API. The tables are created on first start, and later changes are applied automatically (see [Changing the database](#changing-the-database)).

   ```bash
   ./mvnw spring-boot:run
   ```

4. Check it's up at <http://localhost:8080/api/v1/health>.

5. Optionally start the [ML service](../ml-service/README.md). Without it, scoring uses the labelled rules.

6. In `frontend/`, run `npm run dev:live` and open <http://localhost:5175>.

There's no lender until one registers and is approved at `/admin/lenders`, using the `APP_ADMIN_KEY` from `.env`. To get some right away, set `APP_SEED_DEMO_PASSWORD` in `.env`. That creates Unity Bank, Grameen Finance, Saha Cooperative Bank and a beneficiary, all using that password and already approved. Their emails are in `DemoDataSeeder.java`.

With Docker, see [Hosting](../readme.md#hosting). **The Docker setup hasn't been run on the machine this was built on**, which has no Docker. The CI workflow is what first runs it.

## Tests

```bash
./mvnw test
```

These run against an in-memory database, so they need no MySQL. They cover sign-in, who can see what, and every workflow rule through the real API. `SharedScoringCasesTest` checks the scoring against [`shared/scoring_cases.json`](../shared/scoring_cases.json), which the website and the ML service must also match.

The in-memory database doesn't run the migration scripts. CI runs them on real MySQL.

## Project structure

```text
src/main/java/com/creditscore/backend/
├── config/       Security, CORS, settings, optional demo accounts
├── common/       Error format, ids, email sending, attempt limits
├── auth/         Sign-in, tokens, password reset, profile updates
├── user/         Users, beneficiary and lender profiles, lender directory, lender approval
├── assessment/   The fixed contract, the ML service client and the fallback rules
├── application/  Applications, decisions, offers, documents, disbursement
└── notification/ Notifications
src/main/resources/db/migration/   The database tables, one numbered script per change
```

`ApplicationService` holds the workflow rules, and `ApplicationMapper` is what keeps one lender from seeing another's data.

## Routes

All routes start with `/api/v1`. JSON is snake_case. `repayment_history` values are lowercase; other fixed enums are uppercase.

**Public**

| Route | Purpose |
|---|---|
| `GET /health` | Is the server up, and is the model reachable (`ml`: `UP`, `DOWN`, or `OFF` when not configured) |
| `POST /auth/register` | `role, email, phone, password`, plus `name` for a beneficiary or `institution_name, contact_person, license_number` for a lender |
| `POST /auth/login` | `email, password, remember_me` |
| `POST /auth/refresh` | New access token, using the refresh cookie |
| `POST /auth/logout` | Ends this session |
| `POST /auth/forgot-password` | `email`. Answers the same whether or not the account exists |
| `POST /auth/reset-password` | `token, password` |
| `POST /auth/verify-email` | `token`, from the link in the confirmation email |

**Any signed-in user**

| Route | Purpose |
|---|---|
| `GET /auth/me` | The current user |
| `POST /auth/change-password` | `current_password, new_password` |
| `POST /auth/resend-verification` | Sends a new confirmation link |
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
| `GET /applications/{id}/documents/{documentId}/file` | Open your own uploaded file |
| `DELETE /applications/{id}/documents/{documentId}` | Delete a file and free its slot, until an offer is accepted |
| `POST /applications/{id}/lenders/{lenderId}/revoke` | Stop sharing with one lender, unless it holds your accepted loan |
| `POST /applications/{id}/lenders/{lenderId}/reply` | `message`, to a lender waiting on more information |

**Lender only**

| Route | Purpose |
|---|---|
| `GET /lender/applications`, `GET /lender/applications/{id}` | Applications shared with you |
| `GET /lender/applications/{id}/documents/{documentId}/file` | Open a file shared with you, until another lender's offer is accepted |
| `POST /lender/applications/{id}/decision` | `status` (`UNDER_REVIEW`, `INFO_REQUESTED` or `REJECTED`) and `note` |
| `POST /lender/applications/{id}/offers` | `amount, interest_rate, tenure_months, features` |
| `POST /lender/applications/{id}/offers/{offerId}/withdraw` | Withdraw your live offer |
| `POST /lender/applications/{id}/disbursement/advance` | Move your accepted offer to the next simulated step |

**Platform**, with the header `X-Admin-Key` set to `APP_ADMIN_KEY`. The brief has only two user roles, so this is a key rather than an account. With no key set, these routes answer 404.

| Route | Purpose |
|---|---|
| `GET /admin/lenders` | Every institution, those waiting first |
| `POST /admin/lenders/{id}/approve` | Let applicants choose it |
| `POST /admin/lenders/{id}/reject` | Take away its access, except to a loan already accepted from it |

**Errors** use the shape from brief §6.7, with status 400, 401, 403, 404, 409, 413, 422 or 429:

```json
{ "error": "VALIDATION_ERROR", "message": "Invalid input", "details": [{ "field": "email", "issue": "Enter a valid email address" }] }
```

## Rules the server enforces

- **Approved lenders only:** a new institution starts as `PENDING`. Until it's approved, applicants can't choose it and it sees nothing. Approval means the platform let it in, not that its license was checked against any register.
- **Consent can be taken back:** an applicant can stop sharing with any lender, which withdraws that lender's live offer, except for the lender holding their accepted loan. They can also delete a document until an offer is accepted.
- **Confirmed email:** with email on, an applicant confirms their address before applying.
- **Lender privacy:** a lender can only reach applications the beneficiary chose to share, and any other id answers 404, the same as one that doesn't exist. Responses hold only that lender's own decision and offers. `status` is null unless their offer won, because it would reveal what other lenders did. Lenders never receive the applicant's email, phone or address.
- **Independent decisions:** one lender's rejection changes only that lender's decision. The application is `REJECTED` only when every chosen lender has rejected it.
- **One accepted offer:** each change locks the application row, and a unique database index blocks a second accepted offer even if the code were wrong.
- **No fabricated results:** `probability_of_default` is only ever set by the model, and `model_confidence` stays null. No repayment history adds no risk.
- **Documents:** type, size and the file's opening bytes are checked. A passed check doesn't prove a document is genuine, so lenders open the file and judge it themselves.
- **Who can open a file:** only its owner and the lenders they chose, and a lender loses access once another lender's offer is accepted. Each time a lender opens a file, the server logs which lender and document. Files that fail their checks are never kept.

## Security

- Passwords are stored with BCrypt, and refresh and reset tokens as SHA-256 hashes.
- Documents are encrypted with AES-256-GCM before they reach the database, using `APP_DOCUMENT_KEY`. **Back that key up**, because stored documents can't be read without it. Files are always sent as downloads, with the type set by the server, so a browser can't run one as a page.
- Access tokens last 15 minutes and stay in the browser's memory. The refresh token is in an `httpOnly`, `SameSite=Lax` cookie and is replaced on every use. An old token coming back later ends all of that user's sessions.
- Set `APP_COOKIE_SECURE=true` when serving over HTTPS.
- Repeated attempts are limited: 5 failed sign-ins per account and address, and 50 per address, each over 15 minutes. Password-reset requests, reset and confirmation links, and admin keys have limits of their own. The counts are in memory, which is enough for one server, but they reset on restart and several servers wouldn't share them.

**Email:** set the `APP_MAIL_*` settings to any SMTP service. Without them nothing is sent and nobody is asked to confirm an address. For local development, `APP_LOG_RESET_LINKS=true` prints the links to this server's log instead.

**Not included yet:** checks on lender licenses against a real register, and automatic deletion of old documents. Add these before any real use.

## Changing the database

Tables only ever change through scripts in `src/main/resources/db/migration`, which Flyway runs once each, in order, when the server starts. Hibernate then checks that the code and tables agree, and refuses to start if they don't.

To change something, add the next script, such as `V3__add_something.sql`. Never edit one that has already run. A database made before these scripts existed counts as already at version 1.

## The ML service

Set `ML_SERVICE_URL` in `.env` to where [`ml-service`](../ml-service/README.md) runs. `MlAssessmentProvider` sends it the fixed contract from brief §6, checks the answer, and always sets `verification_status` itself from the application's documents.

If the setting is empty, or the service is down, slow (over 3 seconds) or gives an invalid answer, `RuleBasedAssessmentProvider` takes over and the result says `RULE_BASED`, with no probability. Applying keeps working, and nothing is passed off as a model's output. The rules match `frontend/src/lib/assessment.js`.

The scoring thresholds are still placeholders for the team to confirm. They're listed under "Assumptions to confirm" in the [frontend README](../frontend/README.md).
