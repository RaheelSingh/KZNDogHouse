# KZN Doghouse Digital Platform

INSY7315 Work Integrated Learning project by Hextech Solutions.

Team: Raheel Singh, Kaeden Samsunder, Akeev Sivai, Avikar Maharaj and Mohamed Shaheer Joosab.

## Contents

- About the Project
- What the System Does
- Technology
- Project Structure
- How to Run the Project
- Features
- Security
- Testing and Deployment
- Team and Workflow
- Known Issues

---

## About the Project

KZN Doghouse is a dog shelter that used paper records, Google Docs, spreadsheets and messages to run its daily work. We built a digital platform to replace that. It keeps dog records, medical information, fostering, volunteers, events, inventory and user access in one place.

The platform has three parts that all use the same Supabase database:

- Public website: what visitors see (dogs, fostering, events, contact)
- Staff portal: for staff, administrators and vets (it is part of the same ASP.NET application as the website)
- Mobile app: for volunteers and staff

---

## What the System Does

There are five user roles:

- Public: browses the public website, and can apply to foster after creating an account
- Volunteer: uses the mobile app for availability, events and schedules
- Staff: runs the shelter's day to day work in the portal
- Administrator: can do everything staff can, and also manages users and roles
- Vet: can only see the medical information of dogs they have been authorised for

The main areas of the system are:

- Dogs: records, photos and status (Available, In Care, Under Treatment, Fostered, Reserved, Adopted)
- Medical records and notes (protected, not shown publicly)
- Fostering: applications, placements and returns
- Volunteers: availability slots and approvals
- Events and calendar: events are either Public or Internal
- Inventory: items, deliveries, usage, expiry dates and low stock
- Notifications

The shelter has some rules for foster homes: the property should be fully fenced, the dog needs grass or daily walks on grass, someone should be home day and night, and the dog needs an indoor place to sleep. The foster application form asks about all of these.

---

## Technology

Website and API:

- ASP.NET Core MVC on .NET 10 (C#)
- Razor views, Bootstrap, CSS and JavaScript
- xUnit and Moq for tests

Mobile app:

- React Native with Expo (SDK 57) and TypeScript
- Expo Router for the screens
- Supabase JavaScript client

Backend services:

- Supabase: PostgreSQL database, authentication and file storage
- Firebase Cloud Messaging: push notifications (Android)
- Render: hosting, using Docker
- GitHub Actions: builds and tests every pull request

---

## Project Structure

```text
KZNDoghouse.sln
render.yaml
.github/workflows
  -> ci.yml (builds the website and runs the tests)
  -> autograde.yaml (course autograder)

src/web/KZNDoghouse.Web
  -> Controllers (pages and the REST API)
  -> Services (business rules)
  -> Repositories (database queries)
  -> Models, DTOs, Constants, Helpers
  -> Views (public site, staff portal, login)
  -> Database/schema.sql (all tables, the sign-up trigger, storage buckets)
  -> wwwroot (css, js, images)
  -> Dockerfile

src/mobile/kzndoghouse-app
  -> src/app (one file per screen)
  -> src/components, src/context, src/lib, src/types
  -> app.json, eas.json, package.json

tests/web/KZNDoghouse.Web.Tests
```

The website follows one pattern everywhere: a controller receives the request, a service applies the rules, and a repository talks to the database. Pages never query the database directly.

---

## How to Run the Project

### What you need

- Git
- .NET 10 SDK (check with `dotnet --version`)
- Node.js and npm (mobile app only)
- An Android phone or emulator (mobile app only)
- A Supabase project (ours, or your own free one)
- Docker Desktop (optional)

### 1. Get the code

```bash
git clone https://github.com/EMKNDW/insy7315-g1-2026-wil-g1-project-st10321249.git
cd insy7315-g1-2026-wil-g1-project-st10321249
git checkout develop
```

The website is on the `develop` branch. The newest mobile app code is on the `mobile-core` branch and has not been merged into `develop` yet (see Known Issues).

### 2. Set up Supabase

If you do not have access to our Supabase project, create a free project at supabase.com.

1. In the Supabase dashboard open SQL Editor and click New query.
2. Paste in all of `src/web/KZNDoghouse.Web/Database/schema.sql` and press Run. It is safe to run more than once. It creates the tables, the sign-up trigger and two storage buckets (`public-media` for dog and event photos, and `private-files`).
3. Open Project Settings, then API Keys, and copy the Project URL, the anon (publishable) key and the service role (secret) key.
4. Make your first administrator. New accounts are always created as Public, and only an Administrator can change roles, so the first one is set by hand: open the Table Editor, open `user_profiles`, and change the `role` of your account to Administrator.

Keep the service role key private. It skips all database security, so only the website's server uses it. It must never go into the mobile app or into Git. The mobile app only gets the Project URL and the anon key.

### 3. Run the website

```bash
cd src/web/KZNDoghouse.Web
dotnet user-secrets set "Supabase:Url" "https://your-project.supabase.co"
dotnet user-secrets set "Supabase:AnonKey" "your anon key"
dotnet user-secrets set "Supabase:ServiceRoleKey" "your service role key"
dotnet run
```

Open http://localhost:5210. User secrets are stored outside the repository, so the keys cannot be committed by accident.

To check that the app started without needing Supabase, open http://localhost:5210/api/health. It should return a small JSON message saying the API is healthy.

The Contact page can show a Google map if you also set `GoogleMaps:EmbedApiKey` the same way. This is optional.

### 4. Run the tests

From the root of the repository:

```bash
dotnet test tests/web/KZNDoghouse.Web.Tests
```

At the time of writing this runs 185 tests. They use fake data instead of Supabase, so no keys are needed.

### 5. Run with Docker (optional)

```bash
docker build -f src/web/KZNDoghouse.Web/Dockerfile -t kzn-doghouse-web .
docker run -p 10000:10000 -e Supabase__Url="https://your-project.supabase.co" -e Supabase__AnonKey="your anon key" -e Supabase__ServiceRoleKey="your service role key" kzn-doghouse-web
```

Open http://localhost:10000. This is the same Dockerfile that Render uses.

### 6. Run the mobile app

```bash
git checkout mobile-core
cd src/mobile/kzndoghouse-app
npm install
```

Copy `.env.example` to `.env` (`copy` on Windows, `cp` on Mac or Linux) and fill in:

- `EXPO_PUBLIC_SUPABASE_URL`: the Supabase Project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: the anon key only
- `EXPO_PUBLIC_API_BASE_URL`: the address of the website. If you run the website on your own computer and test on a real phone, use your computer's IP address instead of localhost, and start the website with `dotnet run --urls http://0.0.0.0:5210`.

Then start the app and scan the QR code with Expo Go, or press `a` for an Android emulator:

```bash
npx expo start
```

Notes:

- `npm install` uses the `.npmrc` file in the app folder, which sets `legacy-peer-deps=true` so npm does not fail on peer dependency errors.
- Expo Go does not support push notifications. To test them you need a development build: run `npx eas-cli build --profile development --platform android`, install the APK on the phone, then run `npx expo start --dev-client`. The Expo project belongs to the team's Expo account (see `owner` in `app.json`), so your Expo account must be added to it first.
- Push notifications only work on Android at the moment.

---

## Features

### Public website

Anyone can open these pages. Only the foster application needs a signed-in account.

- Home: the shelter's story, the petition link, the newest dogs and ways to help
- Meet the Dogs: dogs that are Available or Fostered, with size and status filters, sorting and a Load more button. Each dog has its own page with photos and details
- Foster: how fostering works, what you need, dogs that need a foster, a FAQ and the application form
- Get Involved: ways to help, the next events and partnership information
- Events: upcoming and past public events, with category filters
- Contact: a contact form, the shelter's details and a map
- Login, Register and Privacy pages

How the public pages protect data:

- Only Available and Fostered dogs are shown. The pages use small view models, so internal fields like kennel location and intake details are never sent to the browser.
- Only events marked Public are shown.
- Foster applications are saved to the database and linked to the signed-in person. A person can only have one open application at a time, and cannot apply for a dog that is already in foster care.
- Contact messages are saved to the database. A hidden spam trap field on the form means bots that fill it in are ignored.
- All forms are checked on the server as well as in the browser, and use anti-forgery tokens.

### Staff portal

For Staff and Administrators. It opens on a dashboard, with a menu to everything else.

- Dogs: add and edit dogs, change status, search and filter. Up to 10 photos per dog (5 MB each, jpg, png or webp) with a main photo. Medical records, notes and returning a dog from fostering.
- Calendar: create Public or Internal events with a picture. Creating an event notifies the active volunteers.
- Availability: approve or reject the slots volunteers submit.
- Inventory: items with quantity, unit, low stock level and a picture. Deliveries, usage and adjustments are recorded together with who made them.
- Foster applications: approving one starts a fostering record and notifies the applicant. Rejecting needs a reason, which is sent to the applicant.
- Notifications: unread count, mark as read.
- Users and Access (Administrators only): change roles, switch accounts on or off, approve or reject volunteer requests. You cannot change your own role.
- Vet access (Administrators only): choose which dogs each vet can see.

### Vet area

Vets cannot open the general portal. They get their own pages showing only the dogs they are authorised for, where they can read details and add medical records.

### Mobile app

The app is for volunteers and staff. Anyone who is not Staff or an Administrator is treated as a volunteer.

- Sign in and register (volunteers register in two steps: details, then availability and interests)
- Home: who is on duty today, dogs that need attention and today's schedule
- Dogs: searchable list and a dog page with details, photos, medical flags, notes and fostering history. Staff can add dogs with a photo from the camera or gallery, manage photos, and add notes and medical records.
- Calendar: a week strip with filters. Volunteers can sign up for an event and cancel. Staff can create and edit events, which notifies the volunteers.
- Availability: volunteers tap the slots they can work each week, and staff approve them.
- Alerts: notifications list with mark as read. Tapping a push notification opens the right screen.
- Profile: shift numbers, contact details and sign out.

Most of the app reads and writes Supabase directly with the user's login. It only calls the website for `/api/me`, which returns the user's role.

### REST API

The API is part of the same ASP.NET application. Every response has `success`, `message` and `data`.

- `GET /api/health` is the health check (no login)
- `GET /api/me` returns the name, email and role for the signed-in user
- `/api/mobile/...` endpoints for dogs, events, availability, notifications and event registration. The caller sends the user's Supabase access token as a Bearer token.

---

## Security

- Passwords are never stored by the website. Supabase Auth handles them. After login the website keeps an HttpOnly cookie session that lasts 8 hours.
- Roles are checked on the server for every portal page. Hiding a link is not the only protection.
- A public user cannot choose their own role when registering. The database trigger always creates a Public account.
- Login, register and the API are rate limited (login 10 tries per 5 minutes, register 5 per 10 minutes, API 120 requests per minute).
- Responses include the security headers `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`. The site redirects to HTTPS, and Production also uses HSTS.
- Every database table has row level security switched on, and normal logged-in users get no direct table access. The website's server code does the database work with the service role key.
- Secrets are kept out of Git. The repository only has `.env.example` files showing the names of the values.

---

## Testing and Deployment

Tests:

- 185 automated tests in `tests/web/KZNDoghouse.Web.Tests`. They cover the business rules (public dog visibility, filters, foster applications, events, contact messages, inventory, availability and more) and a check of the health endpoint.

GitHub Actions:

- `ci.yml` runs on every push and pull request to `develop`, `test` and `main`. It builds the solution in Release mode, runs the tests and uploads the results.
- `autograde.yaml` is the course autograder and runs when `main` is pushed.

Render:

- `render.yaml` describes one Docker web service called `kzn-doghouse`. It deploys from `develop` after the GitHub checks pass, and Render checks `/api/health` to see that it is running.
- The keys are not in the file. They are set in the Render dashboard as `Supabase__Url`, `Supabase__AnonKey`, `Supabase__ServiceRoleKey` and `GoogleMaps__EmbedApiKey`.
- It is on the free plan, so the first request after a quiet period can be slow.

---

## Team and Workflow

The work was split like this:

- Raheel: the foundation, login, roles and access control, shared layouts, and the deployment setup
- Akeev: the public website and the code behind it
- Avikar: the staff portal operations (dogs, medical, calendar, availability, fostering, inventory)
- Kaeden and Mohamed: the mobile app

Branches:

- `main`: the stable version
- `develop`: where finished work is joined together
- `test`: for testing the joined system before `main`
- `web-foundation`, `web-public`, `web-operations`, `mobile-core`, `mobile-features`: one branch per area of work

Everyone works on their own branch, opens a pull request into `develop`, and a teammate reviews it:

```text
member branch -> pull request -> review -> develop -> test -> main
```

Commit messages say what was done, for example `feat: add foster application form`, `fix: correct event visibility logic`, `test: add authentication tests` or `docs: update setup instructions`.

---

## Known Issues

We want to be upfront about what is not finished or does not fully match yet.

- The mobile app and the database setup do not fully match. The app calls five database functions (`current_profile_id`, `current_profile_info`, `register_device`, `get_profile_names` and `notify_event_created`) that are not in `schema.sql`, and the schema has no table for phone push tokens. The schema also gives logged-in users no direct table access, while the app reads tables directly. So a new Supabase project built only from `schema.sql` will not work with the app until those functions and access rules are added to the file.
- Mobile registration does not reach the volunteer approval list. The app sends `role: volunteer`, but the sign-up trigger now only looks at `volunteer_interest`, so app registrations become Public accounts with no pending request for an administrator.
- The mobile app is on `mobile-core` and `mobile-features`, not in `develop`. The two branches have drifted apart (for example they use different Android package names) and need to be merged.
- The app has no Forgot password feature, and push notifications are Android only.
- Contact messages can only be read in the Supabase Table Editor. There is no staff screen for them yet.
- The staff foster applications screen does not show the saved home and preference answers, only the applicant, dog, date and status.
- Some figures on the public pages came from the design and still need to be confirmed by the shelter (for example "800+ dogs" and "120 active volunteers"). The shelter's opening hours are not shown.
