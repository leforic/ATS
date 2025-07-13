-- Drop existing applications table if it exists
DROP TABLE IF EXISTS applications;

-- Create applications table with all necessary columns
CREATE TABLE applications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    candidate_name VARCHAR(255) NOT NULL,
    candidate_email VARCHAR(255) NOT NULL,
    candidate_phone VARCHAR(50) NOT NULL,
    resume TEXT NOT NULL,
    coverletter TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add indexes for better query performance
CREATE INDEX idx_applications_job_id ON applications(job_id);
CREATE INDEX idx_applications_candidate_id ON applications(candidate_id);
CREATE INDEX idx_applications_status ON applications(status);

-- Add RLS policies
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own applications
CREATE POLICY "Users can view their own applications"
ON applications FOR SELECT
TO authenticated
USING (candidate_id = auth.uid());

-- Allow users to create their own applications
CREATE POLICY "Users can create their own applications"
ON applications FOR INSERT
TO authenticated
WITH CHECK (candidate_id = auth.uid());

-- Allow users to update their own applications
CREATE POLICY "Users can update their own applications"
ON applications FOR UPDATE
TO authenticated
USING (candidate_id = auth.uid());

-- Allow HR users to view all applications
CREATE POLICY "HR can view all applications"
ON applications FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'hr'
    )
);

-- Allow HR users to update all applications
CREATE POLICY "HR can update all applications"
ON applications FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'hr'
    )
);
