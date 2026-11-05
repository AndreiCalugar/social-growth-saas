-- 019: Beta access gate for DM automation.
--
-- While the Meta app is in Standard Access, only accounts added as Instagram
-- Testers can connect. New users request access (Instagram handle), the
-- admin adds them as testers in the Meta dashboard and approves them in
-- /admin/beta; only approved users see "Connect Instagram".
--
-- Run in the Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS beta_access (
  user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  instagram_username text,
  is_professional    boolean NOT NULL DEFAULT false,
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved')),
  requested_at       timestamptz,
  approved_at        timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_access_status ON beta_access (status);

-- Everyone who already connected Instagram is a tester — approve them.
INSERT INTO beta_access (user_id, instagram_username, is_professional, status, approved_at)
SELECT user_id, username, true, 'approved', now()
FROM instagram_accounts
ON CONFLICT (user_id) DO NOTHING;
