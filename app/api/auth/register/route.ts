import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { authCookieOptions, signAuthToken } from "@/lib/jwt";
import { attachStudentToReferralCode } from "@/lib/attach-referral";


export async function POST(req: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 503 });
    }
    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: "Server is not configured" }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = registerSchema.parse(body);
    const referralCode =
      typeof body === "object" &&
      body !== null &&
      "referralCode" in body &&
      typeof (body as { referralCode?: unknown }).referralCode === "string"
        ? (body as { referralCode: string }).referralCode.trim().toUpperCase()
        : "";

    const collegeName = validated.collegeName ?? "Unknown College";
    const phoneNumber = validated.phoneNumber;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: validated.email }, { phoneNumber }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email or phone already exists. Try logging in." },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(validated.password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: validated.fullName,
        collegeName,
        phoneNumber,
        email: validated.email,
        password: hashedPassword,
        role: "STUDENT",
        onboardingComplete: true,
        phoneVerified: false,
        emailVerified: new Date(),
        referralSource: "Email registration",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        collegeName: true,
      },
    });

    if (referralCode) {
      await attachStudentToReferralCode({
        studentId: user.id,
        studentFullName: user.fullName,
        studentCollegeName: user.collegeName,
        codeRaw: referralCode,
      });
    }

    const token = await signAuthToken({
      userId: user.id,
      email: user.email,
      role: "STUDENT",
      approvalStatus: "APPROVED",
      suspended: false,
      onboardingComplete: true,
      phoneVerified: false,
      hasPhone: !!(validated.phoneNumber && validated.phoneNumber.replace(/\D/g, "").length === 10),
    });
    const response = NextResponse.json({ success: true, user }, { status: 201 });
    response.cookies.set("occ-token", token, authCookieOptions);
    return response;
  } catch (error) {
    console.error("[auth/register] error:", error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid form data" },
        { status: 400 },
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "An account with this email or phone already exists. Try logging in." },
          { status: 409 },
        );
      }
      if (error.code === "P2003") {
        return NextResponse.json(
          { error: "Invalid request data" },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }

    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
