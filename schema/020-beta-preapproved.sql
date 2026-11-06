-- 020: Pre-approved Instagram handles for the beta.
--
-- The admin adds people as Instagram Testers in Meta before they have an
-- app account. Listing their handles here means their beta request is
-- approved the moment they submit it — they see "Connect Instagram" straight
-- away instead of waiting for a manual approval.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS beta_preapproved_handles (
  instagram_username text PRIMARY KEY,
  added_at           timestamptz NOT NULL DEFAULT now()
);

-- Testers added in Meta on 2026-11-06 (from the App Roles screen).
INSERT INTO beta_preapproved_handles (instagram_username) VALUES
  ('alina.pirlea'), ('aurasmihaiu'), ('alintibi'), ('miha.nicola03'),
  ('bas.energy'), ('ioana.jo'), ('roberto.langa'), ('thecurious_eye'),
  ('iulia_lupu12'), ('teonicaa'), ('evacosaa'), ('diana.bvlgari'),
  ('georgiana_buta'), ('nicolerootless'), ('sorin.austreanu'),
  ('vlad.creteanu'), ('enacheradu'), ('roland.muresan'),
  ('alexandrudobre02'), ('parinteimperfect'), ('florin_ilea'),
  ('andreea_wanderlust'), ('andrei_dominic1'), ('its.mihaipirlog'),
  ('mateiilioi.03'), ('laviniachitu7'), ('miucq')
ON CONFLICT (instagram_username) DO NOTHING;
