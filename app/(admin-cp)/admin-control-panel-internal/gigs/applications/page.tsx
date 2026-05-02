import { prisma } from "@/lib/prisma";
import { GigApplicationsView } from "@/components/admin-cp/GigApplicationsView";

export default async function AdminCPGigApplicationsPage() {
  const [applications, auditLogs] = await Promise.all([
    prisma.gigApplication.findMany({
      include: {
        user: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
        gig: { select: { id: true, title: true, club: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: {
        action: "VERIFY_GIG_SUBMISSION",
        entity: "gig_application",
      },
      select: { entityId: true },
    }),
  ]);

  const verifiedSet = new Set(auditLogs.map((log) => log.entityId).filter(Boolean) as string[]);

  const processedApps = applications.map((app) => ({
    ...app,
    createdAt: app.createdAt.toISOString(),
    submissionVerified: verifiedSet.has(app.id),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5227FF]">Operations</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Gig Applications ({applications.length})</h1>
        </div>
      </div>
      
      <GigApplicationsView initialApplications={processedApps} />
    </div>
  );
}
