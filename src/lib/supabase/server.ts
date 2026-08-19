import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const DEFAULT_URL = "https://pmpcvdfcbobiwhvxblme.supabase.co";
const DEFAULT_KEY = "sb_publishable_E2Vnk26m-5yfpZNsmVJOaQ_Zkb_svXv";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore server component setAll errors
        }
      },
    },
  });
}
