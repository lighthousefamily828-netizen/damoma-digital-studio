// Damoma Creative Studio — public Supabase client configuration.
// The publishable/anon key is designed for use in browser applications.
// Never place a Supabase service-role/secret key in this file.

const SUPABASE_URL = "https://iuwmdwbdkegyzkppvngw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_tXm0KC_lp8lSMh0QkdpCxA_jG_sm1hq";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
