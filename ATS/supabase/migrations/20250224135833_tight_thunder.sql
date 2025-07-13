/*
  # Initial Schema Setup for ATS HR Tool

  1. Tables
    - profiles: User profiles for both HR and candidates
    - jobs: Job postings created by HR
    - applications: Job applications submitted by candidates
    - resumes: Parsed resume data

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for HR and candidate access
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('hr', 'candidate')),
  full_name text,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  requirements text NOT NULL,
  posted_by uuid REFERENCES profiles(id),
  status text DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz DEFAULT now()
);

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id),
  candidate_id uuid REFERENCES profiles(id),
  resume_text text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'selected', 'rejected')),
  created_at timestamptz DEFAULT now()
);

-- Create parsed_resumes table
CREATE TABLE IF NOT EXISTS parsed_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id),
  parsed_data jsonb NOT NULL,
  match_score numeric,
  match_details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_resumes ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Policies for jobs
CREATE POLICY "Anyone can read jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "HR can create jobs"
  ON jobs FOR INSERT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'hr'
  ));

CREATE POLICY "HR can update own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (posted_by = auth.uid());

-- Policies for applications
CREATE POLICY "Candidates can create applications"
  ON applications FOR INSERT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'candidate'
  ));

CREATE POLICY "HR can view all applications"
  ON applications FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'hr'
  ));

CREATE POLICY "Candidates can view own applications"
  ON applications FOR SELECT
  TO authenticated
  USING (candidate_id = auth.uid());

-- Policies for parsed_resumes
CREATE POLICY "HR can view parsed resumes"
  ON parsed_resumes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'hr'
  ));

CREATE POLICY "HR can create parsed resumes"
  ON parsed_resumes FOR INSERT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'hr'
  ));