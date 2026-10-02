# KZN Doghouse Digital Platform

## INSY7315 Work Integrated Learning Project

This repository contains the development work for the KZN Doghouse Digital Platform created by **Hextech Solutions** as part of the INSY7315 Work Integrated Learning module.

The project is being developed for KZN Doghouse to help replace a number of their current manual processes with a central digital system.

The development team consists of:

- Raheel Singh
- Kaeden Samsunder
- Akeev Sivai
- Avikar Maharaj
- Mohamed Shaheer Joosab

---

## Project Overview

KZN Doghouse currently makes use of a combination of paper records, Google Docs, spreadsheets and manual communication to manage many of their daily operations.

This includes areas such as:

- Dog records
- Medical information
- Fostering
- Volunteer management
- Inventory
- Events
- Calendars
- User access

The aim of this project is to create a connected digital platform that allows this information to be managed more efficiently while also controlling which users are able to access different information.

The overall platform consists of three main parts:

1. A public website
2. An internal management system
3. A mobile application

The public website and internal system will be developed using ASP.NET Core MVC.

The mobile application will be developed using React Native with Expo.

Both applications will use the same backend services and database so that information stays consistent across the platform.

---

## Main Parts of the System

### Public Website

The public website will allow visitors to view information that KZN Doghouse has approved for public access.

This may include:

- Available dogs
- Basic dog profiles
- Public events
- Foster information
- Foster applications
- Ways to get involved
- Contact information

Some functions, such as managing a foster application, may require the user to create an account and sign in.

Sensitive information such as medical records and internal shelter information will not be shown through the public website.

---

### Internal Management System

The internal management system will be used by authorised users such as staff, administrators and approved vets.

The system will provide functions for areas such as:

- Dog management
- Medical records
- Foster applications
- Foster placements
- Volunteer availability
- Events
- Calendar management
- Inventory
- Notifications
- User and role management

The information and actions available to a user will depend on their role.

---

### Mobile Application

The mobile application is mainly intended for staff and volunteers.

Planned mobile features include:

- Signing in
- Viewing dog information
- Viewing schedules
- Viewing events
- Volunteer availability
- Event registration
- Notifications
- User profiles

The mobile application will communicate with the same ASP.NET Core backend through REST API endpoints.

---

## User Roles

The system currently has five main user roles.

### Public

Public users can browse information intended for the public.

A registered Public account may also be used where authentication is required, such as for foster applications.

### Volunteer

Volunteers will mainly use the mobile application.

They will be able to perform functions such as:

- Submit availability
- View approved availability
- Register for events
- View schedules
- Receive notifications
- Access permitted dog information

### Staff

Staff are responsible for normal shelter operations.

Their functions may include:

- Managing dog records
- Updating medical information
- Managing events
- Reviewing volunteer availability
- Managing foster applications
- Managing inventory
- Managing calendar entries

### Administrator

Administrators have the same general access as Staff but also have additional system-management permissions.

This includes areas such as:

- Managing user accounts
- Assigning roles
- Managing system access

### Vet

Approved vets will only be given access to the medical information required for dogs they have been authorised to treat.

They should not have access to unrelated shelter information.

---

## Foster Program Context

The foster programme provides temporary care for dogs and puppies.

Fostering may take place for different periods depending on how long a foster parent is available.

Important requirements for foster applicants include:

- The property should be fully fenced.
- There should preferably be grass on the property.
- If grass is not available, the dog must be taken for daily walks on grass.
- Someone should be available during the day and night to monitor the dog or puppy.
- The dog or puppy must have an indoor sleeping arrangement.

Foster periods are flexible and are intended to work around the foster parent's availability.

KZN Doghouse may provide foster parents with the essentials required to care for the dog.

Examples include:

- Food
- Blankets
- Chicken
- Flea medication
- Dewormer
- Other required dog-care items

The system should therefore be able to record the suitability of a foster home as well as the expected foster period.

---

## Dog Records

Dog records form one of the main parts of the system.

Dogs currently in foster care are still considered part of the dogs under the care of KZN Doghouse.

Dog records may include:

- Name
- Breed
- Age
- Gender
- Size
- Weight
- Date received
- Intake information
- Backstory
- Current status
- Vaccination information
- Sterilisation information
- Health conditions
- Medical notes
- General notes
- Current care arrangement

The system should calculate information such as the number of dogs currently in care using the database instead of relying on fixed values.

### Dogs Temporarily Housed for Owners

KZN Doghouse may also house dogs temporarily for another owner.

When this applies, the system may need to store:

- Original owner information
- Date the dog was received
- Expected housing period
- Expected return date
- Actual return date
- Additional notes

This should remain separate from normal rescue or foster information where necessary.

---

## Medical Records

KZN Doghouse currently keeps physical vet cards and also records medical information within dog profiles.

The digital platform will store medical information against the relevant dog.

Medical records may include:

- Vaccinations
- Vaccination dates
- Sterilisation
- Health conditions
- Medication
- Treatment
- Vet visits
- Medical notes

Medical information is considered protected information.

Access will therefore depend on the role of the signed-in user.

Approved vets should only be able to access medical information for dogs they have specifically been authorised to treat.

---

## Volunteer Program

KZN Doghouse allows volunteers from different age groups to assist at the shelter.

The type of work given to volunteers may depend on their age and what activities are suitable for them.

Volunteer activities may include:

- Bathing dogs and puppies
- Socialising with dogs
- Yard cleanup
- Kennel or cage cleanup
- Fundraising assistance
- Selling fundraising items
- Event setup
- Event cleanup
- Saturday activities
- General shelter assistance

Volunteers may help during the week, on weekends and during school holidays.

KZN Doghouse may also provide certificates of participation to volunteers.

Because of this, the system should eventually be able to keep a record of volunteer participation and activities.

---

## Inventory

KZN Doghouse currently records inventory manually and updates it periodically.

The new system will allow inventory to be managed digitally.

There are two main types of inventory.

### Shelter Inventory

Examples include:

- Dog bowls
- Blankets
- Medication
- Dog food
- Dog shampoo
- Cleaning supplies
- Other dog-care items

### Fundraising Inventory

Examples include:

- Clothing merchandise
- Dog toys
- Dog accessories
- Food
- Drinks
- Food stall items

The inventory system is expected to support information such as:

- Item name
- Category
- Quantity
- Deliveries
- Usage
- Adjustments
- Expiry dates where relevant
- Low-stock thresholds
- Staff member responsible for a stock change

Inventory categories should be flexible so that new types of items can be added later.

---

## Events and Calendar

Staff will be able to create and manage events and calendar entries.

Calendar entries may be either:

- Public
- Private

Public events can be shown through the public website.

Private events should only be visible to authorised internal users.

Volunteers will also be able to register for appropriate events through the mobile application.

---

## Technology Stack

### Web Application

The web application will use:

- ASP.NET Core MVC
- C#
- HTML
- CSS
- JavaScript

The same ASP.NET Core application will contain the public-facing website, internal management interface and REST API.

### Mobile Application

The mobile application will use:

- React Native
- Expo
- JavaScript or TypeScript

The application is intended to support both Android and iOS.

### Database and Authentication

Supabase will be used for:

- PostgreSQL database
- Authentication
- File and image storage

PostgreSQL was selected because the system contains many related records such as dogs, users, medical records, events, volunteers, fostering and inventory.

### Notifications

Firebase Cloud Messaging will be used for mobile push notifications.

### Hosting

The ASP.NET Core application and API are planned to be hosted using Render.

### Version Control and CI/CD

GitHub will be used for source control.

GitHub Actions will later be used for automated build and testing workflows.

Deployment automation will also be added during development.

---

## Repository Structure

The repository is being kept as a single repository so that the web application, mobile application and supporting development work remain together.

The initial structure is:

```text
src/
  web/
  mobile/

README.md
.gitignore
.env.example
```

### `src/web`

This folder will contain:

- Public website
- Internal management system
- ASP.NET Core backend
- REST API

### `src/mobile`

This folder will contain the React Native Expo mobile application.

Additional folders such as automated tests and GitHub workflows will be added when those parts of development begin.

---

## Team Development Split

The development work has been divided between the web and mobile applications.

### Web Team

The web team consists of:

- Raheel Singh
- Akeev Sivai
- Avikar Maharaj

Raheel will mainly focus on the initial system foundation, backend work, authentication, role-based access control and shared frontend structure.

Akeev will mainly focus on the public-facing website and the backend functionality required by those features.

Avikar will mainly focus on the internal operations portal and its supporting backend functionality.

All web members are expected to contribute to both frontend and backend development.

### Mobile Team

The mobile team consists of:

- Kaeden Samsunder
- Mohamed Shaheer Joosab

The two members will divide the mobile application work between them.

Both members should contribute to mobile frontend functionality as well as relevant backend or API integration.

---

## Branching Strategy

The repository will contain three main shared branches.

### `main`

Contains the stable version of the application.

Code should only reach `main` after it has been integrated and tested.

### `develop`

This is the main development integration branch.

Completed work from member branches will first be merged into `develop`.

### `test`

The `test` branch will be used to test the combined system before changes are moved to `main`.

The main flow is:

```text
member branch -> develop -> test -> main -> deployment
```

Each member will also have a branch based on the area they are working on.

### Web Branches

- `web-foundation`
- `web-public`
- `web-operations`

### Mobile Branches

- `mobile-core`
- `mobile-features`

Branch names describe the work being completed rather than the name of the team member.

---

## Branch Responsibilities

### `web-foundation`

Mainly maintained by Raheel.

This branch will initially contain work such as:

- ASP.NET Core project setup
- Shared application structure
- Supabase configuration
- Authentication
- Login
- Registration where required
- Role-based access control
- Shared layouts
- Shared styling
- Common backend services
- Common DTO and repository structure
- General validation and error handling

### `web-public`

Mainly maintained by Akeev.

Planned areas include:

- Home page
- Dogs page
- Public dog profiles
- Foster information
- Foster applications
- Events
- Get involved page
- Contact page
- Supporting controllers
- Supporting services
- Supporting database access

### `web-operations`

Mainly maintained by Avikar.

Planned areas include:

- Internal dashboard
- Calendar
- Event management
- Volunteer availability review
- Inventory
- Low-stock alerts
- Notifications
- Supporting backend services
- Supporting database functionality

### `mobile-core` and `mobile-features`

Maintained by Kaeden and Mohamed.

These branches will contain the mobile screens, application logic and required API integration.

The exact mobile feature split may be adjusted as development continues.

---

## Development Workflow

Before beginning work, members should make sure their local branch is up to date with `develop`.

Development should normally follow this process:

```text
develop
-> member branch
-> development work
-> commit changes
-> push branch
-> pull request
-> review
-> develop
```

Changes should not normally be committed directly to `main`.

Members should also avoid working directly on another person's assigned branch unless the team agrees that it is required.

When another member completes a shared feature that is needed elsewhere, that work should first be merged so that other branches can update from the shared development branch.

---

## Commit Messages

Commit messages should briefly explain the work completed.

Examples include:

```text
feat: add foster application form

feat: implement inventory transaction service

fix: correct event visibility logic

test: add authentication tests

style: add shared public site layout

docs: update project setup instructions

chore: configure project structure
```

Commits should represent meaningful pieces of work.

The aim is for each team member to have a clear Git history showing their contribution to the project.

---

## Security

Security is important because the application will contain both public and private information.

The project will use authentication and role-based access control to limit access to protected functions.

Some examples include:

- Public users must not have access to internal dog information.
- Volunteers must not have access to protected medical information.
- Staff should only have access to functions required for shelter operations.
- Administrators will have additional user-management permissions.
- Vets will only access authorised medical records.

The project should also make use of:

- Input validation
- HTTPS
- Secure authentication
- Protected API endpoints
- Role-based authorisation
- Safe database access
- Error handling
- Secure storage of configuration values

Passwords will not be stored directly by the application.

Supabase Authentication will be responsible for account authentication.

---

## Environment Variables and Secrets

Passwords, API keys and private credentials must not be committed to GitHub.

The repository contains an `.env.example` file showing the types of environment values that may be required.

Actual values must be stored locally or through the environment settings of the hosting platform.

Examples include:

- Supabase URL
- Supabase public key
- Supabase server credentials
- API base URL
- Firebase configuration

Private server credentials must never be exposed through the public website or mobile application.

---

## Public Website (`web-public`)

This section describes the public-facing website built on the `web-public` branch and how to run it.

### Pages

| Route | Page | Notes |
|---|---|---|
| `/` | Home | Mission, statistics, newest dogs, ways to help |
| `/our-dogs` | Meet the Dogs | Size and status filters, sorting, "Load more dogs" |
| `/our-dogs/{id}` | Dog Details | Public profile, adoption and foster links |
| `/foster` | Foster | Programme information, process, requirements, FAQ |
| `/foster/apply` | Foster application | Requires a signed-in account |
| `/get-involved` | Get Involved | Ways to help, upcoming events, partnerships |
| `/events` | Events | Upcoming and past public events, category filter |
| `/contact` | Contact | Contact form and shelter details |

### What the public can see

- Dogs: only dogs with the status Available or Fostered are shown. Pages receive small public view models, so internal fields such as kennel location, intake details and who created a record never reach the browser.
- Events: only events with Public visibility are shown. Times are displayed exactly as staff entered them in the calendar.

### How the public features save data

- Foster applications are saved into the existing `foster_applications` table and are linked to the signed-in applicant. The home and preference answers are stored as text in `application_details`. An applicant can have only one open application (Submitted or Under Review) at a time.
- Contact messages are saved into the `contact_messages` table. A hidden field acts as a spam trap, and messages are never saved when it is filled in.
- All forms are validated on the server as well as in the browser, and every form uses an anti-forgery token.

### Running the website locally

Add the Supabase values to .NET User Secrets (never commit them):

```text
dotnet user-secrets set "Supabase:Url" "<project url>" --project src/web/KZNDoghouse.Web
dotnet user-secrets set "Supabase:AnonKey" "<anon or publishable key>" --project src/web/KZNDoghouse.Web
dotnet user-secrets set "Supabase:ServiceRoleKey" "<service role or secret key>" --project src/web/KZNDoghouse.Web
```

Then start the site:

```text
dotnet run --project src/web/KZNDoghouse.Web
```

### Database setup for the public features

Run the `contact_messages` section at the end of `src/web/KZNDoghouse.Web/Database/schema.sql` once in the Supabase SQL Editor. Until it exists, the contact form shows a message asking visitors to email the shelter instead.

### Running the tests

```text
dotnet test tests/web/KZNDoghouse.Web.Tests
```

### Styling

The public theme is applied through the `public-body` class on the public layout, so the staff portal keeps its own appearance. Fonts (Archivo, Inter, Fraunces and IBM Plex Mono) are loaded from Google Fonts.

### Still to complete before release

- Replace the placeholder logo (`wwwroot/images/logo-placeholder.svg`) and the labelled photo and map placeholders with the final images.
- Add the petition link; the "Sign the Petition" button is disabled until a link is available.
- Confirm the figures and stories shown on the Home, Foster and Get Involved pages.
- Confirm the shelter opening hours, which are not currently shown.
- Terms and Privacy Policy appear as plain text because those pages do not exist yet.
- Contact messages can currently be read in the Supabase table editor; a staff screen for them has not been built.
- The staff foster-application screen does not yet display the saved `application_details` text.

## Current Project Stage

Part 1 of the project focused on planning and design.

This included areas such as:

- Requirements
- User roles
- User stories
- System design
- Database planning
- Architecture
- Security
- DevOps planning
- Prototypes

The project is now moving into implementation.

The first stage of implementation is setting up the shared repository and project structure so that all team members can begin development from the same base.

The web foundation will then be created before the larger web features are divided between the web development team.

The mobile team will work within the same repository using the mobile application folder.

---

## Project Goal

The final goal is to provide KZN Doghouse with a working digital platform that centralises information currently managed through a number of manual systems.

The platform should make day-to-day shelter operations easier while also improving the consistency, accessibility and security of important information.

The system is intended to support both the organisation's current needs and possible future growth.
