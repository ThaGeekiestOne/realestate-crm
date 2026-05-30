create extension if not exists pgcrypto;

insert into organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'EstateFlow Demo Realty')
on conflict (id) do nothing;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'admin@estateflow.local', crypt('estateflow123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'riya@estateflow.local', crypt('estateflow123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'kabir@estateflow.local', crypt('estateflow123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000104', 'authenticated', 'authenticated', 'aditi@estateflow.local', crypt('estateflow123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000105', 'authenticated', 'authenticated', 'neha@estateflow.local', crypt('estateflow123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users
where email like '%@estateflow.local'
on conflict (provider_id, provider) do nothing;

insert into profiles (id, organization_id, full_name, role, phone)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Arjun Malhotra', 'admin', '+919876500000'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Riya Kapoor', 'sales_manager', '+919876500001'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Kabir Singh', 'sales_agent', '+919876500002'),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'Aditi Verma', 'field_executive', '+919876500003'),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'Neha Mehra', 'social_media_manager', '+919876500004')
on conflict (id) do nothing;

insert into team_members (organization_id, profile_id, availability_status)
select organization_id, id, case when role in ('sales_manager', 'sales_agent') then 'available' else 'offline' end
from profiles
where organization_id = '00000000-0000-4000-8000-000000000001'
on conflict (organization_id, profile_id) do nothing;

insert into lead_sources (organization_id, name)
select '00000000-0000-4000-8000-000000000001', source
from unnest(array['36 Acre', 'MagicBricks', 'Housing', 'Facebook', 'Instagram', 'Website', 'Referral', 'Manual', 'Other']) as source
on conflict (organization_id, name) do nothing;

insert into leads (
  id, organization_id, assigned_agent_id, full_name, phone, email, source,
  property_type, budget_min, budget_max, preferred_location, status, temperature, notes
)
select
  uuid_generate_v5('00000000-0000-4000-8000-000000000001', 'lead-' || lead_number),
  '00000000-0000-4000-8000-000000000001',
  case when lead_number % 2 = 0 then '00000000-0000-4000-8000-000000000102'::uuid else '00000000-0000-4000-8000-000000000103'::uuid end,
  'Sample Buyer ' || lead_number,
  '+91990000' || lpad(lead_number::text, 4, '0'),
  'buyer' || lead_number || '@example.com',
  (array['36 Acre', 'MagicBricks', 'Housing', 'Facebook', 'Instagram', 'Website', 'Referral'])[1 + ((lead_number - 1) % 7)],
  (array['Apartment', 'Villa', 'Plot', 'Commercial', 'Rental'])[1 + ((lead_number - 1) % 5)],
  5000000 + lead_number * 250000,
  7500000 + lead_number * 350000,
  (array['Golf Course Road', 'Sohna Road', 'Dwarka Expressway', 'New Gurgaon'])[1 + ((lead_number - 1) % 4)],
  (array['New', 'Contacted', 'Interested', 'Site Visit Scheduled', 'Negotiation'])[1 + ((lead_number - 1) % 5)],
  (array['Cold', 'Warm', 'Hot'])[1 + ((lead_number - 1) % 3)],
  'Seeded lead for local development.'
from generate_series(1, 20) as lead_number
on conflict (id) do nothing;

insert into properties (
  id, organization_id, title, location, property_type, price,
  availability_status, description, bedrooms, bathrooms, units_available
)
select
  uuid_generate_v5('00000000-0000-4000-8000-000000000001', 'property-' || property_number),
  '00000000-0000-4000-8000-000000000001',
  'EstateFlow Residence ' || property_number,
  'Sector ' || (60 + property_number) || ', Gurgaon',
  (array['Apartment', 'Villa', 'Plot', 'Commercial'])[1 + ((property_number - 1) % 4)],
  7000000 + property_number * 900000,
  case when property_number % 4 = 0 then 'Hold' else 'Available' end,
  'Seeded inventory record for matching and sharing.',
  case when property_number % 4 = 3 then null else 2 + (property_number % 3) end,
  case when property_number % 4 = 3 then null else 2 + (property_number % 2) end,
  1 + (property_number % 5)
from generate_series(1, 10) as property_number
on conflict (id) do nothing;

insert into followups (organization_id, lead_id, assigned_to, due_at, channel, notes)
select organization_id, id, assigned_agent_id, now() + (row_number() over (order by created_at)) * interval '45 minutes', 'whatsapp', 'Seeded follow-up reminder.'
from leads
where organization_id = '00000000-0000-4000-8000-000000000001'
order by created_at
limit 6;

insert into attendance (organization_id, user_id, check_in_time, status, notes)
select organization_id, id, now() - interval '2 hours', 'present', 'Seeded office check-in.'
from profiles
where organization_id = '00000000-0000-4000-8000-000000000001'
on conflict do nothing;

insert into social_posts (organization_id, assigned_to, post_type, title, caption, status, scheduled_at)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000105', 'Instagram Reel', 'Palm Heights walkthrough', 'Step inside a ready-to-move 3 BHK in Sector 77.', 'scheduled', now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000105', 'Instagram Post', 'Weekend site visit guide', 'Three things to check before your next site visit.', 'draft', now() + interval '2 days');

insert into tasks (id, organization_id, lead_id, assigned_to, title, task_type, due_at, notes, metadata)
select
  uuid_generate_v5('00000000-0000-4000-8000-000000000001', 'site-visit-' || leads.id),
  leads.organization_id,
  leads.id,
  '00000000-0000-4000-8000-000000000104',
  'Site visit: ' || leads.full_name,
  'site_visit',
  now() + interval '4 hours',
  'Confirm pickup details and add field notes after the walkthrough.',
  jsonb_build_object('location', leads.preferred_location)
from leads
where leads.organization_id = '00000000-0000-4000-8000-000000000001'
order by leads.created_at
limit 2
on conflict (id) do nothing;
