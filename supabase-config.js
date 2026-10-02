// Novel platform Supabase client.
// This browser key is publishable and is safe to expose when RLS is configured.
const SUPABASE_URL = "https://iuwmdwbdkegyzkppvngw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_tXm0KC_lp8lSMh0QkdpCxA_jG_sm1hq";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "novel_platform" }
});
