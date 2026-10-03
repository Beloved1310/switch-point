# SwitchPoint

SwitchPoint runs controlled A/B product-choice experiments to measure what actually makes shoppers switch products, compares that with what they say would make them switch, and shows retailers the results on a live dashboard.

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend and backend | Next.js (App Router, TypeScript) | API routes or server actions serve as the backend. |
| Styling | Tailwind CSS | |
| Database | Supabase (Postgres) | Shared storage, server-validated writes, row-level security, realtime subscriptions for the live dashboard. |
| AI | Groq API via the official TypeScript SDK | Structured outputs (JSON schema) for reason classification and the next-experiment suggestion. |
| Validation | Zod | Validates requests and AI output shape. A separate check rejects any number not present in the evidence packet. |
| Analysis | Plain TypeScript module | Switch rates, switch points, say-do gaps and bootstrap intervals, tested with Vitest. |
| Charts | Recharts or hand-written SVG | SVG gives full control, as in the prototype. |
| Hosting | Vercel | Groq API key and Supabase service key held as server-side environment variables. |
| QR code | `qrcode` npm package or any free generator | Links participants to the mobile experiment. |

### How the stack maps to the requirements

| Requirement | Implemented by |
|---|---|
| FR1, FR8, FR9, NFR4 | API routes assign anonymous IDs and randomise scenario order, product position and say-first/do-first. |
| FR10, NFR5, NFR6, NFR7 | Supabase tables store each choice with experiment version, scenario, condition, positions and timestamp. |
| FR11, FR20, NFR14 | Groq structured outputs, validated with Zod before storage or display. |
| FR21, NFR13 | Evidence-packet number check rejects AI numbers not found in the packet. |
| FR13–FR16, NFR19 | Analysis module, unit-tested with Vitest against known inputs. |
| FR17, FR18, NFR11 | Dashboard reads aggregates and subscribes to Supabase realtime. |
| NFR2 | Groq and Supabase service keys used only in server code on Vercel. |
| NFR3 | Participant writes pass through validated server routes; direct public table writes are revoked. Results and admin routes require auth. |
| NFR8, NFR20 | Responses are written before any AI call; AI failures are caught and the dashboard falls back to deterministic results. |
| NFR9 | Mobile-first Tailwind UI reached via QR code. |

## Environment Variables

| Variable | Scope |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public; used by the dashboard's realtime subscription only |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `GROQ_API_KEY` | Server only. Optional: without it, AI steps are skipped and everything else works. |
| `GROQ_MODEL` | Server only. Defaults to `openai/gpt-oss-20b` (supports strict JSON schema). |
| `ADMIN_PASSWORD` | Server only. Protects the dashboard, overrides, insights and export. |
| `NEXT_PUBLIC_APP_URL` | Base URL encoded in the QR code. Falls back to the request host. |

## Getting Started

1. Create a Supabase project and run each file in [supabase/migrations/](supabase/migrations/) in order in the SQL editor: [0001_init.sql](supabase/migrations/0001_init.sql), [0002_rate_limits.sql](supabase/migrations/0002_rate_limits.sql), then [0003_server_only_response_writes.sql](supabase/migrations/0003_server_only_response_writes.sql).
2. Copy `.env.example` to `.env.local` and fill in the values.
3. Install and run:

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # analysis, randomisation and AI grounding tests
npm run build
```

4. Participants open `/experiment` (or scan the QR code on the dashboard). Retailers sign in at `/admin/login` and use `/dashboard`.

To deploy, import the repo into Vercel and set the same environment variables there.

## How It Works

**Participant flow.** Consent → baseline choice (identical products) → stated reason and price threshold → seven controlled choices, or the choices first and the reason after (randomised) → completion and, if enabled, a random draw of one round to honour. A refresh in the same browser tab restores the next unanswered step from server-side responses.

**Experiment design.** [src/config/experiments/coffee-v1.ts](src/config/experiments/coffee-v1.ts) defines the products and scenarios, while [src/domain/experiment/plan.ts](src/domain/experiment/plan.ts) builds each participant's randomized plan. Each scenario changes only the alternative product, which is the one the participant did not pick at baseline. The current set covers four price discounts, a promotion, a trust badge and one price + promotion combination. If the config changes under an existing version, the server refuses to run. Bump `version` to start a new experiment.

**Randomisation.** The server creates each participant's plan with a cryptographic RNG: scenario order, which side the baseline product appears on, and say-first or do-first. The browser sends only `left` or `right`. The server works out the product, price and position from the stored plan and records them.

**Storage and security.** Participant starts, choices and stated reasons are validated by server routes and written with the service role from server-only code. Migration `0003` revokes direct inserts through the public anon key; that key is used only for the dashboard's realtime subscription. Reads, AI updates and admin actions also stay server-side. Unique constraints make repeated submissions safe to retry. Rate limits store keyed HMACs of client identifiers, not raw IP addresses; inactive records older than one hour are cleared on later rate-limited requests.

**Analysis.** [src/domain/analysis/analyze.ts](src/domain/analysis/analyze.ts) is pure TypeScript with no UI or AI dependencies. It calculates:
- switch rate per condition, with 95% percentile bootstrap intervals
- each participant's price switch point, which is the smallest tested discount at which they switched
- say vs do: the stated threshold compared with the observed switch point, and the stated reason category compared with the levers the participant actually switched on
- a left/right position-bias check

Any result based on fewer than 30 participants is marked directional.

**AI.** Classification runs after the response is stored, using Next.js `after()`, so a slow or failed call never blocks a participant. The next-experiment suggestion runs only when the retailer clicks the button. It sees only the evidence packet ([src/domain/insight/evidence.ts](src/domain/insight/evidence.ts)). Its output is validated with Zod, and the text is suppressed if it quotes any number that isn't in that packet ([src/domain/insight/grounding.ts](src/domain/insight/grounding.ts)).

**Live dashboard.** Each write sends a data-free Supabase Realtime broadcast. The dashboard then refetches from the authenticated results API. It also polls every 15 seconds in case a broadcast is missed. The dashboard labels measured results and AI output separately.

## Project Structure

```
src/
  app/
    experiment/        participant flow (mobile-first)
    dashboard/         retailer dashboard (admin only)
    admin/login/       admin sign-in
    api/               participants, choices, stated, complete, results, admin/*
  components/          ExperimentFlow, DashboardClient, ProductCard, SVG charts
  config/experiments/  versioned experiment definitions
  domain/              experiment plans, analysis, insight grounding
  application/         participant and retailer use cases
  infrastructure/      Supabase, Groq and realtime adapters
  server/              auth, API helpers, rate limits and dependency setup
supabase/migrations/   schema and RLS policies
```

---

## Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR1 | The system must display a consent statement before the experiment begins and assign each consenting participant a random anonymous ID. | Must |
| FR2 | The system must explain that participants will make real product choices and, where enabled, that one eligible choice may be honoured with the selected product. | Must |
| FR3 | The system must record the participant's baseline preference by presenting two products under equivalent conditions before introducing any intervention. | Must |
| FR4 | The system must allow participants to explain in their own words what would make them switch from their preferred product to the alternative. | Must |
| FR5 | The system must ask participants what price difference they believe would make them switch. | Must |
| FR6 | The system must present a predefined set of controlled A/B product choices testing behavioural levers including price, promotion and trust. | Must |
| FR7 | Each experimental scenario must change only the variable or combination explicitly defined by the experiment design while keeping other relevant attributes constant. | Must |
| FR8 | The system must randomise scenario order and left/right product position for each participant. | Must |
| FR9 | The system should randomly assign participants to provide their stated switching reason either before or after completing the product choices. | Should |
| FR10 | The system must record each choice together with the anonymous participant ID, experiment version, scenario, tested condition, product positions and timestamp. | Must |
| FR11 | AI must classify each participant's free-text switching reason into a predefined behavioural lever category while preserving the original response. | Must |
| FR12 | An administrator should be able to review and override an AI-assigned behavioural category without modifying the participant's original response. | Should |
| FR13 | For price experiments, the system must calculate the participant's observed price switch point as the smallest tested price difference at which they switch from their baseline preference, where a switch occurs. | Must |
| FR14 | For non-price interventions such as promotion and trust, the system must record whether the intervention resulted in switching from the participant's baseline choice. | Must |
| FR15 | The system must calculate aggregate switch rates for each tested condition and display the number of participants contributing to each result. | Must |
| FR16 | The system must compare stated switching reasons and stated price thresholds with observed behaviour to identify the say-do gap at participant and aggregate level. | Must |
| FR17 | The retailer dashboard must display baseline preferences, stated drivers, observed switch rates, price switch points, say-do gaps and sample sizes. | Must |
| FR18 | The retailer dashboard must update as new experiment responses are received. | Must |
| FR19 | The dashboard must identify small-sample findings as early or directional evidence rather than statistically established conclusions. | Must |
| FR20 | AI should propose one next experiment using only a structured evidence packet generated from the collected experiment results. | Should |
| FR21 | The system must reject or suppress AI-generated numerical claims that are not present in the supplied evidence packet. | Must |
| FR22 | The dashboard must clearly distinguish measured experimental results from AI-generated interpretation and suggestions. | Must |
| FR23 | Where the real-product mechanism is enabled, the system should select an eligible participant choice according to the predefined fulfilment rule and record whether the product was fulfilled. | Should |
| FR24 | An administrator should be able to export anonymised experiment responses for further analysis. | Could |

---

## Non-Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR1 | **Privacy:** The system must not require names or email addresses. Participants are represented by random IDs. A keyed, short-lived network identifier is used separately for abuse prevention and is not attached to responses. | Must |
| NFR2 | **Security:** API keys, database credentials and AI credentials must remain server-side and must never be exposed to the browser. | Must |
| NFR3 | **Access Control:** Public participants must only be able to submit experiment responses. Access to retailer results and administrative functionality must be restricted. | Must |
| NFR4 | **Experimental Integrity:** Scenario ordering, product positioning and say-first/do-first assignment must be randomised by the server. | Must |
| NFR5 | **Reproducibility:** The experiment configuration must be versioned, and every response must record the experiment version under which it was collected. | Must |
| NFR6 | **Experiment Consistency:** Once live data collection begins, changes to experimental scenarios or conditions must create a new experiment version rather than silently changing the existing experiment. | Must |
| NFR7 | **Data Integrity:** Each response must retain the scenario presented, intervention values, product positions and resulting choice so the analysis can be reproduced. | Must |
| NFR8 | **Reliability:** Participant responses must be stored before optional AI processing occurs. Failure of the AI service must not prevent completion of the experiment. | Must |
| NFR9 | **Usability:** The participant experiment must work on mobile devices accessed through a QR code and should be completable within approximately three minutes. | Must |
| NFR10 | **Accessibility:** The interface should support keyboard navigation, readable contrast, clear labels and accessible descriptions of product information. | Should |
| NFR11 | **Performance:** Moving between experiment scenarios should feel immediate under expected hackathon traffic, and new results should appear on the retailer dashboard within a few seconds. | Should |
| NFR12 | **Abuse Protection:** The system should prevent accidental duplicate submissions and apply reasonable rate limiting to reduce spam or repeated experiment submissions. | Should |
| NFR13 | **AI Grounding:** AI must receive only the evidence required for its task and must not be used as the source of measured switching results or statistical calculations. | Must |
| NFR14 | **AI Validation:** Structured AI responses must be validated before being stored or displayed. Invalid responses must fail safely without affecting collected experiment data. | Must |
| NFR15 | **Transparency:** The application and README must clearly distinguish observed behaviour, calculated metrics and AI-generated interpretation. | Must |
| NFR16 | **Statistical Transparency:** Aggregate results must display their sample size, and small-sample findings must be described as directional rather than representative of a wider population. | Must |
| NFR17 | **Cost:** AI calls should be bounded. Free-text classification should occur at most once per response, and AI insight generation should occur only when requested rather than for every product choice. | Should |
| NFR18 | **Scalability:** The data model should support additional experiments, categories, products and behavioural interventions without fundamental schema changes. | Should |
| NFR19 | **Maintainability:** Experimental analysis and switch-point calculations should be separated from UI and AI logic and tested using known inputs and expected outputs. | Should |
| NFR20 | **Graceful Degradation:** If the AI provider is unavailable or its free-tier quota is exhausted, participants must still be able to complete the experiment and the retailer must still be able to view deterministic experimental results. | Must |

---

## MVP Critical Path

The hackathon MVP should prioritise the following flow:

**Consent → Baseline Choice → Stated Reason → Controlled Choices → Store Results → Calculate Switching → Compare Say vs Do → Retailer Dashboard**

AI is an additional interpretation layer:

**Free-text Reason → AI Classification**

**Experimental Evidence → AI → Suggested Next Experiment**

The core experimental results must not depend on AI.

> **Code calculates what happened. AI helps interpret what happened.**
