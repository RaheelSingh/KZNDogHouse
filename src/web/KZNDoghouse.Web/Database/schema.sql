-- KZN Doghouse web database schema
-- This file documents the tables used by the ASP.NET Core website,
-- internal portal and REST API.

create extension if not exists pgcrypto;


/* Storage buckets */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-media', 'public-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-files', 'private-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;


/* User profiles */

create table if not exists public.user_profiles (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users(id) on delete cascade,
    first_name text not null,
    last_name text not null,
    email text not null,
    role text not null default 'Public'
        check (role in ('Public', 'Volunteer', 'Staff', 'Administrator', 'Vet')),
    is_active boolean not null default true,
    volunteer_request_status text not null default 'None'
        check (volunteer_request_status in ('None', 'Pending', 'Approved', 'Rejected')),
    volunteer_requested_at timestamptz null,
    volunteer_reviewed_at timestamptz null,
    volunteer_reviewed_by uuid null references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz null
);

alter table public.user_profiles
    add column if not exists volunteer_request_status text not null default 'None',
    add column if not exists volunteer_requested_at timestamptz null,
    add column if not exists volunteer_reviewed_at timestamptz null,
    add column if not exists volunteer_reviewed_by uuid null references public.user_profiles(id) on delete set null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'user_profiles_volunteer_request_status_check'
    ) then
        alter table public.user_profiles
            add constraint user_profiles_volunteer_request_status_check
            check (volunteer_request_status in ('None', 'Pending', 'Approved', 'Rejected'));
    end if;
end;
$$;

create index if not exists idx_user_profiles_role
    on public.user_profiles(role);

create index if not exists idx_user_profiles_active
    on public.user_profiles(is_active);

create index if not exists idx_user_profiles_volunteer_request
    on public.user_profiles(volunteer_request_status);

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
    wants_to_volunteer boolean := false;
begin
    wants_to_volunteer :=
        lower(coalesce(
            new.raw_user_meta_data ->> 'volunteer_interest',
            'false')) = 'true';

    insert into public.user_profiles (
        auth_user_id,
        first_name,
        last_name,
        email,
        role,
        volunteer_request_status,
        volunteer_requested_at
    )
    values (
        new.id,
        coalesce(new.raw_user_meta_data ->> 'first_name', ''),
        coalesce(new.raw_user_meta_data ->> 'last_name', ''),
        coalesce(new.email, ''),
        'Public',
        case
            when wants_to_volunteer then 'Pending'
            else 'None'
        end,
        case
            when wants_to_volunteer then now()
            else null
        end
    );

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute procedure public.handle_new_user();


/* Dogs */

create table if not exists public.dogs (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    breed text null,
    date_of_birth date null,
    estimated_age_years int null
        check (estimated_age_years is null or estimated_age_years between 0 and 30),
    gender text not null default 'Unknown'
        check (gender in ('Male', 'Female', 'Unknown')),
    size text null
        check (size is null or size in ('Small', 'Medium', 'Large')),
    weight_kg numeric null
        check (weight_kg is null or weight_kg >= 0),
    eye_colour text null,
    temperament text null,
    about text null,
    kennel_location text null,
    intake_date date not null default current_date,
    intake_type text null,
    status text not null default 'In Care'
        check (status in ('Available', 'In Care', 'Under Treatment', 'Fostered', 'Reserved', 'Adopted')),
    is_vaccinated boolean not null default false,
    photo_url text null,
    created_by uuid null references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz null
);

create index if not exists idx_dogs_name
    on public.dogs(name);

create index if not exists idx_dogs_status
    on public.dogs(status);

alter table public.dogs enable row level security;
revoke all on table public.dogs from anon;
revoke all on table public.dogs from authenticated;
grant all on table public.dogs to service_role;


/* Dog images */

create table if not exists public.dog_images (
    id uuid primary key default gen_random_uuid(),
    dog_id uuid not null references public.dogs(id) on delete cascade,
    storage_path text not null,
    public_url text not null,
    is_primary boolean not null default false,
    sort_order int not null default 0 check (sort_order >= 0),
    alt_text text null,
    created_by uuid null references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    unique (dog_id, storage_path)
);

create index if not exists idx_dog_images_dog
    on public.dog_images(dog_id, sort_order, created_at);

create unique index if not exists ux_dog_images_primary
    on public.dog_images(dog_id)
    where is_primary = true;

alter table public.dog_images enable row level security;
revoke all on table public.dog_images from anon;
revoke all on table public.dog_images from authenticated;
grant all on table public.dog_images to service_role;


/* Dog medical records and staff notes */

create table if not exists public.dog_medical_records (
    id uuid primary key default gen_random_uuid(),
    dog_id uuid not null references public.dogs(id) on delete cascade,
    record_type text not null default 'Treatment note'
        check (record_type in ('Vaccination', 'Condition', 'Medication', 'Treatment note')),
    title text not null,
    details text null,
    vet_name text null,
    next_action_date date null,
    status text not null default 'Active'
        check (status in ('Active', 'Resolved')),
    created_by uuid null references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_dog_medical_records_dog
    on public.dog_medical_records(dog_id);

create index if not exists idx_dog_medical_records_status
    on public.dog_medical_records(status);

alter table public.dog_medical_records enable row level security;
revoke all on table public.dog_medical_records from anon;
revoke all on table public.dog_medical_records from authenticated;
grant all on table public.dog_medical_records to service_role;


create table if not exists public.dog_notes (
    id uuid primary key default gen_random_uuid(),
    dog_id uuid not null references public.dogs(id) on delete cascade,
    author_id uuid null references public.user_profiles(id) on delete set null,
    note text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_dog_notes_dog
    on public.dog_notes(dog_id);

alter table public.dog_notes enable row level security;
revoke all on table public.dog_notes from anon;
revoke all on table public.dog_notes from authenticated;
grant all on table public.dog_notes to service_role;


/* Fostering */

create table if not exists public.fostering_records (
    id uuid primary key default gen_random_uuid(),
    dog_id uuid not null references public.dogs(id) on delete cascade,
    foster_profile_id uuid null references public.user_profiles(id) on delete set null,
    foster_name text null,
    start_date date not null,
    end_date date null,
    feedback text null,
    status text not null default 'Active'
        check (status in ('Active', 'Completed')),
    created_by uuid null references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_fostering_records_dog
    on public.fostering_records(dog_id);

create index if not exists idx_fostering_records_status
    on public.fostering_records(status);

alter table public.fostering_records enable row level security;
revoke all on table public.fostering_records from anon;
revoke all on table public.fostering_records from authenticated;
grant all on table public.fostering_records to service_role;


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

create index if not exists idx_foster_applications_status
    on public.foster_applications(status);

create index if not exists idx_foster_applications_applicant
    on public.foster_applications(applicant_user_id);

create index if not exists idx_foster_applications_dog
    on public.foster_applications(dog_id);

alter table public.foster_applications enable row level security;
revoke all on table public.foster_applications from anon;
revoke all on table public.foster_applications from authenticated;
grant all on table public.foster_applications to service_role;


/* Volunteer availability */

create table if not exists public.availability_slots (
    id uuid primary key default gen_random_uuid(),
    volunteer_id uuid not null references public.user_profiles(id) on delete cascade,
    week_start date not null,
    day_date date not null,
    slot text not null
        check (slot in ('Morning', 'Afternoon', 'Evening')),
    status text not null default 'Pending'
        check (status in ('Pending', 'Approved', 'Rejected')),
    submitted_at timestamptz not null default now(),
    reviewed_by uuid null references public.user_profiles(id) on delete set null,
    reviewed_at timestamptz null
);

create index if not exists idx_availability_slots_volunteer
    on public.availability_slots(volunteer_id);

create index if not exists idx_availability_slots_status
    on public.availability_slots(status);

create index if not exists idx_availability_slots_day
    on public.availability_slots(day_date);

alter table public.availability_slots enable row level security;
revoke all on table public.availability_slots from anon;
revoke all on table public.availability_slots from authenticated;
grant all on table public.availability_slots to service_role;


/* Calendar and event assignments */

create table if not exists public.calendar_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    category text not null default 'Other'
        check (category in ('Shift', 'Vet & Care', 'Meeting', 'Public Event', 'Other')),
    description text null,
    location text null,
    start_at timestamptz not null,
    end_at timestamptz null,
    visibility text not null default 'Internal'
        check (visibility in ('Internal', 'Public')),
    dog_id uuid null references public.dogs(id) on delete set null,
    image_path text null,
    image_url text null,
    volunteer_signup_enabled boolean not null default false,
    max_volunteers int null
        check (max_volunteers is null or max_volunteers between 1 and 200),
    volunteer_start_at timestamptz null,
    volunteer_end_at timestamptz null,
    volunteer_notes text null,
    created_by uuid null references public.user_profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

alter table public.calendar_events
    add column if not exists image_path text null,
    add column if not exists image_url text null,
    add column if not exists volunteer_signup_enabled boolean not null default false,
    add column if not exists max_volunteers int null,
    add column if not exists volunteer_start_at timestamptz null,
    add column if not exists volunteer_end_at timestamptz null,
    add column if not exists volunteer_notes text null;

alter table public.calendar_events
    drop constraint if exists calendar_events_max_volunteers_check;

alter table public.calendar_events
    add constraint calendar_events_max_volunteers_check
    check (max_volunteers is null or max_volunteers between 1 and 200);

create index if not exists idx_calendar_events_start
    on public.calendar_events(start_at);

create index if not exists idx_calendar_events_visibility
    on public.calendar_events(visibility);

alter table public.calendar_events enable row level security;
revoke all on table public.calendar_events from anon;
revoke all on table public.calendar_events from authenticated;
grant all on table public.calendar_events to service_role;


create table if not exists public.event_assignments (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.calendar_events(id) on delete cascade,
    profile_id uuid not null references public.user_profiles(id) on delete cascade,
    status text not null default 'Assigned'
        check (status in ('Assigned', 'Registered', 'Confirmed', 'Cancelled')),
    created_at timestamptz not null default now(),
    unique (event_id, profile_id)
);

create index if not exists idx_event_assignments_profile
    on public.event_assignments(profile_id);

alter table public.event_assignments enable row level security;
revoke all on table public.event_assignments from anon;
revoke all on table public.event_assignments from authenticated;
grant all on table public.event_assignments to service_role;


/* Inventory */

create table if not exists public.inventory_items (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text null,
    quantity int not null default 0,
    unit text null,
    low_stock_threshold int not null default 0,
    image_path text null,
    image_url text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz null
);

alter table public.inventory_items
    add column if not exists image_path text null,
    add column if not exists image_url text null;

create index if not exists idx_inventory_items_name
    on public.inventory_items(name);

create index if not exists idx_inventory_items_category
    on public.inventory_items(category);

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

create index if not exists idx_inventory_transactions_item
    on public.inventory_transactions(item_id);

alter table public.inventory_transactions enable row level security;
revoke all on table public.inventory_transactions from anon;
revoke all on table public.inventory_transactions from authenticated;
grant all on table public.inventory_transactions to service_role;


/* Notifications */

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references public.user_profiles(id) on delete cascade,
    category text not null default 'General'
        check (category in ('Medical', 'Calendar', 'Tasks', 'Messages', 'General')),
    title text not null,
    body text null,
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient_created
    on public.notifications(recipient_id, created_at desc);

create index if not exists idx_notifications_recipient_unread
    on public.notifications(recipient_id, is_read);

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;
grant all on table public.notifications to service_role;


/* Public contact messages */

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

create index if not exists idx_contact_messages_created
    on public.contact_messages(created_at desc);

alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from anon;
revoke all on table public.contact_messages from authenticated;
grant all on table public.contact_messages to service_role;


/* Vet medical access */

create table if not exists public.vet_profiles (
    id uuid primary key default gen_random_uuid(),
    user_profile_id uuid not null unique references public.user_profiles(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.vet_dog_authorizations (
    id uuid primary key default gen_random_uuid(),
    vet_profile_id uuid not null references public.vet_profiles(id) on delete cascade,
    dog_id uuid not null references public.dogs(id) on delete cascade,
    authorized_by_profile_id uuid null references public.user_profiles(id) on delete set null,
    authorized_at timestamptz not null default now(),
    unique (vet_profile_id, dog_id)
);

create index if not exists idx_vet_dog_authorizations_vet
    on public.vet_dog_authorizations(vet_profile_id);

create index if not exists idx_vet_dog_authorizations_dog
    on public.vet_dog_authorizations(dog_id);

alter table public.vet_profiles enable row level security;
alter table public.vet_dog_authorizations enable row level security;

revoke all on table public.vet_profiles from anon;
revoke all on table public.vet_profiles from authenticated;
revoke all on table public.vet_dog_authorizations from anon;
revoke all on table public.vet_dog_authorizations from authenticated;

grant all on table public.vet_profiles to service_role;
grant all on table public.vet_dog_authorizations to service_role;

-- Refresh PostgREST metadata after schema changes.
notify pgrst, 'reload schema';
