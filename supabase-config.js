// NovelVerse Supabase client.
// The browser uses only the publishable key; database access is protected by RLS.
const SUPABASE_URL = "https://iuwmdwbdkegyzkppvngw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_tXm0KC_lp8lSMh0QkdpCxA_jG_sm1hq";

let supabase;
window.supabaseReady = false;

try {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase library did not load.");
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: "novel_platform" },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.supabaseReady = true;
} catch (error) {
  console.error("Supabase initialization failed:", error);
  window.__supabaseInitError = error;
}
