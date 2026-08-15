-- ==========================================
-- QUIZLET CLONE DATABASE SCHEMA & RLS
-- Run this script in Supabase SQL Editor
-- ==========================================

-- 1. PROFILES TABLE (Linked with Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. SETS TABLE (Flashcard sets)
create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. CARDS TABLE (Terms and definitions)
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid references public.sets(id) on delete cascade not null,
  term text not null,
  definition text not null,
  position int default 0,
  image_url text,
  created_at timestamptz default now()
);

-- 4. STUDY PROGRESS TABLE (Track learning progress per user per card)
create table if not exists public.study_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  card_id uuid references public.cards(id) on delete cascade not null,
  status text default 'new', -- 'new' | 'learning' | 'mastered'
  incorrect_count int default 0,
  correct_count int default 0,
  last_reviewed timestamptz default now(),
  constraint unique_user_card unique (user_id, card_id)
);

-- 5. AUTOMATIC PROFILE CREATION TRIGGER
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 5)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.sets enable row level security;
alter table public.cards enable row level security;
alter table public.study_progress enable row level security;

-- PROFILES POLICIES
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- SETS POLICIES
create policy "Public sets and owner sets are viewable"
  on public.sets for select
  using (is_public = true or auth.uid() = owner_id);

create policy "Users can create their own sets"
  on public.sets for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own sets"
  on public.sets for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own sets"
  on public.sets for delete
  using (auth.uid() = owner_id);

-- CARDS POLICIES
create policy "Cards are viewable if set is viewable"
  on public.cards for select
  using (
    exists (
      select 1 from public.sets
      where sets.id = cards.set_id
      and (sets.is_public = true or sets.owner_id = auth.uid())
    )
  );

create policy "Set owners can insert cards"
  on public.cards for insert
  with check (
    exists (
      select 1 from public.sets
      where sets.id = cards.set_id
      and sets.owner_id = auth.uid()
    )
  );

create policy "Set owners can update cards"
  on public.cards for update
  using (
    exists (
      select 1 from public.sets
      where sets.id = cards.set_id
      and sets.owner_id = auth.uid()
    )
  );

create policy "Set owners can delete cards"
  on public.cards for delete
  using (
    exists (
      select 1 from public.sets
      where sets.id = cards.set_id
      and sets.owner_id = auth.uid()
    )
  );

-- STUDY PROGRESS POLICIES
create policy "Users can view their own progress"
  on public.study_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert their own progress"
  on public.study_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own progress"
  on public.study_progress for update
  using (auth.uid() = user_id);

create policy "Users can delete their own progress"
  on public.study_progress for delete
  using (auth.uid() = user_id);

-- ==========================================
-- SAMPLE DATA (Optional for testing)
-- ==========================================
-- Insert a public welcome set if needed later
