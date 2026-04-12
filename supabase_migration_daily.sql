-- Migration: per-meal logging -> daily summary logging
-- Run this in the Supabase SQL Editor.
-- Safe to run once. Preserves all old data by archiving the meals table.

-- 1. New daily_entries table: one row per date
create table if not exists daily_entries (
  id bigint generated always as identity primary key,
  date date not null unique,
  calories integer not null default 0,
  fat integer not null default 0,
  carbs integer not null default 0,
  protein integer not null default 0,
  description text not null default '',
  source text not null default 'manual',  -- 'manual' | 'llm' | 'edit' | 'migrated'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_daily_entries_date on daily_entries (date desc);

-- Auto-update updated_at on row changes
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_daily_entries_updated_at on daily_entries;
create trigger trg_daily_entries_updated_at
  before update on daily_entries
  for each row execute function set_updated_at();

-- 2. Aggregate existing meals into daily_entries
-- Sums macros per date, joins descriptions with '; ', marks source as 'migrated'
insert into daily_entries (date, calories, fat, carbs, protein, description, source)
select
  date,
  sum(calories)::int   as calories,
  sum(fat)::int        as fat,
  sum(carbs)::int      as carbs,
  sum(protein)::int    as protein,
  string_agg(description, '; ' order by created_at) as description,
  'migrated' as source
from meals
group by date
on conflict (date) do nothing;

-- 3. Archive the old meals table (keep, do not drop)
alter table if exists meals rename to meals_archive;
alter index if exists idx_meals_date rename to idx_meals_archive_date;
alter index if exists idx_meals_description rename to idx_meals_archive_description;

-- 4. RLS for the new table (matches existing pattern)
alter table daily_entries enable row level security;
create policy "Service role full access" on daily_entries for all using (true) with check (true);
