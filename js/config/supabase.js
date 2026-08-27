import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Use the browser-safe anon key here, never the service-role key.
const SUPABASE_URL = 'https://qkjspjwvirkpjkslddux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFranNwand2aXJrcGprc2xkZHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MDg4NDksImV4cCI6MjEwMzM4NDg0OX0.F_O68kN21at3KGpOJTuOhAI18Rwq1-FjwVrgzqPX5fE';

export const isSupabaseConfigured =
  !SUPABASE_URL.includes('PASTE_') && !SUPABASE_ANON_KEY.includes('PASTE_');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
