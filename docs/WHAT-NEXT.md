# What Next: Taking SwitchPoint to Production

SwitchPoint works well as a hackathon MVP. The server controls randomisation, the public cannot read data, AI output is grounded and validated, the rate limits are shared across instances, CSV export is formula-safe and the analysis is tested. This document lists what has to change before real retailers and real shoppers use it at volume, in priority order.

Each item names the code it affects, so it can be turned into a ticket directly.

---

## P0: Before any real retailer or public launch

### 1. Replace the shared admin password with real accounts

**Today:** [src/server/auth.ts](../src/server/auth.ts) has a single `ADMIN_PASSWORD`. The session cookie is `HMAC(password, "switchpoint-admin")`, so it never changes.

**Problems:**
- Every session has the same token. Signing out deletes the cookie in that one browser, but a copied cookie stays valid until the password is rotated. The 12-hour `maxAge` only limits how long the browser keeps it; the server never checks it.
- Nothing shows who did what, so overrides, fulfilments and exports can't be traced to a person.
- Every retailer sees every experiment.

**Do:**
- Use Supabase Auth (email magic link or SSO) with a `retailer_users` table and `organisations` membership.
- Use per-session tokens with server-side expiry and revocation, so logging out actually ends the session.
- Add MFA for anyone who can export or mark fulfilments.
- Add an `audit_log` table (who, what, when, experiment) and write to it from override, reclassify, fulfil, export and insight.

### 2. Multi-tenancy

**Today:** Experiments live in code ([src/config/experiments/index.ts](../src/config/experiments/index.ts)) and every table is keyed only by `experiment_version`.

**Do:**
- Add an `organisation_id` column to `experiments`, `participants` and the tables that hang off them, and enforce it in every repository query.
- Add RLS policies scoped by organisation as defence in depth, even though the service role bypasses them today. Better still, move retailer reads to a user-scoped Supabase client so RLS really applies.
- Move experiment definitions into the `experiments` table, keeping the immutability rule (a new version on any change) and the `config_hash` check.

### 3. Security headers and CSP

**Today:** [next.config.ts](../next.config.ts) is empty, so there's no CSP, HSTS, `X-Frame-Options` or `Referrer-Policy`.

**Do:**
- Add `headers()` with a strict CSP that allows `self` plus the Supabase origin for realtime websockets, and blocks framing.
- Use `Referrer-Policy: same-origin`, so the participant URL doesn't leak to third parties.
- Turn on HSTS for the production domain.

### 4. Lock down the realtime channel

**Today:** `switchpoint-results` ([src/contracts/realtime.ts](../src/contracts/realtime.ts)) is a public broadcast channel, and the anon key ships to the browser.

**Problems:**
- Anyone can subscribe and watch how often responses arrive.
- Anyone can send fake broadcasts that make every open dashboard refetch, which costs database reads.

**Do:**
- Switch to private Realtime channels with Realtime Authorization: an RLS policy on `realtime.messages` that only allows signed-in retailer users, one channel per organisation or experiment.
- Remove the anon key from the page entirely if possible.

### 5. Secrets hygiene

- Rate-limit keys are an HMAC keyed with `SUPABASE_SERVICE_ROLE_KEY` ([src/server/rateLimit.ts](../src/server/rateLimit.ts)). Give them their own `RATE_LIMIT_SECRET`, so rotating the database key doesn't affect them and one secret isn't doing two jobs.
- Write down a rotation runbook for each secret: Supabase service key, Groq key and admin credentials.
- Check required environment variables once at boot (a Zod env schema) instead of failing on first use.

### 6. Privacy and compliance (UK/EU shoppers)

- Write a privacy notice and a data retention policy. Decide how long raw responses and free-text reasons are kept, and add a scheduled job that deletes or anonymises data older than that.
- Free text can contain personal data that people type in, such as names or emails. Remove obvious PII before storing it or sending it to Groq, and record Groq as a sub-processor. Check Groq's data retention terms.
- Add a data deletion path: a participant can quote their claim code to have their responses removed.
- Re-check the consent copy with a lawyer once real rewards are involved. A prize draw has its own rules in some jurisdictions.

### 7. Reward fulfilment integrity

**Today:** The claim code is the first 6 hex characters of the participant UUID ([src/domain/experiment/fulfilment.ts](../src/domain/experiment/fulfilment.ts)). That's about 16.7 million values, so collisions become likely at large volume. Anyone who knows or guesses a code can claim the reward.

**Do:**
- Generate a separate random claim code with a uniqueness constraint.
- Verify the claimant (for example a one-time code shown only on the finish screen) and record who fulfilled it.

---

## P1: Scale

### 8. Stop recomputing the whole analysis on every refresh

This is the biggest scaling problem.

**Today:** Every dashboard load does the full analysis from scratch ([src/application/retailer/getDashboard.ts](../src/application/retailer/getDashboard.ts) → [loadAnalysis.ts](../src/application/retailer/loadAnalysis.ts)):
- It reads **every** choice and stated reason for the version, in 500-row pages.
- It then runs bootstrap intervals with 2,000 resamples per condition.

**What triggers it:** Each open tab does this every 15 seconds, plus once after every broadcast. Each participant triggers about ten broadcasts (start, each choice, the reason and completion).

**At 10,000 participants:** That's roughly 70,000+ choice rows, about 140 sequential page reads, then the bootstrap, per refresh, per tab.

**Do, in order:**
1. **Debounce and coalesce:** cache the computed `DashboardData` per version for a few seconds, so many tabs and broadcasts share one computation.
2. **Aggregate in Postgres:** compute switch counts per condition and baseline counts with SQL views or RPCs, and fetch only the per-participant data the switch-point and say-vs-do analysis needs.
3. **Materialise:** keep a `results_snapshot` table that a background job updates after writes (or every N seconds). The dashboard then reads one row.
4. **Run the bootstrap off the request path:** compute confidence intervals in the snapshot job, not per request.

### 9. Database indexes and query plans

- Add indexes for the queries the repositories actually run:
  - `participants(experiment_version, completed_at)`
  - `stated_reasons(experiment_version, ai_status)`
  - `fulfilments(status)`
  - `choices(experiment_version, id)` for keyset pagination
- Run `EXPLAIN ANALYZE` on the dashboard and export queries with seeded data at 10 times the expected volume. [scripts/seed-synthetic-demo.mjs](../scripts/seed-synthetic-demo.mjs) is a good starting point.
- Use Supabase's connection pooler (Supavisor, transaction mode) for serverless traffic.

### 10. Rate limiting at the edge

**Today:** Every participant request makes a Postgres round trip to `hit_rate_limit`, and that function also runs a `DELETE` of expired rows on every call ([0003](../supabase/migrations/0003_server_only_response_writes.sql)).

**Do:**
- Move rate limiting to the edge (Vercel Firewall/WAF rules or Upstash Redis), so abusive traffic never reaches the function or the database.
- If it stays in Postgres, move the cleanup into a `pg_cron` job.
- Add bot protection (Vercel BotID or Turnstile) to `/api/participants`, because each participant is a potential reward entry.

### 11. Move AI work to a queue

**Today:** Reason classification runs in `after()` inside the request's function. When Groq is slow or rate-limited, work is stuck until someone clicks reclassify.

**Do:**
- Use a durable job queue (Supabase Queues/pgmq, Inngest or Vercel Queues) with retries, backoff and a dead-letter state.
- Set a concurrency cap and a daily spend cap per organisation.
- Track AI cost per classification and per insight.

### 12. Export at volume

CSV export builds the whole file in memory. Stream it (a `ReadableStream` over keyset pages), or generate it in the background to storage and return a signed URL.

---

## P1: Operating it

### 13. Observability

- Send structured logs instead of `console.error` (e.g. Axiom, Better Stack or Datadog) with a request ID.
- Add error tracking (Sentry) for both the server and the participant flow.
- Add uptime checks on `/experiment` and a health endpoint that checks the database.
- Alert on 5xx rate, participant drop-off per step, AI failure rate and stuck `pending` classifications.

### 14. CI/CD

There's no `.github/` today. Add a pipeline that runs `npm run lint`, `npm test` and `next build` on every PR. Also:
- dependency and secret scanning (Dependabot, `gitleaks`)
- Playwright end-to-end tests for the full participant flow and the retailer login → dashboard path
- preview deployments with their own Supabase branch database

### 15. Migrations and environments

- Manage migrations with the Supabase CLI (`supabase db push`) from CI, not by pasting into the SQL editor.
- Keep separate dev, staging and production projects.
- Turn on point-in-time recovery and test a restore.

---

## P2: Product, once the basics hold

- **Experiment builder:** retailers create and version experiments in the UI, not in code.
- **Stopping rules / power:** show when a condition has enough participants for a decision, not just the "directional" flag below 30.
- **Participant quality:** detect speeders, straight-liners and duplicate devices, and exclude them from analysis with a visible count.
- **Accessibility audit:** WCAG 2.2 AA pass on the participant flow, which is the public surface.
- **Internationalisation:** currency and locale in the experiment config. Prices are formatted for one market today.

---

## Suggested order

| Phase | Items | Outcome |
|---|---|---|
| 1. Safe to pilot with one retailer | 1, 3, 4, 5, 7, 13, 14 | Real accounts, locked-down channels, visibility into failures |
| 2. Safe for several retailers | 2, 6, 15 | Tenant isolation, compliance, repeatable deploys |
| 3. Ready for volume | 8, 9, 10, 11, 12 | Dashboard cost stays flat as participants grow |
| 4. Product depth | P2 | Retailers self-serve experiments |

Record each significant choice above (auth provider, tenancy model, queue) as a new decision in [docs/decisions/](decisions/README.md).
