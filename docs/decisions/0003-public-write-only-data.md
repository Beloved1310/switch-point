# 0003. The public cannot access response tables

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

Participants are anonymous strangers scanning a QR code. They must be able to submit responses through the application, but must never read other people's data or bypass experiment validation. The dashboard still needs to update live. Secrets (Supabase service key, Groq key) must never reach the browser.

## Decision

**Validate and write responses only on the server.**
[supabase/migrations/0001_init.sql](../../supabase/migrations/0001_init.sql) enables row-level security on every table. Migration [0003](../../supabase/migrations/0003_server_only_response_writes.sql) removes the public insert policies and revokes direct inserts from `anon` and `authenticated`. API routes validate each action against the stored participant plan, then use the service role from `server-only` code. The public anon key is used only for the dashboard's realtime subscription. All reads and updates also use the service role on the server.

**Make the live dashboard data-free on the wire.**
After a write, the server sends a Supabase Realtime broadcast containing only an event kind and timestamp. The dashboard then refetches from the authenticated results API, and polls every 15 seconds in case a broadcast is missed.

**Keep admin access simple and server-side.**
Results, overrides, insights, fulfilment and export require an `sp_admin` cookie holding an HMAC of `ADMIN_PASSWORD`, compared in constant time ([auth.ts](../../src/server/auth.ts)).

**Make retries harmless and limit abuse without storing raw IP addresses.**
Unique constraints (one choice per participant per scenario, one stated reason per participant) turn duplicate submissions into no-ops. Every API route is rate limited per client identifier: first by an in-memory counter, then by a shared Postgres counter (`hit_rate_limit`, [0002_rate_limits.sql](../../supabase/migrations/0002_rate_limits.sql)). The identifier is a keyed HMAC of the bucket and client IP using the server-only service key. Migration 0003 clears earlier counters that stored raw identifiers. Inactive counters older than an hour are removed on later rate-limited requests. If the shared counter is unreachable, the request is allowed and the in-memory limit still applies.

**Fail fast on a slow database.**
Every Supabase call has an 8-second timeout. A timeout returns 503 with a retryable message instead of hanging the request.

## Consequences

- A leaked anon key cannot write or read response data; experiment validation is centralized in the API routes.
- Nothing sensitive travels over the public realtime channel, and RLS never has to be loosened for live updates.
- Participants give no names or emails; they are random UUIDs. A keyed network identifier is used separately for rate limiting and is not attached to responses.
- One shared admin password means no per-user audit trail. Named retailer accounts would need a real auth provider.
- Rate limiting adds one small database call per request. Failing open means a database outage disables the shared limit, but participants are never locked out by the limiter itself.
- Requests with no IP header share one bucket with a 20× higher limit, so a misconfigured proxy degrades to a global cap rather than blocking everyone.
