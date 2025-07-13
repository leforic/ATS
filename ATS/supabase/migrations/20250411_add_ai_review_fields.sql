-- Add AI review fields to applications table
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS ai_review jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS match_score integer DEFAULT NULL;
