-- ============================================
-- mirako Supabase 初始化脚本
-- 在 Supabase SQL Editor 中按顺序执行
-- ============================================

-- 1. 创建 profiles 扩展表
-- 用于存储用户昵称和缩写，便于看板展示

create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text not null,
  abbr text not null
);

-- 允许所有人查看 profiles（小团队内部无需隐藏）
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. 创建 tasks 表
-- 核心任务数据：内容、状态、被指派人

create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  content text not null default '',
  status text not null check (status in ('todo', 'doing', 'done')),
  assignee_ids uuid[] default '{}',
  created_by uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 全员可编辑：所有已认证用户都能读写
alter table public.tasks enable row level security;

create policy "Allow all operations for authenticated users"
  on public.tasks
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 3. 启用 Realtime 同步
-- 让看板在不同浏览器/设备间实时更新

alter publication supabase_realtime add table public.tasks;

-- ============================================
-- 可选：自动创建 profile 的触发器
-- 当新用户通过 Auth 注册时，自动插入默认 profile
-- ============================================

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, abbr)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'User'), 'U');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 4. 手动插入 4 位团队成员
-- 
-- 步骤：
-- a) 先去 Supabase Dashboard → Authentication → Users
--    为 4 人分别创建用户，记下每个人的 UUID
-- b) 将下面的 UUID 替换为实际值，然后执行 insert
-- ============================================

/*
insert into public.profiles (id, name, abbr) values
  ('UUID-HERE', 'Peter',    'P'),
  ('UUID-HERE', 'TamikiP',  'T'),
  ('UUID-HERE', '落川',     '落'),
  ('UUID-HERE', '小坑酱',   '坑');
*/
