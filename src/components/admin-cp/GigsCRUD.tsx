"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Plus, ChevronDown, Trash2, X, Check, Loader2, ClipboardCheck } from "lucide-react";

type Gig = {
  id: string; title: string; description: string; payMin: number; payMax: number;
  createdAt: string; deadline: string | null;
  club: { id: string; name: string } | null;
  postedBy: { id: string; fullName: string } | null;
  applications: {
    id: string;
    status: string;
    submissionVerified?: boolean;
    message: string | null;
    workDescription?: string | null;
    submissionFileUrl?: string | null;
    submissionFileName?: string | null;
    submissionFileMime?: string | null;
    submissionFileSize?: number | null;
    createdAt: string;
    user: { id: string; fullName: string; email: string };
  }[];
};

export function GigsCRUD({ gigs: initial, clubs }: { gigs: Gig[]; clubs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [gigs, setGigs] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [verifyBusyId, setVerifyBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", payMin: 0, payMax: 0, clubId: clubs[0]?.id || "" });

  const save = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin-cp/gigs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { toast.error("Failed"); return; }
      toast.success("Gig created"); setShowModal(false); router.refresh();
    } catch { toast.error("Error"); } finally { setLoading(false); }
  };

  const deleteGig = async (id: string) => {
    if (!confirm("Delete this gig?")) return;
    await fetch(`/api/admin-cp/gigs/${id}`, { method: "DELETE" });
    setGigs((p) => p.filter((g) => g.id !== id)); toast.success("Deleted");
  };

  const verifySubmission = async (applicationId: string) => {
    setVerifyBusyId(applicationId);
    try {
      const res = await fetch(`/api/gig-applications/${applicationId}/verify`, { method: "PATCH" });
      const data = (await res.json().catch(() => null)) as { error?: string; alreadyVerified?: boolean } | null;
      if (!res.ok) {
        toast.error(data?.error || "Could not verify submission");
        return;
      }
      setGigs((prev) =>
        prev.map((g) => ({
          ...g,
          applications: g.applications.map((a) =>
            a.id === applicationId ? { ...a, submissionVerified: true } : a,
          ),
        })),
      );
      toast.success(data?.alreadyVerified ? "Already verified" : "Submission verified");
    } catch {
      toast.error("Network error");
    } finally {
      setVerifyBusyId(null);
    }
  };

  const setStatus = async (applicationId: string, status: "APPROVED" | "REJECTED") => {
    setBusyId(applicationId);
    try {
      const res = await fetch(`/api/gig-applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error || "Could not update status");
        return;
      }
      setGigs((prev) =>
        prev.map((g) => ({
          ...g,
          applications: g.applications.map((a) =>
            a.id === applicationId ? { ...a, status } : a,
          ),
        })),
      );
      toast.success(status === "APPROVED" ? "Application approved" : "Application rejected");
    } catch {
      toast.error("Network error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5227FF]">Operations</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Gigs ({gigs.length})</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/k9xm2p7qv4nw8-admin-control-panel/gigs/applications"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-bold text-white/70 hover:text-white hover:bg-white/[0.05] transition-all">
            <ClipboardCheck className="h-4 w-4" /> View All Applications
          </Link>
          <button onClick={() => { setForm({ title: "", description: "", payMin: 0, payMax: 0, clubId: clubs[0]?.id || "" }); setShowModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5227FF] to-[#8C6DFD] text-sm font-bold text-white">
            <Plus className="h-4 w-4" /> Create Gig
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {gigs.map((g) => (
          <div key={g.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <button onClick={() => setOpenId(openId === g.id ? null : g.id)}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02]">
              <div>
                <p className="font-semibold text-white text-[14px]">{g.title}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{g.club?.name || "—"} · ₹{g.payMin}-{g.payMax} · {g.applications.length} apps</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); deleteGig(g.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                <ChevronDown className={`h-4 w-4 text-white/30 transition-transform ${openId === g.id ? "rotate-180" : ""}`} />
              </div>
            </button>
            <AnimatePresence>
              {openId === g.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/[0.04]">
                  <p className="px-5 py-3 text-xs text-white/40 leading-relaxed">{g.description}</p>
                  <div className="px-4 pb-4 space-y-1.5">
                    {g.applications.map((a) => {
                      const hasSubmission = !!a.workDescription?.trim() || !!a.submissionFileUrl?.trim();
                      return (
                        <div key={a.id} className="rounded-xl bg-black/20 border border-white/[0.04] px-4 py-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[13px] font-medium text-white">{a.user.fullName}</span>
                              <span className="text-[10px] text-white/30 ml-2">{a.user.email}</span>
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${a.status === "APPROVED" ? "bg-[#00E87A]/15 text-[#00E87A]" : a.status === "REJECTED" ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-200"}`}>
                              {a.status}
                            </span>
                          </div>

                          {a.message ? (
                            <p className="mt-2 text-[12px] text-white/45">{a.message}</p>
                          ) : null}

                          {a.status === "PENDING" ? (
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                disabled={busyId === a.id}
                                onClick={() => void setStatus(a.id, "APPROVED")}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100 disabled:opacity-50"
                              >
                                {busyId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={busyId === a.id}
                                onClick={() => void setStatus(a.id, "REJECTED")}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-red-100 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          ) : null}

                          {hasSubmission ? (
                            <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5">
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/90">
                                  Project submission
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                    a.submissionVerified
                                      ? "bg-emerald-500/20 text-emerald-200"
                                      : "bg-amber-500/20 text-amber-100"
                                  }`}
                                >
                                  {a.submissionVerified ? "Verified" : "Pending verification"}
                                </span>
                              </div>

                              {a.workDescription ? (
                                <p className="text-[12px] leading-relaxed text-white/70">{a.workDescription}</p>
                              ) : null}

                              {a.submissionFileUrl ? (
                                <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-white/[0.08] bg-black/20 px-2.5 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] font-medium text-white/80">
                                      {a.submissionFileName || "submission-file"}
                                    </p>
                                    <p className="text-[10px] text-white/35">
                                      {a.submissionFileMime || "document"}
                                      {typeof a.submissionFileSize === "number"
                                        ? ` · ${(a.submissionFileSize / (1024 * 1024)).toFixed(2)} MB`
                                        : ""}
                                    </p>
                                  </div>
                                  <a
                                    href={a.submissionFileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="shrink-0 rounded-md border border-white/20 px-2 py-1 text-[10px] font-semibold text-white/80 hover:bg-white/[0.07]"
                                  >
                                    Open
                                  </a>
                                </div>
                              ) : null}

                              {!a.submissionVerified ? (
                                <button
                                  type="button"
                                  disabled={verifyBusyId === a.id}
                                  onClick={() => void verifySubmission(a.id)}
                                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100 disabled:opacity-50"
                                >
                                  {verifyBusyId === a.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Verify
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {g.applications.length === 0 && <p className="text-xs text-white/20 text-center py-4">No applications yet</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-lg rounded-2xl border border-[#5227FF]/20 bg-[#0D0F1C] p-6">
              <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-bold text-white">Create Gig</h2><button onClick={() => setShowModal(false)} className="text-white/50"><X className="h-4 w-4" /></button></div>
              <div className="space-y-4">
                <div><label className="text-[10px] font-bold uppercase text-white/40 block mb-1">Club</label>
                  <select value={form.clubId} onChange={(e) => setForm((p) => ({ ...p, clubId: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none">
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#0D0F1C] text-white">
                        {c.name}
                      </option>
                    ))}
                  </select></div>
                <div><label className="text-[10px] font-bold uppercase text-white/40 block mb-1">Title</label>
                  <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none" /></div>
                <div><label className="text-[10px] font-bold uppercase text-white/40 block mb-1">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none resize-none" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] font-bold uppercase text-white/40 block mb-1">Pay Min (₹)</label>
                    <input type="number" value={form.payMin} onChange={(e) => setForm((p) => ({ ...p, payMin: parseInt(e.target.value) || 0 }))} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none" /></div>
                  <div><label className="text-[10px] font-bold uppercase text-white/40 block mb-1">Pay Max (₹)</label>
                    <input type="number" value={form.payMax} onChange={(e) => setForm((p) => ({ ...p, payMax: parseInt(e.target.value) || 0 }))} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none" /></div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.06]">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-white/50">Cancel</button>
                <button onClick={save} disabled={loading} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#5227FF] to-[#8C6DFD] text-sm font-bold text-white disabled:opacity-50">{loading ? "..." : "Create"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
