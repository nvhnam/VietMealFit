-- Row-Level Security policies (plan §4, §2.7).
-- Kept as a hand-written SQL file, separate from drizzle-kit's generated
-- migrations, since RLS is security-critical and not expressed in schema.ts.
-- Re-apply (via scripts/apply-migration-manual.mjs) after any relevant table
-- change. Idempotent: safe to re-run.
--
-- Access model:
--   - Catalog/reference tables (recipes, exercises, nutrition_items,
--     phase_food_recommendations): public read, writes only via service_role
--     (which bypasses RLS entirely — no write policy needed).
--   - User-owned data (profiles, meal_plans/items, exercise_plans/items):
--     owner-only, full CRUD.
--   - Community content (forum_threads/comments/likes/attachments,
--     library_resources): public read (D2: anonymous browsing), write
--     requires auth + ownership, admin role (D5) can moderate (update/delete
--     others' content).
--   - profiles itself is NOT publicly readable (contains age/weight/
--     allergies/calorie_goal — real personal health data). A narrow public
--     view exposes only (id, display_name) for author display elsewhere.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Narrow public view: only what other users need to render authorship.
-- Runs with the view owner's privileges (no security_invoker), so it can
-- return every row's id/display_name regardless of the owner-only RLS above.
drop view if exists public.profiles_public;
create view public.profiles_public as
  select id, display_name from public.profiles;
grant select on public.profiles_public to anon, authenticated;

-- Helper used by "admin bypass" policies below.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Catalog / reference tables: public read, writes via service_role only
-- ---------------------------------------------------------------------------
alter table public.recipes enable row level security;
drop policy if exists "recipes_select_all" on public.recipes;
create policy "recipes_select_all" on public.recipes for select using (true);

alter table public.exercises enable row level security;
drop policy if exists "exercises_select_all" on public.exercises;
create policy "exercises_select_all" on public.exercises for select using (true);

alter table public.nutrition_items enable row level security;
drop policy if exists "nutrition_items_select_all" on public.nutrition_items;
create policy "nutrition_items_select_all" on public.nutrition_items for select using (true);

alter table public.phase_food_recommendations enable row level security;
drop policy if exists "phase_food_recommendations_select_all" on public.phase_food_recommendations;
create policy "phase_food_recommendations_select_all" on public.phase_food_recommendations for select using (true);

-- ---------------------------------------------------------------------------
-- meal_plans / meal_plan_items — owner only
-- ---------------------------------------------------------------------------
alter table public.meal_plans enable row level security;
drop policy if exists "meal_plans_all_own" on public.meal_plans;
create policy "meal_plans_all_own" on public.meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.meal_plan_items enable row level security;
drop policy if exists "meal_plan_items_all_own" on public.meal_plan_items;
create policy "meal_plan_items_all_own" on public.meal_plan_items
  for all using (
    exists (select 1 from public.meal_plans mp where mp.id = meal_plan_items.plan_id and mp.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.meal_plans mp where mp.id = meal_plan_items.plan_id and mp.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- exercise_plans / exercise_plan_items — owner only
-- ---------------------------------------------------------------------------
alter table public.exercise_plans enable row level security;
drop policy if exists "exercise_plans_all_own" on public.exercise_plans;
create policy "exercise_plans_all_own" on public.exercise_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.exercise_plan_items enable row level security;
drop policy if exists "exercise_plan_items_all_own" on public.exercise_plan_items;
create policy "exercise_plan_items_all_own" on public.exercise_plan_items
  for all using (
    exists (select 1 from public.exercise_plans ep where ep.id = exercise_plan_items.plan_id and ep.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.exercise_plans ep where ep.id = exercise_plan_items.plan_id and ep.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- forum_threads / forum_comments — public read, own write, admin moderates
-- ---------------------------------------------------------------------------
alter table public.forum_threads enable row level security;
drop policy if exists "forum_threads_select_all" on public.forum_threads;
create policy "forum_threads_select_all" on public.forum_threads for select using (true);
drop policy if exists "forum_threads_insert_own" on public.forum_threads;
create policy "forum_threads_insert_own" on public.forum_threads
  for insert with check (auth.uid() = author_id);
drop policy if exists "forum_threads_update_own_or_admin" on public.forum_threads;
create policy "forum_threads_update_own_or_admin" on public.forum_threads
  for update using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());
drop policy if exists "forum_threads_delete_own_or_admin" on public.forum_threads;
create policy "forum_threads_delete_own_or_admin" on public.forum_threads
  for delete using (auth.uid() = author_id or public.is_admin());

alter table public.forum_comments enable row level security;
drop policy if exists "forum_comments_select_all" on public.forum_comments;
create policy "forum_comments_select_all" on public.forum_comments for select using (true);
drop policy if exists "forum_comments_insert_own" on public.forum_comments;
create policy "forum_comments_insert_own" on public.forum_comments
  for insert with check (auth.uid() = author_id);
drop policy if exists "forum_comments_update_own_or_admin" on public.forum_comments;
create policy "forum_comments_update_own_or_admin" on public.forum_comments
  for update using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());
drop policy if exists "forum_comments_delete_own_or_admin" on public.forum_comments;
create policy "forum_comments_delete_own_or_admin" on public.forum_comments
  for delete using (auth.uid() = author_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- thread_likes / comment_likes — public read, own insert/delete
-- ---------------------------------------------------------------------------
alter table public.thread_likes enable row level security;
drop policy if exists "thread_likes_select_all" on public.thread_likes;
create policy "thread_likes_select_all" on public.thread_likes for select using (true);
drop policy if exists "thread_likes_insert_own" on public.thread_likes;
create policy "thread_likes_insert_own" on public.thread_likes
  for insert with check (auth.uid() = user_id);
drop policy if exists "thread_likes_delete_own" on public.thread_likes;
create policy "thread_likes_delete_own" on public.thread_likes
  for delete using (auth.uid() = user_id);

alter table public.comment_likes enable row level security;
drop policy if exists "comment_likes_select_all" on public.comment_likes;
create policy "comment_likes_select_all" on public.comment_likes for select using (true);
drop policy if exists "comment_likes_insert_own" on public.comment_likes;
create policy "comment_likes_insert_own" on public.comment_likes
  for insert with check (auth.uid() = user_id);
drop policy if exists "comment_likes_delete_own" on public.comment_likes;
create policy "comment_likes_delete_own" on public.comment_likes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- forum_attachments — public read, insert/delete tied to parent ownership
-- ---------------------------------------------------------------------------
alter table public.forum_attachments enable row level security;
drop policy if exists "forum_attachments_select_all" on public.forum_attachments;
create policy "forum_attachments_select_all" on public.forum_attachments for select using (true);
drop policy if exists "forum_attachments_insert_own" on public.forum_attachments;
create policy "forum_attachments_insert_own" on public.forum_attachments
  for insert with check (
    exists (select 1 from public.forum_threads t where t.id = forum_attachments.thread_id and t.author_id = auth.uid())
    or exists (select 1 from public.forum_comments c where c.id = forum_attachments.comment_id and c.author_id = auth.uid())
  );
drop policy if exists "forum_attachments_delete_own_or_admin" on public.forum_attachments;
create policy "forum_attachments_delete_own_or_admin" on public.forum_attachments
  for delete using (
    public.is_admin()
    or exists (select 1 from public.forum_threads t where t.id = forum_attachments.thread_id and t.author_id = auth.uid())
    or exists (select 1 from public.forum_comments c where c.id = forum_attachments.comment_id and c.author_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- library_resources — public read, own write, admin moderates
-- ---------------------------------------------------------------------------
alter table public.library_resources enable row level security;
drop policy if exists "library_resources_select_all" on public.library_resources;
create policy "library_resources_select_all" on public.library_resources for select using (true);
drop policy if exists "library_resources_insert_own" on public.library_resources;
create policy "library_resources_insert_own" on public.library_resources
  for insert with check (auth.uid() = uploader_id);
drop policy if exists "library_resources_update_own_or_admin" on public.library_resources;
create policy "library_resources_update_own_or_admin" on public.library_resources
  for update using (auth.uid() = uploader_id or public.is_admin())
  with check (auth.uid() = uploader_id or public.is_admin());
drop policy if exists "library_resources_delete_own_or_admin" on public.library_resources;
create policy "library_resources_delete_own_or_admin" on public.library_resources
  for delete using (auth.uid() = uploader_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- chat_sessions / chat_messages — owner only for now.
-- Anonymous chat (user_id null, D2) has no stable RLS identity; Phase 5
-- (VietAsk) will route anonymous chat through server-side code using the
-- service_role key (which bypasses RLS), not direct client-side queries.
-- ---------------------------------------------------------------------------
alter table public.chat_sessions enable row level security;
drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own" on public.chat_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "chat_sessions_insert_own_or_anon" on public.chat_sessions;
create policy "chat_sessions_insert_own_or_anon" on public.chat_sessions
  for insert with check (auth.uid() = user_id or user_id is null);

alter table public.chat_messages enable row level security;
drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select using (
    exists (select 1 from public.chat_sessions cs where cs.id = chat_messages.session_id and cs.user_id = auth.uid())
  );
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (
    exists (select 1 from public.chat_sessions cs where cs.id = chat_messages.session_id and cs.user_id = auth.uid())
  );
