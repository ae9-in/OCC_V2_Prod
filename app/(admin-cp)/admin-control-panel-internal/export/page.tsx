"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Users, Settings, ShieldCheck, Mail, Lock, X, Loader2, Calendar, ChevronRight, Activity, ScrollText } from "lucide-react";
import { toast } from "sonner";

const exportCategories = [
  { type: "users", label: "Users Details", desc: "Full directory including phone, email, college, and referral history", icon: Users, color: "#5227FF" },
  { type: "headers", label: "Club Headers", desc: "List of all club headers, their assigned clubs, and active referral codes", icon: Settings, color: "#00E87A" },
  { type: "clubs", label: "Club Overview", desc: "Summary of all active clubs, member counts, and header assignments", icon: Settings, color: "#8C6DFD" },
  { type: "activity", label: "Platform Activity", desc: "Timeline of auth, social, and profile actions with full timestamps", icon: Activity, color: "#FFA500" },
  { type: "audit", label: "Admin Audit Log", desc: "Detailed history of admin actions, including entity changes and system updates", icon: ScrollText, color: "#FF4500" },
];

const datePresets = [
  { id: "all", label: "All Time", value: null },
  { id: "1w", label: "1 Week", days: 7 },
  { id: "1m", label: "1 Month", days: 30 },
  { id: "3m", label: "3 Months", days: 90 },
  { id: "6m", label: "6 Months", days: 180 },
];

export default function ExportPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"SELECT" | "VERIFY_EMAIL" | "VERIFY_OTP">("SELECT");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Date Filtering State
  const [activePreset, setActivePreset] = useState("all");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });

  const getEffectiveDates = () => {
    if (activePreset === "custom") {
      return customRange;
    }
    const preset = datePresets.find(p => p.id === activePreset);
    if (!preset || preset.id === "all") return { from: null, to: null };
    
    const to = new Date().toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - (preset.days || 0));
    const from = fromDate.toISOString().split('T')[0];
    
    return { from, to };
  };

  const handleStartExport = (type: string) => {
    setSelected(type);
    setStep("VERIFY_EMAIL");
  };

  const handleRequestOtp = async () => {
    if (!email) return toast.error("Please enter an email");
    setLoading(true);
    try {
      const res = await fetch("/api/admin-cp/export/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      toast.success("Verification code sent to your email");
      setStep("VERIFY_OTP");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) return toast.error("Please enter the 6-digit code");
    setLoading(true);
    try {
      const res = await fetch("/api/admin-cp/export/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setToken(data.exportToken);
      toast.success("Identity verified");
      
      // Auto-trigger download
      triggerDownload(data.exportToken);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = async (exportToken: string) => {
    if (!selected) return;
    setLoading(true);
    try {
      const { from, to } = getEffectiveDates();
      let url = `/api/admin-cp/export/${selected}?t=${Date.now()}`;
      if (from) url += `&from=${from}`;
      if (to) url += `&to=${to}`;

      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${exportToken}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Download failed");
      }
      
      const blob = await res.blob();
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const dateStr = from && to ? `${from}-to-${to}` : "all-time";
      a.download = `occ-${selected}-export-${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objUrl);
      a.remove();
      
      toast.success("Export completed successfully");
      setStep("SELECT");
      setSelected(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
        <div>
          <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Data Export</h1>
          <p className="text-white/40 text-lg">Securely export campus data for audit and reporting purposes.</p>
        </div>
        
        {/* Date Presets UI */}
        <div className="flex flex-wrap gap-2 p-1.5 bg-white/[0.03] rounded-2xl border border-white/5">
          {datePresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setActivePreset(preset.id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activePreset === preset.id 
                ? "bg-white/10 text-white shadow-lg" 
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.02]"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setActivePreset("custom")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activePreset === "custom" 
              ? "bg-indigo-500/20 text-indigo-400" 
              : "text-white/40 hover:text-white/60 hover:bg-white/[0.02]"
            }`}
          >
            <Calendar size={14} /> Custom
          </button>
        </div>
      </div>

      {/* Custom Date Range Inputs */}
      <AnimatePresence>
        {activePreset === "custom" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-10"
          >
            <div className="flex flex-wrap items-center gap-4 p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-indigo-400/60 uppercase ml-1">From Date</label>
                <input 
                  type="date" 
                  value={customRange.from}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
                  className="bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-white text-sm focus:border-indigo-500/50 outline-none" 
                />
              </div>
              <ChevronRight className="text-white/20 mt-4 hidden md:block" size={20} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-indigo-400/60 uppercase ml-1">To Date</label>
                <input 
                  type="date" 
                  value={customRange.to}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
                  className="bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-white text-sm focus:border-indigo-500/50 outline-none" 
                />
              </div>
              <div className="ml-auto text-xs text-white/30 max-w-[200px] leading-relaxed">
                Filter data based on creation date. Leave blank for no limit.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {exportCategories.map((cat) => (
          <motion.div
            key={cat.type}
            whileHover={{ y: -6, scale: 1.02 }}
            className="group relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-8 transition-all hover:bg-white/[0.05] hover:border-white/20"
          >
            <div 
              className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-opacity-10 shadow-inner"
              style={{ backgroundColor: `${cat.color}20` }}
            >
              <cat.icon className="h-7 w-7" style={{ color: cat.color }} />
            </div>
            <h3 className="mb-3 text-2xl font-bold text-white tracking-tight">{cat.label}</h3>
            <p className="mb-8 text-sm leading-relaxed text-white/40 font-medium">{cat.desc}</p>
            <button
              onClick={() => handleStartExport(cat.type)}
              className="group/btn relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white/5 py-4 text-sm font-black text-white transition-all hover:bg-white/10 active:scale-95"
            >
              <Download size={18} className="transition-transform group-hover/btn:-translate-y-0.5" /> 
              Export XLSX
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10 transform scale-x-0 transition-transform group-hover/btn:scale-x-100" />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Security Verification Modal */}
      <AnimatePresence>
        {step !== "SELECT" && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-black/80">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-full max-w-md rounded-[2.5rem] border border-white/10 bg-[#0F111A] p-10 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]"
            >
              <div className="mb-8 flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <ShieldCheck size={28} />
                </div>
                <button onClick={() => setStep("SELECT")} className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 text-white/20 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <h2 className="text-3xl font-black text-white mb-3 tracking-tight">Security Check</h2>
              <p className="text-base text-white/40 mb-10 leading-relaxed font-medium">
                {step === "VERIFY_EMAIL" 
                  ? "Enter your registered personal email to receive a secure verification code." 
                  : `Enter the security code sent to your inbox.`}
              </p>

              <div className="space-y-6">
                {step === "VERIFY_EMAIL" ? (
                  <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within:text-indigo-400" size={20} />
                    <input
                      type="email"
                      placeholder="Admin personal email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-white/5 bg-white/[0.02] py-5 pl-14 pr-6 text-white text-lg focus:border-indigo-500/50 focus:bg-white/[0.04] focus:outline-none transition-all placeholder:text-white/10"
                    />
                  </div>
                ) : (
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within:text-indigo-400" size={20} />
                    <input
                      type="text"
                      placeholder="······"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full rounded-2xl border border-white/5 bg-white/[0.02] py-5 pl-14 pr-6 text-white tracking-[0.8em] text-center font-mono text-2xl focus:border-indigo-500/50 focus:bg-white/[0.04] focus:outline-none transition-all placeholder:text-white/10"
                    />
                  </div>
                )}

                <button
                  disabled={loading}
                  onClick={step === "VERIFY_EMAIL" ? handleRequestOtp : handleVerifyOtp}
                  className="flex w-full items-center justify-center gap-3 rounded-[1.25rem] bg-[#5227FF] py-5 text-lg font-black text-white shadow-[0_10px_20px_-10px_rgba(82,39,255,0.4)] transition-all hover:translate-y-[-2px] hover:shadow-[0_15px_30px_-10px_rgba(82,39,255,0.5)] active:translate-y-0 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={24} /> : (step === "VERIFY_EMAIL" ? "Request Access" : "Verify & Download")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
