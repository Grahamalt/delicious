-- Lifts tracking: exercises + sets
-- Run this in the Supabase SQL Editor.

create table if not exists exercises (
  id bigint generated always as identity primary key,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_exercises_name on exercises (name);

create table if not exists exercise_sets (
  id bigint generated always as identity primary key,
  exercise_id bigint not null references exercises(id) on delete cascade,
  date date not null,
  weight numeric(6,2) not null,
  reps integer not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_exercise_sets_exercise_id on exercise_sets (exercise_id);
create index if not exists idx_exercise_sets_date on exercise_sets (date desc);

alter table exercises enable row level security;
alter table exercise_sets enable row level security;

create policy "Service role full access" on exercises for all using (true) with check (true);
create policy "Service role full access" on exercise_sets for all using (true) with check (true);
