import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth;

  // Allow API auth routes to pass through
  if (nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to /signin
  if (!isAuthenticated && nextUrl.pathname !== "/signin") {
    return NextResponse.redirect(new URL("/signin", nextUrl));
  }

  // Redirect authenticated users away from /signin
  if (isAuthenticated && nextUrl.pathname === "/signin") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
