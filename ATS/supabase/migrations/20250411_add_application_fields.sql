-- Add new columns to applications table
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS candidate_name text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS candidate_email text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS candidate_phone text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS coverletter text NOT NULL DEFAULT '';

-- Update column name to match our code
ALTER TABLE applications
RENAME COLUMN resume_text TO resume;
