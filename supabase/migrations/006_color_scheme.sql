-- Add color scheme to playback_state
ALTER TABLE playback_state ADD COLUMN IF NOT EXISTS color_scheme text DEFAULT 'ember';
