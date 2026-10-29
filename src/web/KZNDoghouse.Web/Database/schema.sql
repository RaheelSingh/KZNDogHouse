-- KZN Doghouse database schema.
-- Can be applied to the existing database without deleting application records.
-- Existing RLS policies, table permissions, storage settings and auth triggers are preserved.
-- Review any schema conflicts shown by PostgreSQL before proceeding.

begin;
set local lock_timeout = '10s';

-- Record which tables already existed so security initialization only affects new tables.
create temporary table kzn_preexisting_tables (name text primary key) on commit drop;
insert into pg_temp.kzn_preexisting_tables(name)
select format('%I.%I', schemaname, tablename)
from pg_catalog.pg_tables
where schemaname = 'public';

create extension if not exists pgcrypto;


/* Storage buckets */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-media', 'public-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-files', 'private-files', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;


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
        where conrelid = 'public.user_profiles'::regclass
          and conname = 'user_profiles_volunteer_request_status_check'
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

grant all on table public.user_profiles to service_role;


-- Do not overwrite existing sign-up integration functions or triggers.
do $kzn_auth$
begin
    if to_regprocedure('public.handle_new_user()') is null then
        execute $kzn_function$
        create or replace function public.handle_new_user()
        returns trigger
        language plpgsql
        security definer
        set search_path = ''
        as $kzn_body$
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
        $kzn_body$;
        $kzn_function$;
    end if;

    if not exists (
        select 1 from pg_catalog.pg_trigger
        where tgrelid = 'auth.users'::regclass
          and tgname = 'on_auth_user_created' and not tgisinternal
    ) then
        create trigger on_auth_user_created
            after insert on auth.users
            for each row execute function public.handle_new_user();
    end if;
end;
$kzn_auth$;


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

do $$
begin
    if not exists (
        select 1 from pg_catalog.pg_constraint
        where conrelid = 'public.calendar_events'::regclass
          and conname = 'calendar_events_max_volunteers_check'
    ) then
        alter table public.calendar_events
            add constraint calendar_events_max_volunteers_check
            check (max_volunteers is null or max_volunteers between 1 and 200);
    end if;
end;
$$;

create index if not exists idx_calendar_events_start
    on public.calendar_events(start_at);

create index if not exists idx_calendar_events_visibility
    on public.calendar_events(visibility);

grant all on table public.calendar_events to service_role;


create table if not exists public.event_assignments (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.calendar_events(id) on delete cascade,
    profile_id uuid not null references public.user_profiles(id) on delete cascade,
    status text not null default 'Pending'
        check (status in ('Pending', 'Confirmed', 'Reserve', 'Declined', 'Cancelled', 'Assigned', 'Registered')),
    checked_in_at timestamptz null,
    created_at timestamptz not null default now(),
    unique (event_id, profile_id)
);

alter table public.event_assignments
    add column if not exists checked_in_at timestamptz null;

create index if not exists idx_event_assignments_profile
    on public.event_assignments(profile_id);

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



grant all on table public.vet_profiles to service_role;
grant all on table public.vet_dog_authorizations to service_role;

/* Volunteer applications, review and capacity enforcement */

-- Update the standard assignment status constraint only when necessary.
-- Unknown custom status constraints are never silently removed.
do $kzn_status$
declare
    v_definition text;
    v_other_constraint text;
begin
    if exists (
        select 1 from public.event_assignments
        where status not in ('Pending', 'Confirmed', 'Reserve', 'Declined',
                             'Cancelled', 'Assigned', 'Registered')
    ) then
        raise exception 'Unrecognised event assignment status. No schema changes committed.';
    end if;

    select c.conname into v_other_constraint
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.event_assignments'::regclass
      and c.contype = 'c'
      and c.conname <> 'event_assignments_status_check'
      and pg_get_constraintdef(c.oid) ilike '%status%'
    limit 1;
    if v_other_constraint is not null then
        raise exception 'Unexpected event assignment status constraint: %. Review it before updating.', v_other_constraint;
    end if;

    select pg_get_constraintdef(c.oid) into v_definition
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.event_assignments'::regclass
      and c.conname = 'event_assignments_status_check';

    if v_definition is null or not (
        v_definition like '%Pending%'
        and v_definition like '%Reserve%'
        and v_definition like '%Declined%'
        and v_definition like '%Confirmed%'
        and v_definition like '%Cancelled%'
        and v_definition like '%Assigned%'
        and v_definition like '%Registered%'
    ) then
        if v_definition is not null then
            alter table public.event_assignments
                drop constraint event_assignments_status_check;
        end if;
        alter table public.event_assignments
            add constraint event_assignments_status_check
            check (status in ('Pending', 'Confirmed', 'Reserve', 'Declined',
                              'Cancelled', 'Assigned', 'Registered'));
    end if;
end;
$kzn_status$;

-- New assignment records default to the review queue; existing rows remain unchanged.
alter table public.event_assignments
    alter column status set default 'Pending';

create index if not exists idx_event_assignments_event_status
    on public.event_assignments (event_id, status);

-- Every event approval is serialized on the event row. The lock protects against
-- concurrent reviewers filling the last vacancy at the same time.
create or replace function public.review_volunteer_application(
    p_assignment_id uuid,
    p_status text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_event_id uuid;
    v_event public.calendar_events%rowtype;
    v_assignment public.event_assignments%rowtype;
    v_confirmed_count integer;
begin
    if p_status not in ('Confirmed', 'Reserve', 'Declined') then
        raise exception 'Invalid volunteer review status.' using errcode = 'P0001';
    end if;

    select event_id into v_event_id
    from public.event_assignments where id = p_assignment_id;
    if v_event_id is null then
        raise exception 'Volunteer application not found.' using errcode = 'P0001';
    end if;

    select * into v_event from public.calendar_events
    where id = v_event_id for update;
    if not found then
        raise exception 'Event not found.' using errcode = 'P0001';
    end if;

    select * into v_assignment from public.event_assignments
    where id = p_assignment_id for update;
    if not found or v_assignment.event_id <> v_event_id then
        raise exception 'Volunteer application changed; please refresh.' using errcode = 'P0001';
    end if;

    if v_assignment.status = p_status then
        return false;
    end if;
    if v_assignment.status = 'Cancelled' then
        raise exception 'A cancelled application cannot be reviewed.' using errcode = 'P0001';
    end if;
    if v_event.start_at <= now() then
        raise exception 'Past or started events cannot be reviewed.' using errcode = 'P0001';
    end if;

    if p_status = 'Confirmed' then
        if not v_event.volunteer_signup_enabled or v_event.max_volunteers is null then
            raise exception 'Volunteer registration is not configured for this event.' using errcode = 'P0001';
        end if;
        select count(*) into v_confirmed_count
        from public.event_assignments
        where event_id = v_event_id
          and id <> p_assignment_id
          and status in ('Confirmed', 'Assigned', 'Registered');
        if v_confirmed_count >= v_event.max_volunteers then
            raise exception 'All volunteer places are currently filled.' using errcode = 'P0001';
        end if;
    end if;

    update public.event_assignments set status = p_status where id = p_assignment_id;
    return true;
end;
$$;

-- Only trusted API requests using the service-role key may review volunteers.
revoke all on function public.review_volunteer_application(uuid, text) from public, anon, authenticated;
grant execute on function public.review_volunteer_application(uuid, text) to service_role;

-- Mobile volunteers submit applications themselves. The function resolves the
-- profile from the authenticated JWT, never from a caller-controlled profile ID.
create or replace function public.request_volunteer_place(p_event_id uuid)
returns public.event_assignments
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
    v_profile public.user_profiles%rowtype;
    v_event public.calendar_events%rowtype;
    v_assignment public.event_assignments%rowtype;
begin
    if auth.uid() is null then
        raise exception 'Sign in to volunteer.' using errcode = 'P0001';
    end if;
    select * into v_profile from public.user_profiles
    where auth_user_id = (select auth.uid()) and role = 'Volunteer' and is_active = true;
    if not found then
        raise exception 'An active volunteer account is required.' using errcode = 'P0001';
    end if;

    select * into v_event from public.calendar_events
    where id = p_event_id for update;
    if not found or v_event.start_at <= now() then
        raise exception 'This event is not accepting applications.' using errcode = 'P0001';
    end if;
    if not v_event.volunteer_signup_enabled or v_event.max_volunteers is null
       or v_event.volunteer_start_at is null or v_event.volunteer_end_at is null
       or v_event.volunteer_end_at <= v_event.volunteer_start_at then
        raise exception 'Volunteer registration is not configured for this event.' using errcode = 'P0001';
    end if;

    select * into v_assignment from public.event_assignments
    where event_id = p_event_id and profile_id = v_profile.id for update;
    if found and v_assignment.status <> 'Cancelled' then
        raise exception 'You have already applied for this event.' using errcode = 'P0001';
    end if;

    if v_assignment.id is not null then
        update public.event_assignments set status = 'Pending'
        where id = v_assignment.id returning * into v_assignment;
    else
        insert into public.event_assignments(event_id, profile_id, status)
        values (p_event_id, v_profile.id, 'Pending')
        returning * into v_assignment;
    end if;
    return v_assignment;
end;
$$;
revoke all on function public.request_volunteer_place(uuid) from public, anon;
grant execute on function public.request_volunteer_place(uuid) to authenticated;

create or replace function public.cancel_volunteer_application(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_profile_id uuid;
    v_assignment public.event_assignments%rowtype;
begin
    select id into v_profile_id from public.user_profiles
    where auth_user_id = (select auth.uid()) and role = 'Volunteer' and is_active = true;
    if v_profile_id is null then
        raise exception 'An active volunteer account is required.' using errcode = 'P0001';
    end if;
    select * into v_assignment from public.event_assignments
    where event_id = p_event_id and profile_id = v_profile_id for update;
    if not found then
        raise exception 'No volunteer application was found.' using errcode = 'P0001';
    end if;
    if v_assignment.status = 'Cancelled' then return false; end if;
    update public.event_assignments set status = 'Cancelled'
    where id = v_assignment.id;
    return true;
end;
$$;
revoke all on function public.cancel_volunteer_application(uuid) from public, anon;
grant execute on function public.cancel_volunteer_application(uuid) to authenticated;

create or replace function public.get_confirmed_volunteer_counts(p_event_ids uuid[])
returns table(event_id uuid, signed_up bigint)
language sql
stable
security definer
set search_path = ''
as $$
    select a.event_id, count(*)::bigint
    from public.event_assignments a
    where a.event_id = any(p_event_ids)
      and a.status in ('Confirmed', 'Assigned', 'Registered')
      and (select auth.uid()) is not null
    group by a.event_id;
$$;
revoke all on function public.get_confirmed_volunteer_counts(uuid[]) from public, anon;
grant execute on function public.get_confirmed_volunteer_counts(uuid[]) to authenticated;

-- Protect capacity even when older clients write legacy Registered/Assigned
-- statuses instead of using the staff review function.
create or replace function public.enforce_volunteer_event_capacity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_max integer;
    v_enabled boolean;
    v_confirmed bigint;
begin
    if new.status not in ('Confirmed', 'Assigned', 'Registered') then
        return new;
    end if;
    if tg_op = 'UPDATE' and old.status in ('Confirmed', 'Assigned', 'Registered')
       and old.event_id = new.event_id then
        return new;
    end if;

    select max_volunteers, volunteer_signup_enabled
        into v_max, v_enabled
    from public.calendar_events where id = new.event_id for update;
    if not coalesce(v_enabled, false) or v_max is null then
        raise exception 'Volunteer signup is not configured for this event.' using errcode = 'P0001';
    end if;
    select count(*) into v_confirmed
    from public.event_assignments
    where event_id = new.event_id
      and id <> new.id
      and status in ('Confirmed', 'Assigned', 'Registered');
    if v_confirmed >= v_max then
        raise exception 'All volunteer places are currently filled.' using errcode = 'P0001';
    end if;
    return new;
end;
$$;
do $$
begin
    if exists (
        select 1 from pg_catalog.pg_trigger t
        where t.tgrelid = 'public.event_assignments'::regclass
          and t.tgname = 'check_volunteer_event_capacity'
          and t.tgfoid <> 'public.enforce_volunteer_event_capacity()'::regprocedure
    ) then
        raise exception 'Unexpected existing volunteer capacity trigger. Review before updating.';
    end if;
    if not exists (
        select 1 from pg_catalog.pg_trigger
        where tgrelid = 'public.event_assignments'::regclass
          and tgname = 'check_volunteer_event_capacity' and not tgisinternal
    ) then
        create trigger check_volunteer_event_capacity
            before insert or update of event_id, status on public.event_assignments
            for each row execute function public.enforce_volunteer_event_capacity();
    end if;
end;
$$;


-- Enable RLS only on tables created by this run. Existing tables keep their current RLS settings.
do $kzn_rls$
declare
    v_name text;
begin
    foreach v_name in array array[
        'public.user_profiles', 'public.dogs', 'public.dog_images',
        'public.dog_medical_records', 'public.dog_notes',
        'public.fostering_records', 'public.foster_applications',
        'public.availability_slots', 'public.calendar_events',
        'public.event_assignments', 'public.inventory_items',
        'public.inventory_transactions', 'public.notifications',
        'public.contact_messages', 'public.vet_profiles',
        'public.vet_dog_authorizations'
    ] loop
        if not exists (
            select 1 from pg_temp.kzn_preexisting_tables where name = v_name
        ) then
            execute format('alter table %s enable row level security', v_name);
        end if;
    end loop;
end;
$kzn_rls$;

-- Refresh PostgREST metadata after schema changes.
notify pgrst, 'reload schema';

commit;
