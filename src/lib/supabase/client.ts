import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://pmpcvdfcbobiwhvxblme.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_E2Vnk26m-5yfpZNsmVJOaQ_Zkb_svXv";

  return createBrowserClient(url, key);
}
