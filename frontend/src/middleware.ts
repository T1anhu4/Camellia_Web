import { NextRequest, NextResponse } from "next/server"

const publicPaths = ["/", "/login", "/api/auth", "/api/public"]
const protectedPaths = ["/dashboard", "/admin"]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths, static assets, and API routes (API has its own auth)
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api") ||
    pathname.match(/\.(svg|png|jpg|ico|css|js)$/)
  ) {
    return NextResponse.next()
  }

  // Protect dashboard and admin pages
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  // Simple cookie check — API routes handle full JWT verification
  const token = req.cookies.get("camellia_token")?.value
  if (!token) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
}
