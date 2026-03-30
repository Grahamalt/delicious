-- Calorie Tracker: Google Sheets -> Supabase Migration
-- Run this in the Supabase SQL Editor (supabase.com -> your project -> SQL Editor)

-- Meals table: one row per meal, flat and queryable
create table meals (
  id bigint generated always as identity primary key,
  date date not null,
  description text not null,
  calories integer not null default 0,
  fat integer not null default 0,
  carbs integer not null default 0,
  protein integer not null default 0,
  created_at timestamptz not null default now()
);

-- Index for date range queries (most common access pattern)
create index idx_meals_date on meals (date desc);

-- Index for text search on meal descriptions
create index idx_meals_description on meals using gin (to_tsvector('english', description));

-- Goals table: single row with current macro goals
create table goals (
  id bigint generated always as identity primary key,
  calories integer not null default 2650,
  fat integer not null default 85,
  carbs integer not null default 230,
  protein integer not null default 180,
  updated_at timestamptz not null default now()
);

-- Insert default goals
insert into goals (calories, fat, carbs, protein) values (2650, 85, 230, 180);

-- Notes table: user's goals and notes (one per row)
create table notes (
  id bigint generated always as identity primary key,
  content text not null,
  created_at timestamptz not null default now()
);

-- Progress table: weight and photo tracking
create table progress (
  id bigint generated always as identity primary key,
  date date not null,
  time text not null,
  weight numeric(5,1),
  photo text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index idx_progress_date on progress (date desc);

-- Custom prompt table: stores the custom system prompt
create table custom_prompt (
  id bigint generated always as identity primary key,
  content text not null,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security (but allow all for service role key)
alter table meals enable row level security;
alter table goals enable row level security;
alter table notes enable row level security;
alter table progress enable row level security;
alter table custom_prompt enable row level security;

-- Policies: allow everything for service role (server-side only)
create policy "Service role full access" on meals for all using (true) with check (true);
create policy "Service role full access" on goals for all using (true) with check (true);
create policy "Service role full access" on notes for all using (true) with check (true);
create policy "Service role full access" on progress for all using (true) with check (true);
create policy "Service role full access" on custom_prompt for all using (true) with check (true);
