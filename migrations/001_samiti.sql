CREATE TABLE IF NOT EXISTS samiti_groups (
  id text PRIMARY KEY,
  owner text NOT NULL,
  invite text NOT NULL UNIQUE,
  visibility text NOT NULL CHECK (visibility IN ('public','private')),
  data text NOT NULL,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS samiti_groups_owner ON samiti_groups(owner);
CREATE TABLE IF NOT EXISTS samiti_guest_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
