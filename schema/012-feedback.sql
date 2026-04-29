-- Persistent feedback widget storage. Captures the user's quick rating
-- (love / okay / needs_work), an optional free-text message, and the
-- page they were on when they opened the widget — so we can correlate
-- complaints with specific surfaces.
--
-- ON DELETE SET NULL on user_id so feedback survives account deletion;
-- the rating + message are still useful product signal even if the
-- user record is gone.

CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  rating text NOT NULL CHECK (rating IN ('love', 'okay', 'needs_work')),
  message text,
  page_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
