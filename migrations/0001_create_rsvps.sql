CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  attendance_type TEXT NOT NULL CHECK (attendance_type IN ('rider', 'spectator', 'volunteer', 'sponsor', 'other')),
  notes TEXT,
  waiver_version TEXT NOT NULL,
  waiver_accepted INTEGER NOT NULL DEFAULT 0 CHECK (waiver_accepted IN (0, 1)),
  media_release_accepted INTEGER NOT NULL DEFAULT 0 CHECK (media_release_accepted IN (0, 1)),
  typed_signature TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT
);

CREATE INDEX IF NOT EXISTS idx_rsvps_created_at ON rsvps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rsvps_email ON rsvps(email);
