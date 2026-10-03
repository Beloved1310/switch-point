# 0003. The public can write responses but never read them

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

Participants are anonymous strangers scanning a QR code. They must be able to submit responses, but must never read other people's data or alter results. The dashboard still needs to update live. Secrets (Supabase service key, Groq key) must never reach the browser.

## Decision

**Enforce insert-only access in the database, not just the API.**
[supabase/migrations/0001_init.sql](../../supabase/migrations/0001_init.sql) enables row-level security on every table. The `anon` role may only insert into `participants`, `choices` and `stated_reasons`. `select`, `update` and `delete` are revoked. A `security definer` function, `participant_exists()`, lets policies check a participant exists without granting reads. Inserts carrying a preset AI label or override are rejected. All reads and updates use the service role, in `server-only` code.

**Make the live dashboard data-free on the wire.**
After a write, the server sends a Supabase Realtime broadcast containing only an event kind and timestamp. The dashboard then refetches from the authenticated results API, and polls every 15 seconds in case a broadcast is missed.

**Keep admin access simple and server-side.**
Results, overrides, insights, fulfilment and export require an `sp_admin` cookie holding an HMAC of `ADMIN_PASSWORD`, compared in constant time ([auth.ts](../../src/server/auth.ts)).

**Make retries harmless.**
Unique constraints (one choice per participant per scenario, one stated reason per participant) turn duplicate submissions into no-ops. Every API route is rate limited per IP: first by an in-memory counter, then by a shared Postgres counter (`hit_rate_limit`, [0002_rate_limits.sql](../../supabase/migrations/0002_rate_limits.sql)) so the limit holds across serverless instances. If the shared counter is unreachable, the request is allowed and the in-memory limit still applies.

**Fail fast on a slow database.**
Every Supabase call has an 8-second timeout. A timeout returns 503 with a retryable message instead of hanging the request.

## Consequences

- A leaked anon key or a bug in an API route still cannot expose results.
- Nothing sensitive travels over the public realtime channel, and RLS never has to be loosened for live updates.
- Participants give no names or emails; they are random UUIDs.
- One shared admin password means no per-user audit trail. Named retailer accounts would need a real auth provider.
- Rate limiting adds one small database call per request. Failing open means a database outage disables the shared limit, but participants are never locked out by the limiter itself.
- Requests with no IP header share one bucket with a 20× higher limit, so a misconfigured proxy degrades to a global cap rather than blocking everyone.
