/*
  # Attendance Management System Schema

  1. New Tables
    - `cohorts`
      - `id` (uuid, primary key)
      - `name` (text, unique) - e.g., "Cohort 45", "Cohort 46"
      - `created_at` (timestamptz)
    
    - `programmes`
      - `id` (uuid, primary key)
      - `name` (enum: aPHRi, PHRi, SPHRi, UNKNOWN)
      - `cohort_id` (uuid, foreign key to cohorts)
      - `created_at` (timestamptz)
    
    - `students`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text, unique)
      - `programme_id` (uuid, foreign key to programmes)
      - `created_at` (timestamptz)
    
    - `weeks`
      - `id` (uuid, primary key)
      - `name` (text) - e.g., "Week 1", "Week 2"
      - `created_at` (timestamptz)
    
    - `attendance`
      - `id` (uuid, primary key)
      - `student_id` (uuid, foreign key to students)
      - `week_id` (uuid, foreign key to weeks)
      - `status` (enum: ABSENT, IN_PERSON, ONLINE, HYBRID)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (student_id, week_id)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read all data
    - Add policies for authenticated users to manage data (admin operations)
*/

-- Create ENUMs
CREATE TYPE programme_type AS ENUM ('aPHRi', 'PHRi', 'SPHRi', 'UNKNOWN');
CREATE TYPE attendance_status AS ENUM ('ABSENT', 'IN_PERSON', 'ONLINE', 'HYBRID');

-- Create cohorts table
CREATE TABLE IF NOT EXISTS cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create programmes table
CREATE TABLE IF NOT EXISTS programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name programme_type NOT NULL,
  cohort_id uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  programme_id uuid NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create weeks table
CREATE TABLE IF NOT EXISTS weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_id uuid NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'ABSENT',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, week_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_programmes_cohort_id ON programmes(cohort_id);
CREATE INDEX IF NOT EXISTS idx_students_programme_id ON students(programme_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_week_id ON attendance(week_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_week ON attendance(student_id, week_id);

-- Enable RLS
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policies for cohorts
CREATE POLICY "Anyone can view cohorts"
  ON cohorts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert cohorts"
  ON cohorts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cohorts"
  ON cohorts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cohorts"
  ON cohorts FOR DELETE
  TO authenticated
  USING (true);

-- Policies for programmes
CREATE POLICY "Anyone can view programmes"
  ON programmes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert programmes"
  ON programmes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update programmes"
  ON programmes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete programmes"
  ON programmes FOR DELETE
  TO authenticated
  USING (true);

-- Policies for students
CREATE POLICY "Anyone can view students"
  ON students FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update students"
  ON students FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete students"
  ON students FOR DELETE
  TO authenticated
  USING (true);

-- Policies for weeks
CREATE POLICY "Anyone can view weeks"
  ON weeks FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert weeks"
  ON weeks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update weeks"
  ON weeks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete weeks"
  ON weeks FOR DELETE
  TO authenticated
  USING (true);

-- Policies for attendance
CREATE POLICY "Anyone can view attendance"
  ON attendance FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert attendance"
  ON attendance FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update attendance"
  ON attendance FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on attendance table
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();