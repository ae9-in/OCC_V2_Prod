import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { attachStudentToReferralCode } from "@/lib/attach-referral";
import { authCookieOptions, signAuthToken, verifyAuthToken } from "@/lib/jwt";
import { logSuspiciousAccess } from "@/lib/security";
import { sha256Hex } from "@/lib/otp";
import { pusherServer } from "@/lib/pusher";
import { ACTIVITY_CATEGORIES, extractRequestIp, logActivityEvent } from "@/lib/activity-events";
import { cookies } from "next/headers";
import { isLegitIndianMobile } from "@/lib/phone-utils";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const raw = body as Record<string, unknown>;
      const attempted = ["role", "adminLevel", "adminRoleTemplateId", "approvalStatus"].filter(
        (k) => k in raw,
      );
      if (attempted.length) {
        const forwarded = req.headers.get("x-forwarded-for") || "";
        const ip = forwarded.split(",")[0]?.trim() || "unknown";
        await logSuspiciousAccess({
          userId: user.id,
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || undefined,
          path: "/api/onboarding/complete",
          reason: `Role/privilege field(s) present in onboarding request: ${attempted.join(", ")}`,
          severity: "HIGH",
        });
      }
    }
    const { referralSource, referralCode, phoneNumber } = body as {
      referralSource?: string;
      collegeName?: string;
      referralCode?: string;
      phoneNumber?: string;
    };
    const collegeName = typeof (body as { collegeName?: unknown })?.collegeName === "string"
      ? (body as { collegeName: string }).collegeName.trim()
      : "";

    // Read provider from current JWT so it survives the token refresh
    const rawToken = cookies().get("occ-token")?.value;
    const existingPayload = rawToken ? await verifyAuthToken(rawToken).catch(() => null) : null;
    const provider = existingPayload?.provider;

    // Phase-3-only path: user already completed phases 1 & 2 (onboardingComplete === true)
    // In this case referralSource & collegeName are already stored — skip validation
    const isPhoneOnlyUpdate = user.onboardingComplete === true;

    if (!isPhoneOnlyUpdate) {
      if (!referralSource) {
        return NextResponse.json({ error: "referralSource is required" }, { status: 400 });
      }
      if (collegeName.length < 2) {
        return NextResponse.json({ error: "collegeName is required" }, { status: 400 });
      }
    }

    // Phone is ALWAYS required — no skip
    const cleanPhone = typeof phoneNumber === "string" ? phoneNumber.replace(/\D/g, "") : "";
    if (cleanPhone.length !== 10) {
      return NextResponse.json({ error: "A valid 10-digit phone number is required" }, { status: 400 });
    }

    // Check phone uniqueness
    const existingPhone = await prisma.user.findFirst({
      where: { phoneNumber: cleanPhone, id: { not: user.id } }
    });
    if (existingPhone) {
      return NextResponse.json({ error: "This phone number is already registered with another account" }, { status: 400 });
    }

    const codeNormalized =
      typeof referralCode === "string" && referralCode.trim().length > 0
        ? referralCode.trim().toUpperCase()
        : "";

    // Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingComplete: true,
        phoneVerified: true,
        phoneNumber: cleanPhone,
        ...(isPhoneOnlyUpdate ? {} : { referralSource, collegeName }),
      },
    });

    if (!isPhoneOnlyUpdate && codeNormalized) {
      const attached = await attachStudentToReferralCode({
        studentId: user.id,
        studentFullName: user.fullName,
        studentCollegeName: collegeName,
        codeRaw: codeNormalized,
      });
      if (!attached.ok) {
        console.warn("[onboarding] referral attach failed or invalid code for user=%s", user.id);
      }
    }

    const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
    if (!refreshed) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const token = await signAuthToken({
      userId: refreshed.id,
      email: refreshed.email,
      role: refreshed.role as "ADMIN" | "CLUB_HEADER" | "STUDENT",
      approvalStatus: refreshed.approvalStatus as "PENDING" | "APPROVED" | "REJECTED",
      suspended: refreshed.suspended,
      onboardingComplete: refreshed.onboardingComplete,
      hasPhone: isLegitIndianMobile(refreshed.phoneNumber),
      phoneVerified: refreshed.phoneVerified,
      ...(provider ? { provider } : {}),
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set("occ-token", token, authCookieOptions);
    return res;
  } catch (error) {
    console.error("[onboarding/complete] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
