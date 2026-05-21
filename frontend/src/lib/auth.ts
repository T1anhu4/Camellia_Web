import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production-change-me-now"
)

const TOKEN_COOKIE = "camellia_token"
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface JWTPayload {
  sub: string     // user_id
  email: string
  role: "user" | "admin"
  tier: string
}

// Sign a JWT token
export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET)
}

// Verify and decode a JWT token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

// Get the current session from cookies (Server Component / API route)
export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(TOKEN_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

// Set session cookie (in API route response)
export function setSessionCookie(token: string): { name: string; value: string; options: Record<string, unknown> } {
  return {
    name: TOKEN_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TOKEN_MAX_AGE,
    },
  }
}

export function clearSessionCookie() {
  return {
    name: TOKEN_COOKIE,
    value: "",
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  }
}
