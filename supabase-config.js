// NovelVerse Supabase client.
// Keep the publishable key in the browser; RLS protects the data.
const SUPABASE_URL = "https://iuwmdwbdkegyzkppvngw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_tXm0KC_lp8lSMh0QkdpCxA_jG_sm1hq";

let supabase;
let supabaseReady = false;

try {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase library did not load.");
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: "novel_platform" },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  supabaseReady = true;
} catch (error) {
  console.error("Supabase initialization failed:", error);
  window.__supabaseInitError = error;
}
