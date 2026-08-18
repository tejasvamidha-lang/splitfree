 -- SplitFree Supabase schema + RLS
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null unique,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  unique (group_id, user_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  paid_by uuid not null references public.profiles(id) on delete restrict,
  category text not null check (category in ('Food', 'Travel', 'Utilities', 'Groceries', 'General')),
  is_settlement boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_owed numeric(12, 2) not null check (amount_owed >= 0),
  unique (expense_id, user_id)
);

create index if not exists idx_groups_created_by on public.groups(created_by);
create index if not exists idx_group_members_group_id on public.group_members(group_id);
create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_expenses_group_id on public.expenses(group_id);
create index if not exists idx_expenses_paid_by on public.expenses(paid_by);
create index if not exists idx_expenses_created_at on public.expenses(created_at desc);
create index if not exists idx_expense_splits_expense_id on public.expense_splits(expense_id);
create index if not exists idx_expense_splits_user_id on public.expense_splits(user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "groups_select_if_member"
on public.groups
for select
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = groups.id
      and gm.user_id = auth.uid()
  )
);

create policy "groups_insert_if_creator"
on public.groups
for insert
with check (created_by = auth.uid());

create policy "groups_update_if_creator"
on public.groups
for update
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "groups_delete_if_creator"
on public.groups
for delete
using (created_by = auth.uid());

create policy "group_members_select_if_same_group"
on public.group_members
for select
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
  )
);

create policy "group_members_insert_if_group_exists"
on public.group_members
for insert
with check (
  exists (
    select 1 from public.groups g where g.id = group_id
  )
);

create policy "group_members_delete_self_or_creator"
on public.group_members
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.groups g
    where g.id = group_id
      and g.created_by = auth.uid()
  )
);

create policy "expenses_select_if_member"
on public.expenses
for select
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = expenses.group_id
      and gm.user_id = auth.uid()
  )
);

create policy "expenses_insert_if_member"
on public.expenses
for insert
with check (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = expenses.group_id
      and gm.user_id = auth.uid()
  )
);

create policy "expenses_update_if_member"
on public.expenses
for update
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = expenses.group_id
      and gm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = expenses.group_id
      and gm.user_id = auth.uid()
  )
);

create policy "expenses_delete_if_member"
on public.expenses
for delete
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = expenses.group_id
      and gm.user_id = auth.uid()
  )
);

create policy "splits_select_if_member"
on public.expense_splits
for select
using (
  exists (
    select 1
    from public.expenses e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = expense_splits.expense_id
      and gm.user_id = auth.uid()
  )
);

create policy "splits_insert_if_member"
on public.expense_splits
for insert
with check (
  exists (
    select 1
    from public.expenses e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = expense_id
      and gm.user_id = auth.uid()
  )
);

create policy "splits_update_if_member"
on public.expense_splits
for update
using (
  exists (
    select 1
    from public.expenses e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = expense_splits.expense_id
      and gm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.expenses e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = expense_id
      and gm.user_id = auth.uid()
  )
);

create policy "splits_delete_if_member"
on public.expense_splits
for delete
using (
  exists (
    select 1
    from public.expenses e
    join public.group_members gm on gm.group_id = e.group_id
    where e.id = expense_splits.expense_id
      and gm.user_id = auth.uid()
  )
);
