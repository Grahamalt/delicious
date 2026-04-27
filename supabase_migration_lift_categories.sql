-- Add category column to exercises
-- Run in Supabase SQL Editor.

alter table exercises
  add column if not exists category text not null default 'push'
  check (category in ('push', 'pull', 'legs', 'upper', 'delts'));

create index if not exists idx_exercises_category on exercises (category);
