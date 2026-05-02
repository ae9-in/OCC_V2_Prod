import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { profileUpdateSchema } from "@/lib/validations";
import { logSuspiciousAccess } from "@/lib/security";
import { ACTIVITY_CATEGORIES, extractRequestIp, logActivityEvent } from "@/lib/activity-events";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      collegeName: user.collegeName,
      bio: user.bio,
      city: user.city,
      graduationYear: user.graduationYear,
      avatar: user.avatar,
      role: user.role,
      approvalStatus: user.approvalStatus,
      onboardingComplete: user.onboardingComplete,
      phoneVerified: user.phoneVerified,
      referredBy: user.referredBy,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
          path: "/api/profile",
          reason: `Role/privilege field(s) present in profile update: ${attempted.join(", ")}`,
          severity: "HIGH",
        });
      }
    }
    const parsed = profileUpdateSchema.parse(body);

    const data: Prisma.UserUpdateInput = {
      fullName: parsed.fullName,
      collegeName: parsed.collegeName,
      bio: parsed.bio === "" || parsed.bio === undefined ? null : parsed.bio,
      city: parsed.city === "" || parsed.city === undefined ? null : parsed.city,
    };
    if (parsed.phoneNumber !== undefined) {
      data.phoneNumber = parsed.phoneNumber;
      data.onboardingComplete = true; // Mark as legitimate once they add a phone number
    }

    if (parsed.graduationYear !== undefined) {
      data.graduationYear = parsed.graduationYear;
    }
    if (parsed.avatar !== undefined) {
      data.avatar = parsed.avatar === "" ? null : parsed.avatar;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        collegeName: true,
        bio: true,
        city: true,
        graduationYear: true,
        avatar: true,
        role: true,
        approvalStatus: true,
        onboardingComplete: true,
        referredBy: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit Log for Admin Visibility
    await prisma.auditLog.create({
      data: {
        adminId: user.id, // User themselves for self-updates
        adminEmail: user.email,
        action: "PROFILE_UPDATE",
        entity: "USER",
        entityId: user.id,
        details: {
          changedFields: Object.keys(data),
          platform: "DASHBOARD",
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Trigger realtime updates for Admin arrays and Club Header referrals
    await pusherServer.trigger("system-updates", "user-updated", { userId: user.id });
    if (user.referredBy) {
      await pusherServer.trigger(`header-${user.referredBy}`, "new-member", { userId: user.id }); // reuse 'new-member' event to trigger router.refresh() on header
    }
    await logActivityEvent({
      actor: { userId: user.id, name: user.fullName, role: user.role },
      category: ACTIVITY_CATEGORIES.profile,
      eventType: "profile_updated",
      summary: `${user.fullName} updated profile`,
      entityType: "user",
      entityId: user.id,
      metadata: { changedFields: Object.keys(data) },
      ipAddress: extractRequestIp(req),
      broadcast: true,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid form data" },
        { status: 400 },
      );
    }
    console.error("[profile] PATCH", error);
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }
}
