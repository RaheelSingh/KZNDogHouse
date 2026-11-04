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

KZN Doghouse is a dog shelter that previously relied on paper records, Google Docs, spreadsheets and messages for much of its daily work. We built a digital platform to bring those records and activities together. It helps the shelter manage dogs, medical information, fostering, adoptions, volunteers, events, inventory and access to the system.

The platform has three connected parts:

- Public website: for visitors to learn about the shelter, view dogs and events, make enquiries and apply to foster
- Staff portal: for staff, administrators and authorised vets to manage the shelter's work. It is part of the same ASP.NET application as the public website
- Mobile app: an Android-focused app for approved volunteers and staff to view dogs, follow events, manage event participation and receive alerts

All three use the same Supabase project. The website handles its work through ASP.NET services and repositories, while the mobile app uses Supabase directly for many features and calls the ASP.NET API for certain actions.

---

## What the System Does

There are five user roles:

- Public: browses the website, creates an account and can submit a fostering application
- Volunteer: uses the mobile app after an administrator approves their volunteer request
- Staff: manages dogs, events and day-to-day shelter operations through the portal, with selected mobile tools
- Administrator: has staff access and can also manage accounts, volunteer requests, roles and vet access
- Vet: uses a separate web area to view and update the medical information of dogs they have been authorised to treat

The main areas of the system are:

- Dogs: profiles, photos, videos, status, vaccination and sterilisation information
- Medical care: records, notes, treatment status and supporting documents
- Fostering: public applications, review, signed agreements, placements and returns
- Adoptions: adopter details, agreements, confirmations and return history
- Volunteers: account approval, event applications, confirmed places, standby places and check-in
- Calendar and events: public and internal events, volunteer shifts and event details
- Inventory: items, deliveries, usage, adjustments, low-stock levels and expiry information
- Contact messages, notifications and user access management

KZN Doghouse has specific requirements for foster homes. The application asks about a fenced property, access to grass or daily walks on grass, someone being home day and night, and an indoor sleeping area for the dog.

---

## Technology

Website and API:

- ASP.NET Core MVC on .NET 10 (C#)
- Razor views, Bootstrap, CSS and JavaScript
- Controllers, services and repositories to keep the code organised
- xUnit and Moq for automated web tests

Mobile app:

- React Native with Expo (SDK 57) and TypeScript
- Expo Router for navigation
- Supabase JavaScript client, with Realtime updates on selected screens
- Expo Application Services (EAS) for Android builds

Backend services:

- Supabase: PostgreSQL database, authentication, file storage and Realtime
- Firebase Cloud Messaging: Android push notifications
- Supabase Edge Function: `send-push` for push delivery
- Render: hosting the website and API with Docker
- GitHub Actions: web build/tests and mobile checks
- Google Maps Embed: optional map on the Contact page

---

## Project Structure

```text
KZNDoghouse.sln
render.yaml
.github/workflows
  -> ci.yml (web build/tests and mobile checks)
  -> autograde.yaml (course autograder)

src/web/KZNDoghouse.Web
  -> Controllers (website, portal and REST API)
  -> Services (business rules and workflows)
  -> Repositories (database access)
  -> Models, DTOs, Constants, Helpers
  -> Views (public site, staff portal, vet area and authentication)
  -> Database/schema.sql (database tables and selected database functions/policies)
  -> wwwroot (styles, scripts and images)
  -> Dockerfile

src/mobile/kzndoghouse-app
  -> src/app (Expo Router screens)
  -> src/components, src/context, src/lib, src/types
  -> app.json, eas.json, package.json

supabase/functions/send-push (push notification Edge Function)
tests/web/KZNDoghouse.Web.Tests
tests/mobile/event-lifecycle-smoke.cjs
```

The website follows a controller, service and repository structure. The mobile app is different: many of its screens read or update Supabase directly using the signed-in user's session. This means the database's access policies and functions are an important part of mobile security, not just the rules in the website.

---

## How to Run the Project

### What you need

- Git
- .NET 10 SDK (check with `dotnet --version`)
- Node.js 22 and npm (for the mobile app)
- An Android phone or emulator (for the mobile app)
- Access to the configured KZN Doghouse Supabase project, or a Supabase project you have set up yourself
- Docker Desktop (optional)
- Access to the team's Expo/EAS project if you want to create native Android builds

### 1. Get the code

```bash
git clone https://github.com/EMKNDW/insy7315-g1-2026-wil-g1-project-st10321249.git
cd insy7315-g1-2026-wil-g1-project-st10321249
```

The final web and mobile source code is together in the uploaded `main` branch version. You do not need to switch to `mobile-core` to run the mobile app. The other branches are still part of the team's development history.

### 2. Set up Supabase

The simplest option is to use the team's existing Supabase project, with access provided by an administrator. It already contains database configuration that the mobile app expects.

For a separate project:

1. Create a Supabase project at supabase.com.
2. Read `src/web/KZNDoghouse.Web/Database/schema.sql` and take a backup before running it against an existing database. Use the Supabase SQL Editor to apply it.
3. Set up the remaining mobile database functions, permissions and storage policies needed by the app. **The checked-in `schema.sql` is not a complete, one-command setup for a brand-new mobile backend.** Some functions and access rules exist in the team's configured Supabase project rather than in that file.
4. In Supabase, copy the Project URL, the anon/publishable key and the service role key.
5. Create your first account and make it an Administrator through a trusted database administration process. Normal registration does not let people grant themselves staff or administrator access.

The schema includes the main application tables, sign-up handling, volunteer event functions and storage buckets for public media, private files, dog documents and videos. The mobile app also calls functions such as `current_profile_info`, `current_profile_id`, `register_device`, `deactivate_device`, `get_profile_names` and `check_in_to_event`. Those are not all defined in the checked-in schema. A fresh Supabase project needs the matching database setup before all mobile features will work.

Keep the service role key private. Only trusted server-side code should use it. Never add it to the mobile `.env` file or commit it to Git. The mobile app uses the Project URL and anon/publishable key, with access controlled by the user's session and database rules.

### 3. Run the website

```bash
cd src/web/KZNDoghouse.Web
dotnet user-secrets set "Supabase:Url" "https://your-project.supabase.co"
dotnet user-secrets set "Supabase:AnonKey" "your anon key"
dotnet user-secrets set "Supabase:ServiceRoleKey" "your service role key"
dotnet run
```

Open http://localhost:5210. The exact address is also shown in the terminal. User secrets are stored outside the project files.

You can check the application health endpoint at http://localhost:5210/api/health. It returns a JSON response showing that the API is running; it does not test every Supabase feature.

The Contact page can show a Google map if you also set `GoogleMaps:EmbedApiKey`. This is optional.

### 4. Run the tests

From the repository root:

```bash
dotnet test tests/web/KZNDoghouse.Web.Tests
```

The web tests cover areas such as dogs, public visibility, adoption and fostering workflows, volunteer event registration, inventory, calendar events, validation and API responses. Most use test data rather than a live Supabase connection.

For the mobile checks, first install the mobile dependencies as shown in Step 6, then run these commands from the mobile app folder:

```bash
npx tsc --noEmit
npx --yes expo-doctor@1.21.5
```

There is also a small event lifecycle test. Run this from the repository root after installing the mobile dependencies:

```bash
node tests/mobile/event-lifecycle-smoke.cjs
```

### 5. Run with Docker (optional)

From the repository root:

```bash
docker build -f src/web/KZNDoghouse.Web/Dockerfile -t kzn-doghouse-web .
docker run -p 10000:10000 -e Supabase__Url="https://your-project.supabase.co" -e Supabase__AnonKey="your anon key" -e Supabase__ServiceRoleKey="your service role key" kzn-doghouse-web
```

Open http://localhost:10000. This uses the same web Dockerfile as Render.

### 6. Run the mobile app

From the repository root:

```bash
cd src/mobile/kzndoghouse-app
npm ci --legacy-peer-deps
```

Copy `.env.example` to `.env` and fill in:

- `EXPO_PUBLIC_SUPABASE_URL`: the Supabase Project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: the anon/publishable key, **not** the service role key
- `EXPO_PUBLIC_API_BASE_URL`: the web API address used for role lookup and API-based features such as dog video uploads

If you run the website on your computer and test on a real phone, use an address your phone can reach. `localhost` on the phone refers to the phone itself, not your laptop. Dog video uploads require a reachable **HTTPS** API address.

Start the Expo development server:

```bash
npx expo start
```

You can use Expo Go for general screen testing, or open the app on an Android emulator. Expo Go does not support the app's remote push notification setup. For native Android functionality, use an EAS development or preview build, for example:

```bash
npx eas-cli build --profile development --platform android
```

You need access to the Expo project listed in `app.json`, and native push notifications also require working Firebase, Supabase token registration and Edge Function configuration. Push notifications are currently Android-only.

---

## Features

### Public website

Visitors can use the public pages without signing in. A signed-in account is needed to submit a foster application.

- Home: the shelter's story, featured dogs, the petition link and ways to help
- Our Dogs: public dog profiles with status and size filters, sorting, photos and individual dog pages. Uploaded dog videos can also be shown on their pages
- Foster: fostering information, requirements, frequently asked questions and an application form
- Get Involved: volunteer and support information, events and partnerships
- Events: public events, dates and category filters
- Contact: shelter information, a contact form and an optional map
- Login, Register, Forgot Password, Privacy and Account Deletion information

Only dogs approved for public display and events marked Public are shown on these pages. Internal dog records and medical details are handled separately. Foster applications are linked to the signed-in applicant and saved for staff review, while contact enquiries go into the staff inbox.

### Staff portal

Staff and Administrators sign in through the website and open the internal portal. The dashboard and sidebar give access to the main areas.

- Dogs: create and edit profiles, update status, add photos and videos, manage basic health information and view a dog's history
- Medical records: add treatment information and notes, attach supporting files, track active or resolved records and review medical alerts
- Fostering: review application answers, assign a dog, upload signed agreements, confirm or reject applications and record returns
- Adoptions: record adopter details, upload an agreement, confirm or cancel a placement and record a return where needed
- Calendar: create Public or Internal events, set volunteer sign-up details and manage event information
- Volunteers: review event applications and mark volunteers as Confirmed, Reserve (standby) or Declined, subject to the event's capacity
- Inventory: manage items, quantities, images, deliveries, usage and adjustments, with low-stock and expiry information
- Contact Inbox: read visitor messages and update their status
- Notifications: view alerts and mark or clear them
- Users & Access (Administrators only): manage roles and active accounts, approve or reject volunteer requests, and control vet permissions

Private dog files include medical attachments and signed foster/adoption documents. They are stored separately from public photos and videos, with access checked when files are requested.

### Vet area

Vets do not receive general staff portal access. They open a separate web area containing only dogs assigned to them by an Administrator. They can review relevant medical records, download authorised medical attachments and add medical records, including supporting documents.

### Mobile app

The current app is aimed at approved volunteers and Staff/Administrators on Android. It has five main tabs: Home, Dogs, Calendar, Alerts and Profile.

- Sign in and registration: two-step volunteer application, account approval checks and email-based password recovery
- Home: a view of the shelter's day, dog and event information, and the signed-in volunteer's next relevant shift or check-in
- Dogs: browse, search and filter dogs. Staff can add dog profiles, upload photos or a video, manage images and add permitted notes or medical records
- Calendar: browse events by week and category, see event details and volunteer shifts, and apply for an event or withdraw an application
- Event places: volunteers can see whether an application is Pending, Confirmed, on standby or Declined. Confirmed volunteers can check in when the event's check-in window opens
- Staff event tools: create or edit events, manage event details and remove a volunteer from an event where permitted
- Alerts: read, mark as read or clear notifications; supported push notifications can open the relevant screen
- Profile: view personal account information, event participation totals and sign out

The app uses Supabase Realtime and screen refreshes for selected updates. It also uses Supabase database functions for volunteer event actions and check-in. Those functions and policies must be present in the configured database for the screens to work correctly.

The older separate weekly availability feature still has models and API code in the repository, but it is not a tab in the current mobile app. The current volunteer experience centres on applying for scheduled events and shifts.

### REST API

The REST API runs inside the ASP.NET application. Most API responses use a `success`, `message` and `data` format.

- `GET /api/health`: public application health endpoint
- `GET /api/me`: looks up the signed-in user's profile and role from a Supabase Bearer token
- `/api/mobile/...`: protected endpoints for dogs, events, availability, notifications and event registration
- `POST /api/mobile/dogs/{dogId}/videos`: protected staff video upload endpoint

Most mobile screens use the Supabase client directly rather than calling all these REST endpoints. The API endpoints remain available for supported workflows and server-validated actions.

---

## Security

- Supabase Auth manages passwords and authentication. The website uses an HttpOnly cookie session after login, with an eight-hour expiry and sliding renewal.
- The web portal checks user roles on the server, not only by hiding buttons. Administrator and vet features have separate access checks.
- A public or pending volunteer cannot grant themselves an elevated role during registration. Mobile sign-in also checks for an approved, active account.
- Web login, registration, password reset and API requests have rate limits. The site uses anti-forgery protection for form submissions.
- The site uses HTTPS redirection and security headers, with HSTS outside Development.
- Private medical and document access is restricted by role and dog authorisation. Mobile direct database access also depends on properly configured Supabase Row Level Security and database functions.
- The service role key is kept on the server. Mobile code uses only client-safe configuration values.
- The web project includes audit logging for authenticated changes, but the matching database audit routines must also be installed for those records to be stored.

---

## Testing and Deployment

Tests and checks:

- Automated .NET tests cover the web services, controllers and important business rules.
- A GitHub Actions workflow builds and tests the web project, checks mobile TypeScript and runs Expo Doctor.
- The mobile repository also contains an event lifecycle smoke test for event status and check-in timing rules.
- Native Android behaviour, push notifications and integrations with the live Supabase project still need device and service-level testing. Source code checks alone cannot verify these external services.

GitHub Actions:

- `.github/workflows/ci.yml` runs for pushes and pull requests involving `develop`, `test`, `main` and `web-foundation`.
- `.github/workflows/autograde.yaml` runs the course autograder on pushes to `main` and on `submit/*` tags.

Render:

- `render.yaml` defines the `kzn-doghouse` Docker web service, with `main` as the deployment branch.
- Render checks `/api/health` and can deploy after the required checks pass.
- Supabase and Google Maps values are configured in the Render environment, not stored as working secrets in the repository.
- The configuration uses Render's free plan, so a site that has been idle may take longer to respond on the first request.

Android builds:

- `eas.json` contains development and preview APK build profiles, plus a production build profile.
- The app is connected to the team's Expo/EAS project and has Android Firebase configuration.
- The Android release workflow uses EAS builds and Google Play Console. Internal testing and signed build configuration should not be confused with a public Play Store release.

---

## Team and Workflow

The main areas of work were divided as follows:

- Raheel: web foundation, authentication and access, shared styling, Google Maps, Supabase and Render integration
- Akeev: the public website pages and related features
- Avikar: staff portal operations, including dogs, fostering, events, volunteers and inventory
- Kaeden: mobile app structure, navigation and core screens
- Mohamed: mobile authentication, Supabase integration, notifications and other mobile features

Branches used during development:

- `main`: the final integrated branch in the uploaded project
- `develop`: shared integration work during development
- `test`: testing changes before release
- `web-foundation`, `web-public`, `web-operations`, `mobile-core`, `mobile-features`: work split by area

We developed features on separate branches, used pull requests to combine changes and checked the integrated system before moving changes into `main`.

Commit messages describe the work done, for example `feat: add foster application form`, `fix: correct event visibility logic`, `test: add authentication tests` or `docs: update setup instructions`.

---

## Known Issues

The project is substantially more complete than it was in Part 2, but there are still a few setup and release limitations worth knowing about:

- **A fresh Supabase installation needs additional setup.** `schema.sql` includes the main tables and several important fixes, but it does not include every function, grant, policy and audit routine used by the configured project. In particular, mobile profile lookup, device registration, participant names and event check-in depend on database functions that are not all defined in that file. The app should not be described as ready to run against an empty Supabase project without those additions.
- **Mobile availability has changed from the original design.** There is no separate weekly availability screen in the current mobile navigation. Volunteers currently use event applications, confirmed places, standby places and scheduled shifts. Older availability services and API endpoints are still in the code.
- **Push notifications need external configuration.** Android push requires a native build, Firebase setup, token registration and the deployed `send-push` function. Push is not supported through Expo Go, and iOS push is not part of this release.
- **Some mobile operations require the web API.** In particular, dog video uploads need `EXPO_PUBLIC_API_BASE_URL` set to a reachable HTTPS endpoint.
- **Distribution is Android-focused.** EAS and Google Play build/testing configuration is present, but the repository alone does not prove that the app has been publicly published or that an iOS release has been tested.
- **Some displayed shelter information needs owner confirmation.** Any public statistics, contact details, opening times or other shelter-supplied content should be checked with KZN Doghouse before wider release.

The source code, deployed database, native build configuration and external services all need to match for the complete system to work. The README describes the uploaded source, not a guarantee that every external deployment setting has been independently tested.
