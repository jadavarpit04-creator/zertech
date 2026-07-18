import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  // Allow public pages and static files through
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
  const isLanding = req.nextUrl.pathname === "/";
  const isApi = req.nextUrl.pathname.startsWith("/api");
  const isStatic = /\.(png|ico|svg|jpg|jpeg|webp|css|js)$/i.test(req.nextUrl.pathname);

  if (isApi || isLanding || isAuthPage || isStatic) return res;

  // Protect authenticated routes — redirect to /auth if no session cookie
  // Session check is done client-side via supabase.auth.getSession()
  // The middleware just redirects unauthenticated requests away from protected pages
  const hasSession = req.cookies.has("sb-access-token") || req.cookies.has("supabase-auth-token");

  if (!hasSession) {
    const redirectUrl = new URL("/auth", req.url);
    redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
