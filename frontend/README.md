# BeneScore frontend

Frontend for the **AI-Powered Digital Lending & Alternative Credit Scoring Platform**: a marketplace connecting beneficiaries (borrowers) with independent lenders. The project brief is [`project_master_brief.md`](../project_master_brief.md).

> **Academic prototype.** No real loans, credit checks or payments happen. All data is synthetic, and simulated features are labelled in the UI.

## Quick start

Requires Node 20.19 or newer. `npm test` needs Node 22.18 or newer.

```bash
npm install
npm run dev
```

Open the address Vite prints. No backend is needed.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server |
| `npm run build` | Type-checks and builds for production into `dist/` |
| `npm run typecheck` | Runs the TypeScript compiler |
| `npm run lint` | Runs Oxlint |
| `npm test` | Runs the rule tests in `src/lib/rules.test.ts` |

## Trying it

Pick a demo account on the sign-in page. They need no password, and the **Demo role** switcher in the top bar moves between the two sides. You can also register a new account, which keeps its own password.

| Account | Shows |
|---|---|
| Rahul Kumar | Two offers to compare, a disbursed loan and a rejected application |
| Priya Sharma | An open information request from a lender |
| Arjun Nair | A first-time borrower with a good score, because no history adds no risk |
| Unity Bank, Grameen Finance, Saha Cooperative Bank | Each lender's separate view of the applications shared with it |

Data is kept in this browser. To start again, use **Reset demo data** in the account menu at the top right.

## Project structure

```text
src/
├── App.tsx            Routes and role guards
├── components/
│   ├── auth/          Sign-in fields and layout, route guards, change password
│   ├── layout/        Shell, sidebar, top bar
│   └── shared/        Cards, badges, score gauges, steppers
├── context/           Auth and application state
├── data/mockData.ts   Fictional demo data
├── lib/
│   ├── workflow.ts    Status, decisions, offers, disbursement, document checks
│   ├── assessment.ts  Illustrative rule-based credit assessment
│   ├── finance.ts     DTI, surplus, EMI and repayment schedule
│   └── rules.test.ts  Tests for the rules above
├── pages/             Screens, by role
├── services/
│   ├── http.ts        Axios client, tokens, refresh and error handling
│   └── auth/          The mock and backend sign-in clients
└── types/             Shared types, including the fixed contract from the brief
```

`lib/workflow.ts` is plain functions with no React, so the backend team can use it as a reference for the same rules.

## Connecting the backend

Authentication is ready to connect. Screens only use the `AuthService` interface in `src/types/auth.ts`, so no screen changes when the backend arrives. Copy `.env.example` to `.env.local` and set:

```bash
VITE_API_MODE=live
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

This turns off the demo accounts and the role switcher. The wire format lives only in `src/services/auth/http.ts`.

| Request | Body | Success |
|---|---|---|
| `POST /auth/login` | `email, password, remember_me` | `AuthResponse` |
| `POST /auth/register` | `role, email, phone, password`, plus `name` for a beneficiary or `institution_name, contact_person, license_number` for a lender | `AuthResponse` |
| `POST /auth/refresh` | none; uses the cookie | `AuthResponse` |
| `POST /auth/logout` | none | any 2xx |
| `POST /auth/forgot-password` | `email` | any 2xx, even for an unknown email |
| `POST /auth/reset-password` | `token, password` | any 2xx |
| `POST /auth/change-password` | `current_password, new_password` | any 2xx |
| `PATCH /auth/me` | `name, email, phone, age, occupation, address, city, state, pincode` | the user |

`AuthResponse` is `{ "access_token": "...", "user": User }`, and a `User` is one of:

```json
{ "id": "BEN1", "role": "beneficiary", "name": "", "email": "", "phone": "", "age": null, "occupation": null, "address": null, "city": null, "state": null, "pincode": null }
{ "id": "LEN1", "role": "lender", "institution_name": "", "contact_person": "", "email": "", "phone": "", "license_number": "" }
```

What the backend needs to do:

- **Tokens:** send the short-lived access token in the response body; the frontend keeps it in memory and sends `Authorization: Bearer`. Keep the refresh token in an `httpOnly` cookie, and allow credentials in CORS for the frontend's origin. On a 401, the frontend refreshes once and retries the request.
- **Errors:** use the shape from brief §6.7. A `details` entry with a known `field` appears on that input; anything else appears above the form. The field names are the snake_case names above.

  ```json
  { "error": "VALIDATION_ERROR", "message": "Invalid input", "details": [{ "field": "email", "issue": "Already registered" }] }
  ```

- **A wrong password** returns 401 from `/auth/login`, and 422 with a `current_password` detail from `/auth/change-password`, so it isn't mistaken for an expired session.
- **Forgot password** must answer the same way whether or not the account exists.

### Not connected yet

Only authentication has a backend client. Applications, offers, documents and notifications still run on `AppContext` and demo data in both modes, and the list of lenders comes from the mock. In live mode, a new account therefore sees an empty dashboard until those are connected. Use `lib/workflow.ts` as the reference when you build them, and enforce the access rules on the server, because the browser's checks can be bypassed.

## What is simulated

| Feature | In this build |
|---|---|
| Sign-in | Accounts live in this browser with salted password hashes. This is not secure, so don't use a real password. Password-reset email isn't sent; a labelled link appears on screen instead |
| Credit assessment | A rule-based points system, not a trained model. `probability_of_default` and `model_confidence` are always `null` and shown as Unavailable |
| Document checks | File type and size only. Only the file's name is kept, and the file never leaves the browser |
| Disbursement and repayments | The lender moves the steps by hand, and schedules are calculated. No money moves and no payments are recorded |

## Assumptions to confirm

The brief requires these outputs but doesn't define the rules, so the team should confirm them.

| Topic | Current rule | Where |
|---|---|---|
| Risk category | `LOW` up to 30, `MEDIUM` up to 60, `HIGH` above that | `lib/assessment.ts` |
| Income bracket | `LOW_INCOME` below ₹25,000, `MID_INCOME` from ₹25,000, `HIGH_INCOME` from ₹50,000 | `lib/assessment.ts` |
| Composite score | 70% inverse risk, 30% affordability (50% of income left scores 100) | `lib/assessment.ts` |
| Segment | `PRIME` 75+ with high income, `LOW_INCOME_PRIME` 70+ with low income, `STANDARD_PLUS` 70+, `STANDARD` 45+, `SUBPRIME` 30+, otherwise `HIGH_RISK` | `lib/assessment.ts` |
| Application status | First match wins: `DISBURSED`, `OFFER_ACCEPTED`, `OFFERS_AVAILABLE`, `DOCUMENTS_REQUIRED`, `REJECTED` (only if every lender rejected), `UNDER_REVIEW`, `SUBMITTED` | `lib/workflow.ts` |
| After a declined, withdrawn or expired offer | That lender goes back to `UNDER_REVIEW` and can make a new offer | `lib/workflow.ts` |
| Offers | One live offer per lender per application, valid for 30 days | `lib/workflow.ts` |
| Lender access | The beneficiary picks lenders and gives consent when applying | `pages/beneficiary/ApplyForLoan.tsx` |
| Applying | The profile must be complete first (brief §4) | `pages/beneficiary/ApplyForLoan.tsx` |
| Documents | Income proof, bank statement, electricity bill, other. PDF, JPG or PNG up to 5 MB. All optional | `data/mockData.ts`, `lib/workflow.ts` |
| Passwords | At least 8 characters, with a letter and a number | `lib/authSchemas.ts` |

Added beyond the brief's data model: `consentGivenAt`, `applicantProfile` (occupation and location, the only profile fields lenders see), and the existing `features` and `expiresAt` on offers.
