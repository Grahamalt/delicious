-- Body tracking: one body scan per date (single-user app).
-- Safe to re-run. Migrates existing `progress` rows in a second pass.

create extension if not exists "uuid-ossp";

-- 1. Table (weight and waist are nullable so partial daily logs work)
create table if not exists body_scans (
  id                   uuid primary key default uuid_generate_v4(),
  date                 date not null unique,
  weight_lbs           float,
  waist_cm             float,
  shoulder_cm          float,
  photo_front_url      text,
  photo_side_left_url  text,
  photo_side_right_url text,
  photo_back_url       text,
  notes                text,
  created_at           timestamptz not null default now()
);

-- If the table was previously created with NOT NULL, relax it.
alter table body_scans alter column weight_lbs drop not null;
alter table body_scans alter column waist_cm   drop not null;

create index if not exists idx_body_scans_date on body_scans (date desc);

alter table body_scans enable row level security;
drop policy if exists "Service role full access" on body_scans;
create policy "Service role full access" on body_scans for all using (true) with check (true);

-- 2. One-time data migration from the legacy `progress` table (if it exists).
-- Handles mixed date formats: existing rows store "M/D/YYYY" (US) as text.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'progress') then

    with parsed as (
      select
        -- Accept either a real date column, or text in ISO 'YYYY-MM-DD' / US 'M/D/YYYY'
        case
          when date::text ~ '^\d{4}-\d{2}-\d{2}$' then date::text::date
          when date::text ~ '^\d{1,2}/\d{1,2}/\d{4}$' then to_date(date::text, 'FM MM/FM DD/YYYY')
          else null
        end                               as iso_date,
        nullif(weight::text, '')::float   as weight,
        nullif(photo, '')                 as photo,
        nullif(note, '')                  as note,
        created_at
      from progress
    ),
    valid as (
      select * from parsed where iso_date is not null
    ),
    aggregated as (
      select
        iso_date as date,
        -- Latest non-null weight wins
        (array_agg(weight order by created_at desc) filter (where weight is not null))[1] as weight_lbs,
        -- First photo of the day becomes the front-angle photo
        (array_agg(photo order by created_at asc) filter (where photo is not null))[1] as photo_front_url,
        -- Concat notes oldest→newest
        nullif(string_agg(note, ' · ' order by created_at asc) filter (where note is not null), '') as notes,
        min(created_at) as created_at
      from valid
      group by iso_date
    )
    insert into body_scans (date, weight_lbs, photo_front_url, notes, created_at)
    select date, weight_lbs, photo_front_url, notes, created_at
    from aggregated
    on conflict (date) do update set
      weight_lbs      = coalesce(body_scans.weight_lbs,      excluded.weight_lbs),
      photo_front_url = coalesce(body_scans.photo_front_url, excluded.photo_front_url),
      notes           = coalesce(body_scans.notes,           excluded.notes);

  end if;
end $$;
