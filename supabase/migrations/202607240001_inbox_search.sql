-- Optional, read-only Gmail indexing for user-initiated AI search.
-- Browser clients have no policies for these tables; authenticated server
-- endpoints perform all access with ownership checks.

create table if not exists public.prexet_user_settings (
  user_id uuid primary key references public.prexet_users(id) on delete cascade,
  inbox_onboarding_completed boolean not null default false,
  inbox_search_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prexet_mailbox_connections
  add column if not exists inbox_access_enabled boolean not null default false,
  add column if not exists inbox_sync_status text not null default 'not_started'
    check (inbox_sync_status in ('not_started', 'syncing', 'ready', 'error')),
  add column if not exists inbox_sync_page_token text,
  add column if not exists inbox_sync_query text,
  add column if not exists inbox_last_synced_at timestamptz,
  add column if not exists inbox_message_count integer not null default 0
    check (inbox_message_count >= 0);

create table if not exists public.prexet_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.prexet_users(id) on delete cascade,
  mailbox_id uuid not null references public.prexet_mailbox_connections(id) on delete cascade,
  provider_message_id text not null,
  provider_thread_id text not null,
  history_id text,
  internal_date timestamptz not null,
  from_address text not null default '',
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text not null default '',
  snippet text not null default '',
  body_text text not null default '',
  label_ids text[] not null default '{}',
  attachment_names text[] not null default '{}',
  raw_size integer not null default 0 check (raw_size >= 0),
  search_text text not null default '',
  search_vector tsvector generated always as (
    to_tsvector('english'::regconfig, search_text)
  ) stored,
  indexed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mailbox_id, provider_message_id)
);

create index if not exists prexet_inbox_messages_user_date_idx
  on public.prexet_inbox_messages (user_id, internal_date desc);
create index if not exists prexet_inbox_messages_mailbox_date_idx
  on public.prexet_inbox_messages (mailbox_id, internal_date desc);
create index if not exists prexet_inbox_messages_search_idx
  on public.prexet_inbox_messages using gin (search_vector);

alter table public.prexet_user_settings enable row level security;
alter table public.prexet_inbox_messages enable row level security;

comment on table public.prexet_inbox_messages is
'Read-only Gmail index. No application AI tool or endpoint may delete, move, archive, label, or mutate source Gmail messages.';
comment on column public.prexet_inbox_messages.body_text is
'Searchable message text only. Attachment bytes are intentionally not downloaded.';
