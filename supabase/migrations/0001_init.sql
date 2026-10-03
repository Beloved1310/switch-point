-- SwitchPoint schema.
-- Public (anon) role: INSERT only on response tables, never SELECT/UPDATE/DELETE (NFR3).
-- Reads, AI updates and admin actions use the service role on the server only (NFR2).

create extension if not exists pgcrypto;

-- Versioned experiment definitions (NFR5, NFR6)
create table experiments (
  version      text primary key,
  config       jsonb not null,
  config_hash  text not null,
  created_at   timestamptz not null default now()
);

create table participants (
  id                  uuid primary key,
  experiment_version  text not null references experiments(version),
  say_first           boolean not null,
  plan                jsonb not null,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create table choices (
  id                  bigint generated always as identity primary key,
  participant_id      uuid not null references participants(id) on delete cascade,
  experiment_version  text not null references experiments(version),
  scenario_id         text not null,
  levers              text[] not null default '{}',
  condition           jsonb,
  left_product        text not null check (left_product in ('A', 'B')),
  right_product       text not null check (right_product in ('A', 'B')),
  left_view           jsonb not null,
  right_view          jsonb not null,
  chosen_side         text not null check (chosen_side in ('left', 'right')),
  chosen_product      text not null check (chosen_product in ('A', 'B')),
  baseline_product    text check (baseline_product in ('A', 'B')),
  switched            boolean,
  created_at          timestamptz not null default now(),
  unique (participant_id, scenario_id)
);
create index choices_version_idx on choices (experiment_version);

create table stated_reasons (
  participant_id          uuid primary key references participants(id) on delete cascade,
  experiment_version      text not null references experiments(version),
  phase                   text not null check (phase in ('before', 'after')),
  reason_text             text not null check (char_length(reason_text) between 1 and 500),
  stated_price_threshold  numeric(6, 2) check (stated_price_threshold between 0 and 100),
  ai_status               text not null default 'pending'
                            check (ai_status in ('pending', 'done', 'failed', 'skipped')),
  ai_category             text,
  ai_confidence           text,
  ai_model                text,
  override_category       text,
  override_at             timestamptz,
  created_at              timestamptz not null default now()
);

create table fulfilments (
  participant_id  uuid primary key references participants(id) on delete cascade,
  choice_id       bigint not null references choices(id),
  product         text not null check (product in ('A', 'B')),
  status          text not null default 'pending' check (status in ('pending', 'fulfilled')),
  created_at      timestamptz not null default now(),
  fulfilled_at    timestamptz
);

create table insights (
  id                  bigint generated always as identity primary key,
  experiment_version  text not null references experiments(version),
  evidence            jsonb not null,
  suggestion          jsonb,
  status              text not null check (status in ('accepted', 'rejected', 'failed')),
  detail              text,
  model               text,
  created_at          timestamptz not null default now()
);

-- Row-level security
alter table experiments    enable row level security;
alter table participants   enable row level security;
alter table choices        enable row level security;
alter table stated_reasons enable row level security;
alter table fulfilments    enable row level security;
alter table insights       enable row level security;

-- Lets insert policies check a participant exists without granting SELECT.
create function participant_exists(pid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from participants where id = pid);
$$;
revoke all on function participant_exists(uuid) from public;
grant execute on function participant_exists(uuid) to anon;

create policy "public insert participants" on participants
  for insert to anon
  with check (completed_at is null);

create policy "public insert choices" on choices
  for insert to anon
  with check (participant_exists(participant_id));

create policy "public insert stated reasons" on stated_reasons
  for insert to anon
  with check (
    participant_exists(participant_id)
    and ai_status = 'pending'
    and ai_category is null
    and override_category is null
  );

-- Defence in depth: the public role can only insert.
revoke select, update, delete on participants, choices, stated_reasons from anon;
revoke all on experiments, fulfilments, insights from anon;
