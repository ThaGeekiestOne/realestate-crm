# EstateFlow CRM

Mobile-first real estate sales CRM built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase. The current phase provides Supabase email/password authentication, organization-aware RLS reads, property-photo storage, public property share pages, persistent local demo workflows, tenant-aware database migrations, local seed data, a validated lead intake webhook, and dry-run adapters for calls, messages, email, attendance, and social publishing.

## Getting Started

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). When the public Supabase values are blank, the UI opens in local demo mode and stores interactive prototype changes in browser storage. When they are configured, the app requires a Supabase email/password session, loads the signed-in organization's leads, properties, and follow-ups through RLS, and persists manual lead creation, property creation, follow-up scheduling, and follow-up completion. Provider credentials are optional locally because `TWILIO_DRY_RUN=true` by default.

## Available Commands

```bash
npm run dev     # Start local development
npm run lint    # Run ESLint
npm run build   # Create the production build
npm run start   # Serve the production build
```

## Lead Webhook

External lead providers can submit enquiries to `POST /api/webhooks/leads`.

```bash
curl -X POST http://localhost:3000/api/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $LEAD_WEBHOOK_SECRET" \
  -d '{"fullName":"Rahul Sharma","phone":"+919999999999","source":"36 Acre","propertyType":"Apartment","preferredLocation":"Gurgaon"}'
```

With Supabase values configured, the route validates the optional webhook secret, assigns an available agent through the database round-robin function, stores the lead, starts the bridge-call adapter, and logs the call, activity, and notification. Without Supabase values it returns a dry-run response for local UI development.

## Twilio Voice Bridge

Keep `TWILIO_DRY_RUN=true` while developing locally. To enable real calls:

1. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`.
2. Set `NEXT_PUBLIC_APP_URL` to the public HTTPS deployment or tunnel URL that Twilio can reach.
3. Set `TWILIO_DRY_RUN=false`.
4. Keep `TWILIO_VALIDATE_SIGNATURES=true` so callback routes reject unsigned requests.
5. Set `TWILIO_MAX_AGENT_ATTEMPTS` to control how many available agents are tried before the lead enters the manual follow-up queue.

The lead webhook creates a call log before dialing the agent. Twilio then calls the generated `/api/twilio/voice/*` callback URLs to gather agent confirmation, dial the lead, join both parties into a recorded conference, and persist status, duration, and recording URL. If an agent is unavailable, the service retries the next round-robin agent before creating a missed-call follow-up and notifying managers.

## Property Photos And Sharing

The `property-media` and `property-documents` Supabase Storage buckets are created by migration and allow public reads while restricting uploads, updates, and deletes to the signed-in organization folder. Property creation accepts multiple photos plus brochures, floor plans, and payment schedules when Supabase is configured.

From a lead drawer, choose **Property**, select a listing, and send a public tokenized share page via WhatsApp, SMS, or email. The protected `/api/property-shares` route validates the session, enforces organization ownership for the lead and property, dispatches through Twilio or Resend, and records the message and activity timeline event. Dry-run modes generate share records and provider IDs without sending external messages.

## Inventory Operations

The inventory workspace supports structured property creation, search, status/type/location filters, property detail drawers, photo galleries, brochure lists, availability updates, and protected deletion with Storage cleanup. Admins and sales managers can update inventory through `/api/properties/actions`; other organization members retain read access. Inventory cards calculate matching lead counts, and the lead drawer ranks shareable properties by type, location, and budget fit. Public tokenized property pages expose uploaded brochures alongside photos and listing details.

## One-Click Follow-Ups

The follow-up queue supports reusable message templates, one-click WhatsApp, SMS, and email dispatch, call reminders, 30-minute snoozes, and completion. The protected `/api/followups/actions` route validates the signed-in workspace, sends through the server-side provider adapters, and records message and activity audit entries. Dry-run mode keeps the full workflow usable without provider credentials.

## Notifications

The header bell opens a responsive in-app notification center with unread counts, per-item read actions, mark-all, and an empty state. Live sessions load user-addressed notifications from the protected `/api/notifications` route. Lead assignment, missed calls, scheduled follow-ups, site visits, and property sharing feed the notification table; demo mode persists the same read workflow in browser storage.

## Lead Operations

The lead drawer supports qualification changes, hot-lead marking, note updates, sales-agent reassignment, and tenant-scoped activity history. Its **Call now** action uses the protected `/api/leads/actions` route to create a call log before starting the Twilio bridge adapter. The same route loads calls, messages, follow-ups, property shares, and activity records into the lead timeline. Demo mode simulates the call and keeps lead edits in browser storage.

The lead list supports search plus status, source, assigned-agent, temperature, and created-today filters. Live Supabase reads are role-aware: admins and sales managers can operate across the organization, while sales agents can read and update only their assigned leads and follow-up queue rows. Protected lead actions and property sharing apply the same assigned-lead rule server-side.

## Employee Attendance

The attendance workspace captures browser GPS coordinates for check-in and check-out, accepts optional field notes and private selfie evidence, shows personal attendance history, and summarizes the current organization team. The protected `/api/attendance` route validates the signed-in workspace before reading or updating tenant-scoped attendance rows and logs attendance activity events. The private `attendance-media` bucket restricts uploads to the signed-in user's organization folder. Demo mode stores the same workflow locally in browser storage.

## Social Media Calendar

The social media workspace stores tenant-scoped drafts and schedules, uploads post assets to the `social-media` bucket, supports internal publishing notes, and provides an AI caption helper. The protected `/api/social-posts` route handles calendar reads, draft creation, caption updates, and publish actions. Publishing runs in dry-run mode unless `SOCIAL_PUBLISH_DRY_RUN=false` and `SOCIAL_PUBLISH_WEBHOOK_URL` points to a Zapier, Make, SocialPilot, Buffer, or custom automation endpoint.

## Dashboard And Reports

Dashboard metrics and reports are derived from the active workspace instead of fixed placeholders. Live Supabase sessions load tenant-scoped lead, call, follow-up, property-share, attendance, inventory, and recent-activity analytics through RLS. Reports include lead sources, pipeline status, agent call performance, follow-up completion, property sharing, won/lost totals, conversion, available inventory, and attendance counts. Demo mode computes the same views from browser-stored workspace records.

## Team Management

The Team workspace loads organization members and assigned-lead counts from the protected `/api/team-members` route. Organization admins can invite members by email, add their role and phone number, and update role or availability from the CRM. Invitations use Supabase Auth through the server-only service-role client; the browser never receives `SUPABASE_SERVICE_ROLE_KEY`. Demo mode stores the same changes locally without sending invitation emails.

## Workspace Settings

The protected `/api/settings` route persists organization name, lead assignment mode, provider sender values, social publishing webhook URL, and dry-run flags. Admins can choose round-robin, manual, or least-busy assignment. Provider credentials remain server-side environment variables: the browser receives only provisioned or missing status and never receives Twilio tokens, Resend keys, webhook secrets, or OpenAI-compatible API keys.

## Project Layout

- `src/components/crm-app.tsx`: responsive product interface and interactions.
- `src/lib/`: shared types and seeded prototype data.
- `src/services/`: organization data reads plus provider-independent call, message, email, property-share, attendance, social-publish, and lead-assignment adapters.
- `src/app/api/webhooks/leads/`: public lead intake route.
- `src/app/api/leads/actions/`: protected lead qualification, timeline, and bridge-call route.
- `src/app/api/properties/actions/`: protected inventory update and deletion route.
- `src/app/api/notifications/`: protected in-app notification feed and read-state route.
- `src/app/api/team-members/`: protected admin team invitation and role-management route.
- `src/app/api/settings/`: protected organization and provider-adapter settings route.
- `supabase/migrations/`: organization-aware schema and Row Level Security starter.

## Supabase

Create a Supabase project, add the values from `.env.example`, and apply the SQL migrations in `supabase/migrations/`. For a local Supabase project:

```bash
supabase db reset
```

The reset applies both migrations and `supabase/seed.sql`. Seeded local users use the password `estateflow123`; for example, sign in as `admin@estateflow.local`. Replace seeded credentials outside local development.

## Deployment

Deploy to Vercel as a standard Next.js project. Add the `.env.example` values as Vercel environment variables and keep provider secrets server-side.

## Install On Android

Deploy the app to an HTTPS URL, open it in Chrome on Android, then use **Install app** or **Add to Home screen** from the browser menu. The installed PWA opens in its own app window and includes a cached shell for basic offline startup. Local `http://localhost` is suitable for development checks, but installation on a phone requires an HTTPS deployment.
