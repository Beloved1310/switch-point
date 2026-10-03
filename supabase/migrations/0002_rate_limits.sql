-- Shared fixed-window rate limit counters (NFR12).
-- Every serverless instance counts against the same row, so limits hold
-- across instances and regions. Service role only.

create table rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  hits          integer not null
);

alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

-- Count one hit for `p_key` and return the total in the current window.
-- The upsert is a single atomic statement, so concurrent requests cannot both
-- read a stale count.
create function hit_rate_limit(p_key text, p_window_seconds integer)
returns integer
language plpgsql volatile set search_path = public as $$
declare
  window_len interval := make_interval(secs => p_window_seconds);
  total integer;
begin
  insert into rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start <= now() - window_len then now() else r.window_start end,
    hits         = case when r.window_start <= now() - window_len then 1 else r.hits + 1 end
  returning hits into total;

  -- Occasionally drop counters that have been idle for an hour, so the table stays small.
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 hour';
  end if;

  return total;
end;
$$;

revoke all on function hit_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, integer) to service_role;
