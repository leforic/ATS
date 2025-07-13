-- Add resume_txt column to applications table
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS resume_txt TEXT;

-- Add a comment to explain the purpose of this column
COMMENT ON COLUMN applications.resume_txt IS 'Extracted full text from the resume file for processing and analysis'; 