import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { authCookieOptionsForDays, signAuthToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";
import { ACTIVITY_CATEGORIES, extractRequestIp, logActivityEvent } from "@/lib/activity-events";
import { isLegitIndianMobile } from "@/lib/phone-utils";

const loginRateMap =
  (globalThis as unknown as { __occLoginRateMap?: Map<string, { count: number; resetAt: number }> })
    .__occLoginRateMap ??
  (((globalThis as unknown as { __occLoginRateMap?: Map<string, { count: number; resetAt: number }> })
    .__occLoginRateMap = new Map()));

function getRateKey(req: NextRequest, email: string) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return `${ip}:${email.toLowerCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured");
    }
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const body = await req.json();
    const { email, password } = loginSchema.parse(body);
    const rememberMe = !!(body && typeof body.rememberMe === "boolean" && body.rememberMe);
    const sessionDays = rememberMe ? 4 : 2;
    const rateKey = getRateKey(req, email);
    const now = Date.now();
    const rateWindowMs = 15 * 60_000;
    const maxFailures = 12;
    const bucket = loginRateMap.get(rateKey);
    if (bucket && bucket.resetAt > now && bucket.count >= maxFailures) {
      return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            club: true,
          },
        },
      },
    });

    if (!user) {
      await logActivityEvent({
        actor: { userId: null, name: email, role: null },
        category: ACTIVITY_CATEGORIES.auth,
        eventType: "login_failed",
        summary: `Failed login attempt for ${email}`,
        entityType: "user",
        metadata: { reason: "user_not_found" },
        ipAddress: extractRequestIp(req),
      });
      loginRateMap.set(rateKey, {
        count: bucket && bucket.resetAt > now ? bucket.count + 1 : 1,
        resetAt: now + rateWindowMs,
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await logActivityEvent({
        actor: { userId: user.id, name: user.fullName, role: user.role },
        category: ACTIVITY_CATEGORIES.auth,
        eventType: "login_failed",
        summary: `Failed login attempt for ${user.email}`,
        entityType: "user",
        entityId: user.id,
        metadata: { reason: "invalid_password" },
        ipAddress: extractRequestIp(req),
      });
      loginRateMap.set(rateKey, {
        count: bucket && bucket.resetAt > now ? bucket.count + 1 : 1,
        resetAt: now + rateWindowMs,
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    loginRateMap.delete(rateKey);

    if (user.suspended) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }

    const token = await signAuthToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role as "ADMIN" | "CLUB_HEADER" | "STUDENT",
        approvalStatus: user.approvalStatus as "PENDING" | "APPROVED" | "REJECTED",
        suspended: user.suspended,
        onboardingComplete: user.onboardingComplete,
        phoneVerified: user.phoneVerified,
        hasPhone: isLegitIndianMobile(user.phoneNumber),
        provider: "local",
      },
      { expiresIn: `${sessionDays}d` },
    );

    const response = NextResponse.json({
      success: true,
      role: user.role,
      approvalStatus: user.approvalStatus,
      hasPhone: isLegitIndianMobile(user.phoneNumber),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        collegeName: user.collegeName,
        memberships: user.memberships,
      },
    });

    response.cookies.set("occ-token", token, authCookieOptionsForDays(sessionDays));

    const ipAddress = extractRequestIp(req);

    // ── SECURITY ALERT: Notify when an ADMIN logs in ──
    if (user.role === "ADMIN") {
      try {
        const { sendSecurityAlert } = await import("@/lib/smtp");
        const userAgent = req.headers.get("user-agent") || "Unknown Device";
        // Fire and forget (don't block the login response)
        sendSecurityAlert({
          userEmail: user.email,
          userName: user.fullName,
          ip: ipAddress || "unknown",
          userAgent: userAgent,
        }).catch((err) => console.error("[auth/login] Admin alert failed:", err));
      } catch (err) {
        console.error("[auth/login] Failed to import security alert lib:", err);
      }
    }

    await logActivityEvent({
      actor: { userId: user.id, name: user.fullName, role: user.role },
      category: ACTIVITY_CATEGORIES.auth,
      eventType: "login_success",
      summary: `${user.fullName} logged in`,
      entityType: "user",
      entityId: user.id,
      metadata: { rememberMe, sessionDays },
      ipAddress,
      broadcast: true,
    });

    return response;
  } catch (error: unknown) {
    console.error("[auth/login] error:", error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid form data" }, { status: 400 });
    }

    return NextResponse.json({ error: "Unable to sign in. Try again later." }, { status: 500 });
  }
}
