# BeneScore frontend

Frontend for the **AI-Powered Digital Lending & Alternative Credit Scoring Platform**: a marketplace connecting beneficiaries (borrowers) with independent lenders. The project brief is [`project_master_brief.md`](../project_master_brief.md).

> **Academic prototype.** No real loans, credit checks or payments happen. All data is synthetic, and simulated features are labelled in the UI.

## Quick start

Requires Node 20.19 or newer. `npm test` needs Node 22.18 or newer.

```bash
npm install
npm run dev
```

Open the address Vite prints. This runs on demo data in your browser, so no backend is needed.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server on demo data, with no backend needed |
| `npm run dev:live` | Starts the dev server against the real backend |
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
│   ├── auth/          The mock and backend sign-in clients
│   └── app/           The mock and backend clients for applications, offers and documents
└── types/             Shared types, including the fixed contract from the brief
```

`lib/workflow.ts` is plain functions with no React. The backend enforces the same rules, and it's the one that counts in live mode.

## Running with the backend

Start the API first (see [`backend/README.md`](../backend/README.md)), then run:

```bash
npm run dev:live
```

This opens on <http://localhost:5175> and uses the real API and database, with the settings in `.env.live`. Demo accounts and the role switcher turn off, so sign in with a real account.

Screens only use two interfaces, `AuthService` (`src/types/auth.ts`) and `AppDataService` (`src/types/appService.ts`). Each has a mock and a backend client under `src/services/`, so no screen knows which one it's using. The wire format lives only in the two `http.ts` files.

## What is simulated

| Feature | In this build |
|---|---|
| Sign-in, demo mode only | Accounts live in this browser with salted password hashes. This is not secure, so don't use a real password. Password-reset email isn't sent; a labelled link appears on screen instead |
| Credit assessment | In demo mode, a rule-based points system. In live mode, a model trained on synthetic data and not validated on real borrowers, or the same rules if the ML service is down. Each result shows which. `model_confidence` is always shown as Unavailable |
| Document checks | File type and size only. Only the file's name is kept. In demo mode the file never leaves the browser; in live mode the backend also checks its contents, then discards it |
| Disbursement and repayments | The lender moves the steps by hand, and schedules are calculated. No money moves and no payments are recorded |

## Assumptions to confirm

The brief requires these outputs but doesn't define the rules, so the team should confirm them.

| Topic | Current rule | Where |
|---|---|---|
| Risk score from the model | 100 x sqrt(probability), which gives 28 for the brief's example of 0.08 | `ml-service/app/scoring.py` |
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
