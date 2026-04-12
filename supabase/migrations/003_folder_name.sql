-- Add folder_name to tracks for display purposes
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS folder_name text;
