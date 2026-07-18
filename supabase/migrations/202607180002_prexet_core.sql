-- Prexet application schema. Because Better Auth owns identity instead of
-- Supabase Auth, browser clients do not query these tables directly. RLS is
-- enabled without client policies and all access goes through authenticated
-- Prexet server endpoints.

create table if not exists public.prexet_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.prexet_users(id) on delete restrict,
  name text not null,
  reference text not null unique,
  due_date date,
  workflow_round text not null default 'Setup',
  summary text not null default '',
  guardrails jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prexet_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.prexet_projects(id) on delete cascade,
  user_id uuid not null references public.prexet_users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists public.prexet_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.prexet_projects(id) on delete cascade,
  name text not null,
  position integer not null check (position >= 0),
  unlock_after_stage_id uuid references public.prexet_stages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, position)
);

create table if not exists public.prexet_parties (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.prexet_projects(id) on delete cascade,
  stage_id uuid references public.prexet_stages(id) on delete set null,
  name text not null,
  company text not null default '',
  email text not null,
  status text not null default 'pending' check (status in ('attention', 'pending', 'accepted', 'no_response')),
  last_touch_at timestamptz,
  edit_summary text not null default '',
  ai_position text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, email)
);

create table if not exists public.prexet_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.prexet_projects(id) on delete cascade,
  stage_id uuid references public.prexet_stages(id) on delete set null,
  uploaded_by_user_id uuid references public.prexet_users(id) on delete set null,
  parent_document_id uuid references public.prexet_documents(id) on delete set null,
  kind text not null default 'form' check (kind in ('form', 'returned', 'redline', 'final', 'supporting')),
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null default 0 check (byte_size >= 0),
  storage_bucket text not null default 'prexet-documents',
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.prexet_email_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.prexet_projects(id) on delete cascade,
  stage_id uuid not null references public.prexet_stages(id) on delete cascade,
  name text not null,
  subject text not null,
  body_html text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, name)
);

create table if not exists public.prexet_mailbox_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prexet_users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  provider_account_id text not null,
  email text not null,
  display_name text,
  encrypted_access_token text not null,
  access_token_iv text not null,
  access_token_tag text not null,
  encrypted_refresh_token text,
  refresh_token_iv text,
  refresh_token_tag text,
  access_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'needs_reauth', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, email)
);

create table if not exists public.prexet_email_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.prexet_projects(id) on delete cascade,
  stage_id uuid not null references public.prexet_stages(id) on delete cascade,
  party_id uuid not null references public.prexet_parties(id) on delete cascade,
  template_id uuid references public.prexet_email_templates(id) on delete set null,
  from_mailbox_id uuid references public.prexet_mailbox_connections(id) on delete set null,
  from_address text not null,
  subject text not null,
  body_html text not null,
  status text not null default 'draft' check (status in ('draft', 'ready', 'queued', 'sent', 'failed', 'cancelled')),
  customized boolean not null default false,
  provider_message_id text,
  queued_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (party_id, stage_id, template_id)
);

create table if not exists public.prexet_email_draft_attachments (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.prexet_email_drafts(id) on delete cascade,
  document_id uuid not null references public.prexet_documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (draft_id, document_id)
);

create table if not exists public.prexet_activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.prexet_projects(id) on delete cascade,
  actor_user_id uuid references public.prexet_users(id) on delete set null,
  event_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists prexet_projects_owner_user_id_idx on public.prexet_projects (owner_user_id);
create index if not exists prexet_project_members_user_id_idx on public.prexet_project_members (user_id);
create index if not exists prexet_stages_project_id_idx on public.prexet_stages (project_id);
create index if not exists prexet_parties_project_id_idx on public.prexet_parties (project_id);
create index if not exists prexet_parties_stage_id_idx on public.prexet_parties (stage_id);
create index if not exists prexet_documents_project_id_idx on public.prexet_documents (project_id);
create index if not exists prexet_documents_stage_id_idx on public.prexet_documents (stage_id);
create index if not exists prexet_email_templates_project_id_idx on public.prexet_email_templates (project_id);
create index if not exists prexet_mailbox_connections_user_id_idx on public.prexet_mailbox_connections (user_id);
create index if not exists prexet_email_drafts_project_id_idx on public.prexet_email_drafts (project_id);
create index if not exists prexet_email_drafts_party_id_idx on public.prexet_email_drafts (party_id);
create index if not exists prexet_email_drafts_status_idx on public.prexet_email_drafts (status);
create index if not exists prexet_activity_events_project_id_created_at_idx on public.prexet_activity_events (project_id, created_at desc);

alter table public.prexet_projects enable row level security;
alter table public.prexet_project_members enable row level security;
alter table public.prexet_stages enable row level security;
alter table public.prexet_parties enable row level security;
alter table public.prexet_documents enable row level security;
alter table public.prexet_email_templates enable row level security;
alter table public.prexet_mailbox_connections enable row level security;
alter table public.prexet_email_drafts enable row level security;
alter table public.prexet_email_draft_attachments enable row level security;
alter table public.prexet_activity_events enable row level security;

comment on table public.prexet_mailbox_connections is
'Server-only OAuth mailbox tokens. No client RLS policies are intentionally defined.';
