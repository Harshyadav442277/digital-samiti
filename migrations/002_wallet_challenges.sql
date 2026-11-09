CREATE TABLE IF NOT EXISTS samiti_wallet_challenges (
  nonce_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS samiti_wallet_challenges_expiry ON samiti_wallet_challenges(expires_at);
