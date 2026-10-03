-- Route all participant-originated writes through validated server handlers.
-- The anon key remains usable for client-side Realtime subscriptions only.
drop policy if exists "public insert participants" on participants;
drop policy if exists "public insert choices" on choices;
drop policy if exists "public insert stated reasons" on stated_reasons;
revoke insert on participants, choices, stated_reasons from public, anon, authenticated;
drop function if exists participant_exists(uuid);

-- Rate-limit keys are now keyed HMAC digests, so discard existing rows that
-- contain the previous raw client-IP format.
delete from rate_limits;

-- Expire idle identifiers after an hour. The index keeps cleanup bounded as
-- the rate-limit table grows; cleanup runs on each rate-limited request.
create index if not exists rate_limits_window_start_idx on rate_limits(window_start);

create or replace function hit_rate_limit(p_key text, p_window_seconds integer)
returns integer
language plpgsql volatile set search_path = public as $$
declare
  window_len interval := make_interval(secs => p_window_seconds);
  total integer;
begin
  delete from rate_limits where window_start < now() - interval '1 hour';

  insert into rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start <= now() - window_len then now() else r.window_start end,
    hits         = case when r.window_start <= now() - window_len then 1 else r.hits + 1 end
  returning hits into total;
  return total;
end;
$$;

revoke all on function hit_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, integer) to service_role;
