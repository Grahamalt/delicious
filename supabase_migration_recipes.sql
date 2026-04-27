-- Recipes: name + ingredients with weights + per-ingredient macros
-- Run in Supabase SQL Editor.

create table if not exists recipes (
  id bigint generated always as identity primary key,
  name text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_recipes_name on recipes (name);

create table if not exists recipe_ingredients (
  id bigint generated always as identity primary key,
  recipe_id bigint not null references recipes(id) on delete cascade,
  name text not null,
  grams numeric(8,2) not null default 0,
  calories numeric(8,2) not null default 0,
  fat numeric(8,2) not null default 0,
  carbs numeric(8,2) not null default 0,
  protein numeric(8,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_recipe_ingredients_recipe_id on recipe_ingredients (recipe_id);

alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;

create policy "Service role full access" on recipes for all using (true) with check (true);
create policy "Service role full access" on recipe_ingredients for all using (true) with check (true);
