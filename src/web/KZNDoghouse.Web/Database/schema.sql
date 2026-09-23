create table if not exists public.user_profiles (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    first_name text not null,
    last_name text not null,
    email text not null,
    role text not null default 'Public'
        check (role in ('Public', 'Volunteer', 'Staff', 'Administrator', 'Vet')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz null
);

alter table public.user_profiles enable row level security;

revoke all on table public.user_profiles from anon;
revoke all on table public.user_profiles from authenticated;

grant all on table public.user_profiles to service_role;