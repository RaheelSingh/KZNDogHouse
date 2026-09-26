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


create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested_role text;
    resolved_role text := 'Public';
begin
    requested_role := new.raw_user_meta_data ->> 'role';

    -- Self-registration (mobile app) can only ever grant 'Volunteer'.
    -- Staff/Administrator/Vet are assigned internally, never from client input.
    if lower(coalesce(requested_role, '')) = 'volunteer' then
        resolved_role := 'Volunteer';
    end if;

    insert into public.user_profiles (
        auth_user_id,
        first_name,
        last_name,
        email,
        role
    )
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'first_name', ''),
        coalesce(new.raw_user_meta_data ->> 'last_name', ''),
        coalesce(new.email, ''),
        resolved_role
    );

    return new;
end;
$$;


drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute procedure public.handle_new_user();