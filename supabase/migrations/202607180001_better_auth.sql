-- Better Auth core tables. Better Auth keeps camelCase field names internally,
-- while every physical table is explicitly namespaced for Prexet.

create table if not exists public.prexet_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.prexet_sessions (
  id uuid primary key default gen_random_uuid(),
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid not null references public.prexet_users(id) on delete cascade
);

create table if not exists public.prexet_accounts (
  id uuid primary key default gen_random_uuid(),
  "accountId" text not null,
  "providerId" text not null,
  "userId" uuid not null references public.prexet_users(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.prexet_verifications (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists prexet_sessions_user_id_idx
on public.prexet_sessions ("userId");

create index if not exists prexet_accounts_user_id_idx
on public.prexet_accounts ("userId");

create index if not exists prexet_verifications_identifier_idx
on public.prexet_verifications (identifier);

alter table public.prexet_users enable row level security;
alter table public.prexet_sessions enable row level security;
alter table public.prexet_accounts enable row level security;
alter table public.prexet_verifications enable row level security;

comment on table public.prexet_users is
'Better Auth users. Accessed only by the Prexet server through the direct PostgreSQL connection.';
