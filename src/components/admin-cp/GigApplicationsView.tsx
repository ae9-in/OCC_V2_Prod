"use client";

import { useState, useMemo } from "react";
import { Check, X, Loader2, Search, ExternalLink, Filter } from "lucide-react";
import { toast } from "sonner";

type Application = {
  id: string;
  userId: string;
  gigId: string;
  status: string;
  createdAt: string;
  message: string | null;
  workDescription: string | null;
  submissionFileUrl: string | null;
  submissionFileName: string | null;
  submissionFileMime: string | null;
  submissionFileSize: number | null;
  submissionVerified: boolean;
  applicantEmail: string | null;
  applicantName: string | null;
  applicantPhone: string | null;
  user: { id: string; fullName: string; email: string; phoneNumber: string | null };
  gig: { id: string; title: string; club: { name: string } | null };
};

export function GigApplicationsView({ initialApplications }: { initialApplications: Application[] }) {
  const [applications, setApplications] = useState(initialApplications);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [verifyBusyId, setVerifyBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch = 
        app.user.fullName.toLowerCase().includes(search.toLowerCase()) ||
        app.user.email.toLowerCase().includes(search.toLowerCase()) ||
        app.gig.title.toLowerCase().includes(search.toLowerCase()) ||
        (app.gig.club?.name || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === "ALL" || app.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [applications, search, statusFilter]);

  const setStatus = async (applicationId: string, status: "APPROVED" | "REJECTED") => {
    setBusyId(applicationId);
    try {
      const res = await fetch(`/api/gig-applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Could not update status");
        return;
      }
      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status } : a))
      );
      toast.success(`Application ${status.toLowerCase()}`);
    } catch {
      toast.error("Network error");
    } finally {
      setBusyId(null);
    }
  };

  const verifySubmission = async (applicationId: string) => {
    setVerifyBusyId(applicationId);
    try {
      const res = await fetch(`/api/gig-applications/${applicationId}/verify`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Could not verify submission");
        return;
      }
      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, submissionVerified: true } : a))
      );
      toast.success("Submission verified");
    } catch {
      toast.error("Network error");
    } finally {
      setVerifyBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
          <input
            type="text"
            placeholder="Search by name, email, gig or club..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-[#5227FF]/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="h-4 w-4 text-white/20" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none focus:border-[#5227FF]/50 transition-colors"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map((app) => (
          <div key={app.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-[15px]">{app.user.fullName}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    app.status === "APPROVED" ? "bg-[#00E87A]/15 text-[#00E87A]" : 
                    app.status === "REJECTED" ? "bg-red-500/15 text-red-300" : 
                    "bg-amber-500/15 text-amber-200"
                  }`}>
                    {app.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/35">
                  <span className="flex items-center gap-1">{app.user.email}</span>
                  {app.user.phoneNumber && <span className="flex items-center gap-1">· {app.user.phoneNumber}</span>}
                  <span className="flex items-center gap-1">· Applied {new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl px-4 py-2 border border-white/[0.06]">
                <div className="text-right">
                  <p className="text-[12px] font-medium text-white/80">{app.gig.title}</p>
                  <p className="text-[10px] text-white/30">{app.gig.club?.name || "Independent"}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/10" />
                <button className="p-2 rounded-lg hover:bg-white/10 text-white/40 transition-colors">
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>

            {app.message && (
              <div className="rounded-xl bg-black/20 border border-white/[0.04] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/20 mb-2">Pitch / Message</p>
                <p className="text-[13px] text-white/70 leading-relaxed">{app.message}</p>
              </div>
            )}

            {(app.workDescription || app.submissionFileUrl) && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/60">Work Submission</span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    app.submissionVerified ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-100"
                  }`}>
                    {app.submissionVerified ? "Verified" : "Pending Verification"}
                  </span>
                </div>

                {app.workDescription && (
                  <p className="text-[13px] text-white/80 leading-relaxed">{app.workDescription}</p>
                )}

                {app.submissionFileUrl && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-white/80">{app.submissionFileName || "submission-file"}</p>
                      <p className="text-[10px] text-white/35">
                        {app.submissionFileMime || "document"} 
                        {app.submissionFileSize ? ` · ${(app.submissionFileSize / (1024 * 1024)).toFixed(2)} MB` : ""}
                      </p>
                    </div>
                    <a href={app.submissionFileUrl} target="_blank" rel="noreferrer" className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 text-[11px] font-bold text-white hover:bg-white/20 transition-colors">
                      Open File
                    </a>
                  </div>
                )}

                {!app.submissionVerified && (
                  <button
                    onClick={() => verifySubmission(app.id)}
                    disabled={verifyBusyId === app.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-100 text-[11px] font-bold uppercase tracking-wide hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                  >
                    {verifyBusyId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Verify Submission
                  </button>
                )}
              </div>
            )}

            {app.status === "PENDING" && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setStatus(app.id, "APPROVED")}
                  disabled={busyId === app.id}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-100 text-xs font-bold uppercase tracking-wider hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                >
                  {busyId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Approve Application
                </button>
                <button
                  onClick={() => setStatus(app.id, "REJECTED")}
                  disabled={busyId === app.id}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 text-red-200 text-xs font-bold uppercase tracking-wider hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {busyId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Reject Application
                </button>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-20 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] text-white/10">
              <Search className="h-6 w-6" />
            </div>
            <p className="text-white/30 text-sm">No applications found matching your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
