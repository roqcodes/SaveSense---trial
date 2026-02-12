-- Create a table to store shared content
create table public.shared_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  content_type text not null, -- 'weburl', 'text', 'image', 'file'
  value text not null, -- the main url or text content
  platform text, -- 'instagram', 'youtube', 'twitter', 'facebook', etc.
  metadata jsonb default '{}'::jsonb, -- Stores title, description, image, and raw share data
  is_processed boolean default false -- Flag for future AI analysis
);

-- Enable Row Level Security (RLS)
alter table public.shared_entries enable row level security;

-- Create policies to ensure users can only see and add their own data
create policy "Users can view their own entries"
on public.shared_entries for select
using (auth.uid() = user_id);

create policy "Users can insert their own entries"
on public.shared_entries for insert
with check (auth.uid() = user_id);

create policy "Users can delete their own entries"
on public.shared_entries for delete
using (auth.uid() = user_id);
