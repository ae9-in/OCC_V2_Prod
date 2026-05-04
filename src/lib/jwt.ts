import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

/** Keep login alive for a few days on refresh/navigation (requested 2-4 days). */
const JWT_EXPIRY = "4d";
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 4;

export type AuthTokenPayload = {
  userId: string;
  email: string;
  role?: "ADMIN" | "CLUB_HEADER" | "STUDENT";
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  suspended?: boolean;
  /** false = must complete /onboarding (e.g. first Google sign-in). Omitted on legacy tokens = treat as done. */
  onboardingComplete?: boolean;
  /** true = has a valid 10-digit phone number. used for global redirection logic. */
  /** true = has a valid 10-digit phone number. used for global redirection logic. */
  phoneVerified?: boolean;
  /** true = has a valid 10-digit phone number. used for global redirection logic. */
  hasPhone?: boolean;
  /** Authentication provider. Google vs local. */
  provider?: "google" | "local";
  /** specifically for administrative exports verified via personal email. */
  targetEmail?: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function signAuthToken(
  payload: AuthTokenPayload,
  opts?: { expiresIn?: string },
) {
  const payloadToSign = { ...payload } as unknown as { [key: string]: unknown };
  return new SignJWT(payloadToSign)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(opts?.expiresIn || JWT_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as unknown as AuthTokenPayload;
}

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
};

export function authCookieOptionsForDays(days: number) {
  const clampedDays = Math.max(1, Math.min(30, Math.floor(days)));
  return {
    ...authCookieOptions,
    maxAge: 60 * 60 * 24 * clampedDays,
  };
}
