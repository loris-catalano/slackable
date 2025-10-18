-- Add profile fields for Slack-style user profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS status_text TEXT,
ADD COLUMN IF NOT EXISTS status_emoji TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Update status column to have better default
ALTER TABLE public.profiles
ALTER COLUMN status SET DEFAULT 'active';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);