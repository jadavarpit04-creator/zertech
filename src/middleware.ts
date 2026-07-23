import { NextRequest, NextResponse } from "next/server";

const publicRoutes = ["/", "/auth", "/api/auth", "/api/chat"] as const;

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets through without auth
  if (pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?)$/)) {
    return NextResponse.next();
  }

  const isPublic = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isPublic) {
    return NextResponse.next();
  }

  const session = req.cookies.get("wos_session")?.value;

  if (!session) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
