
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { verifyAuthToken } from "@/lib/jwt";
import { sendExportNotification } from "@/lib/smtp";
import { extractRequestIp } from "@/lib/activity-events";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const type = params.type;
  
  // Verify Export Session Token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Verification required. Please verify your email first." }, { status: 401 });
  }

  const token = authHeader.substring(7);
  let adminSession;
  try {
    adminSession = await verifyAuthToken(token);
    if (adminSession.role !== "ADMIN") throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid or expired session. Please re-verify." }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  const dateFilter: any = {};
  if (from || to) {
    dateFilter.createdAt = {};
    if (from) dateFilter.createdAt.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.createdAt.lte = toDate;
    }
  }

  let data: any[] = [];
  let name = `occ-${type}`;

  if (type === "users") {
    const users = await prisma.user.findMany({
      where: dateFilter,
      select: {
        fullName: true,
        phoneNumber: true,
        email: true,
        collegeName: true,
        createdAt: true,
        referrer: { select: { fullName: true, referralCode: true } },
        approvalStatus: true,
      },
      orderBy: { createdAt: "desc" },
    });
    data = users.map(u => ({
      "Full Name": u.fullName,
      "Phone": u.phoneNumber || "N/A",
      "Email": u.email,
      "College": u.collegeName,
      "Referral Used": u.referrer ? `${u.referrer.fullName} (${u.referrer.referralCode})` : "Direct",
      "Created At": u.createdAt.toISOString(),
      "Status": u.approvalStatus
    }));
  } else if (type === "headers") {
    const headers = await prisma.user.findMany({
      where: { role: "CLUB_HEADER", ...dateFilter },
      select: {
        fullName: true,
        email: true,
        phoneNumber: true,
        referralCode: true,
        clubManaged: { select: { name: true } },
      },
      orderBy: { fullName: "asc" },
    });
    data = headers.map(h => ({
      "Header Name": h.fullName,
      "Email": h.email,
      "Phone": h.phoneNumber || "N/A",
      "Club Name": h.clubManaged?.name || "No Club",
      "Referral Code": h.referralCode || "N/A"
    }));
  } else if (type === "clubs") {
    const clubs = await prisma.club.findMany({
      where: dateFilter,
      include: { header: { select: { fullName: true } }, _count: { select: { members: true } } }
    });
    data = clubs.map(c => ({
      "Club Name": c.name,
      "Slug": c.slug,
      "Header": c.header?.fullName || "N/A",
      "Member Count": c._count.members,
      "Description": c.description
    }));
  } else if (type === "activity") {
    const activity = await prisma.activityEvent.findMany({
      where: dateFilter,
      orderBy: { createdAt: "desc" },
    });
    data = activity.map(a => ({
      "Timestamp": a.createdAt.toISOString(),
      "Date": a.createdAt.toLocaleDateString(),
      "Time": a.createdAt.toLocaleTimeString(),
      "Actor Name": a.actorName,
      "Actor Role": a.actorRole || "N/A",
      "Event Type": a.eventType,
      "Category": a.category,
      "Summary": a.summary,
      "Entity": `${a.entityType || ""}${a.entityId ? `:${a.entityId}` : ""}`,
      "IP Address": a.ipAddress || "N/A",
      "Details": a.metadata ? JSON.stringify(a.metadata) : "{}"
    }));
  } else if (type === "audit") {
    const audit = await prisma.auditLog.findMany({
      where: dateFilter,
      orderBy: { createdAt: "desc" },
    });
    data = audit.map(a => ({
      "Timestamp": a.createdAt.toISOString(),
      "Date": a.createdAt.toLocaleDateString(),
      "Time": a.createdAt.toLocaleTimeString(),
      "Admin Email": a.adminEmail,
      "Action": a.action,
      "Entity": a.entity,
      "Entity ID": a.entityId || "N/A",
      "IP Address": a.ipAddress || "N/A",
      "Details": a.details ? JSON.stringify(a.details) : "{}"
    }));
  } else {
    // Basic fallback for other types if they exist
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // Create Workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  
  // Generating Buffer
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  await logAudit({
    adminId: adminSession.userId,
    adminEmail: adminSession.email,
    action: "EXPORT_EXCEL",
    entity: "settings",
    details: { type, targetEmail: adminSession.targetEmail },
  });

  // Send Alert/Notice to SMTP Owner
  try {
    const adminUser = await prisma.user.findUnique({ where: { id: adminSession.userId }, select: { fullName: true } });
    await sendExportNotification({
      adminEmail: adminSession.email,
      adminName: adminUser?.fullName || "Admin",
      targetEmail: adminSession.targetEmail || "Unknown",
      type: type,
      ip: extractRequestIp(req) || "unknown",
    });
  } catch (err) {
    console.error("Failed to send export notification email:", err);
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
