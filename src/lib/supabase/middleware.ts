import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_URL = "https://pmpcvdfcbobiwhvxblme.supabase.co";
const DEFAULT_KEY = "sb_publishable_E2Vnk26m-5yfpZNsmVJOaQ_Zkb_svXv";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session if it exists
  try {
    await supabase.auth.getUser();
  } catch {
    // Ignore session refresh errors during build/prerender
  }

  return supabaseResponse;
}
