import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Allow public pages and static files through
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isLanding = req.nextUrl.pathname === "/";
  const isApi = req.nextUrl.pathname.startsWith("/api");
  const isStatic = /\.(png|ico|svg|jpg|jpeg|webp|css|js)$/i.test(req.nextUrl.pathname);

  if (isApiAuth || isLanding || isAuthPage || isStatic) return res;

  // For protected API routes, let the route handler itself check auth.
  if (isApi) return res;

  // Protect authenticated routes — redirect to /auth if no Better-Auth session cookie
  // Better-Auth stores its session token in "better-auth.session_token" cookie
  const hasSession = req.cookies.has("better-auth.session_token");

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
