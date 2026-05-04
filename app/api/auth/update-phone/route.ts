import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authCookieOptions, signAuthToken, verifyAuthToken } from "@/lib/jwt";
import { isLegitIndianMobile } from "@/lib/phone-utils";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const rawPhone =
      body && typeof body.phoneNumber === "string" ? body.phoneNumber : "";
    const cleanPhone = rawPhone.replace(/\D/g, "");

    if (!isLegitIndianMobile(cleanPhone)) {
      return NextResponse.json(
        { error: "A valid 10-digit Indian mobile number is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findFirst({
      where: { phoneNumber: cleanPhone, id: { not: user.id } },
    });
    if (existing) {
      return NextResponse.json(
        {
          error:
            "This phone number is already registered with another account",
        },
        { status: 400 },
      );
    }

    const rawToken = cookies().get("occ-token")?.value;
    const existingPayload = rawToken
      ? await verifyAuthToken(rawToken).catch(() => null)
      : null;
    const provider = existingPayload?.provider;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneNumber: cleanPhone,
        onboardingComplete: true,
      },
    });

    const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
    if (!refreshed) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const token = await signAuthToken({
      userId: refreshed.id,
      email: refreshed.email,
      role: refreshed.role as "ADMIN" | "CLUB_HEADER" | "STUDENT",
      approvalStatus: refreshed.approvalStatus as
        | "PENDING"
        | "APPROVED"
        | "REJECTED",
      suspended: refreshed.suspended,
      onboardingComplete: refreshed.onboardingComplete,
      phoneVerified: refreshed.phoneVerified,
      hasPhone: isLegitIndianMobile(refreshed.phoneNumber),
      ...(provider ? { provider } : {}),
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set("occ-token", token, authCookieOptions);
    return res;
  } catch (error) {
    console.error("[auth/update-phone] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
