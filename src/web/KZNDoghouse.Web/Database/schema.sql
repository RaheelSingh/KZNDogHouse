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


-- Foster applications (web-operations/Avikar)
-- AKEEV, public foster-application form inserts into this same table, do not create a second one on web-public.


create table if not exists public.foster_applications (
    id uuid primary key default gen_random_uuid(),
    applicant_user_id uuid null references public.user_profiles(id) on delete set null,
    applicant_name text not null,
    applicant_email text not null,
    applicant_phone text null,
    dog_id uuid null references public.dogs(id) on delete set null,
    application_details text null,
    status text not null default 'Submitted'
        check (status in ('Submitted', 'Under Review', 'Approved', 'Rejected')),
    submitted_at timestamptz not null default now(),
    reviewed_by_staff_id uuid null references public.user_profiles(id) on delete set null,
    reviewed_at timestamptz null,
    rejection_reason text null,
    fostering_record_id uuid null references public.fostering_records(id) on delete set null
);

alter table public.foster_applications enable row level security;

revoke all on table public.foster_applications from anon;
revoke all on table public.foster_applications from authenticated;

grant all on table public.foster_applications to service_role;



-- Inventory (web-operations/Avikar)

create table if not exists public.inventory_items (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text null,
    quantity int not null default 0,
    unit text null,
    low_stock_threshold int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz null
);

alter table public.inventory_items enable row level security;
revoke all on table public.inventory_items from anon;
revoke all on table public.inventory_items from authenticated;
grant all on table public.inventory_items to service_role;


create table if not exists public.inventory_transactions (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references public.inventory_items(id) on delete cascade,
    transaction_type text not null
        check (transaction_type in ('Delivery', 'Usage', 'Adjustment')),
    quantity_change int not null,
    transaction_date timestamptz not null default now(),
    expiry_date date null,
    notes text null,
    updated_by_user_id uuid not null references public.user_profiles(id),
    created_at timestamptz not null default now()
);

alter table public.inventory_transactions enable row level security;
revoke all on table public.inventory_transactions from anon;
revoke all on table public.inventory_transactions from authenticated;
grant all on table public.inventory_transactions to service_role;


create table if not exists public.contact_messages (
    id uuid primary key default gen_random_uuid(),
    first_name text not null,
    last_name text not null,
    email text not null,
    phone text null,
    topic text not null
        check (topic in ('Fostering', 'Volunteering', 'Adoption', 'Donations & partnerships', 'Something else')),
    message text not null,
    submitted_by_user_id uuid null references public.user_profiles(id) on delete set null,
    is_handled boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from anon;
revoke all on table public.contact_messages from authenticated;
grant all on table public.contact_messages to service_role;
