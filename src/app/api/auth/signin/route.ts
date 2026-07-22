import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/signin
 *
 * Custom sign-in endpoint that:
 * 1. Accepts form POST (email, password, callbackURL)
 * 2. Calls Better Auth's sign-in API
 * 3. Returns a proper 302 redirect with Set-Cookie
 *
 * This is needed because Better Auth returns JSON body instead of redirect,
 * which breaks native form submissions.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const callbackURL = (formData.get("callbackURL") as string) || "/dashboard";

    if (!email || !password) {
      return NextResponse.redirect(new URL("/auth?error=missing_fields", req.url));
    }

    // Call Better Auth's sign-in API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zertech-iota.vercel.app";
    const apiRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, callbackURL }),
    });

    if (!apiRes.ok) {
      return NextResponse.redirect(new URL("/auth?error=invalid", req.url));
    }

    // Forward the Set-Cookie header from Better Auth response
    const setCookie = apiRes.headers.get("set-cookie");

    // Redirect to callback URL
    const redirectRes = NextResponse.redirect(new URL(callbackURL, req.url));

    // Pass through the session cookie (HttpOnly, Secure)
    if (setCookie) {
      // __Secure-better-auth.session_token=xxx; ... 
      const cookieMatch = setCookie.match(/__Secure-better-auth\.session_token=[^;]+/);
      if (cookieMatch) {
        const cookieValue = cookieMatch[0];
        redirectRes.headers.set(
          "Set-Cookie",
          `${cookieValue}; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax`
        );
      } else {
        // Fallback: pass through all set-cookie headers
        redirectRes.headers.set("Set-Cookie", setCookie);
      }
    }

    return redirectRes;
  } catch (err) {
    console.error("[auth/signin] Error:", err);
    return NextResponse.redirect(new URL("/auth?error=server_error", req.url));
  }
}
