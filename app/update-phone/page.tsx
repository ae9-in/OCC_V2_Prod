"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function UpdatePhonePage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!/^[6-9]/.test(cleanPhone)) {
      toast.error("Mobile number must start with 6, 7, 8, or 9.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/update-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data as any)?.error || "Failed to save phone number");
      }

      toast.success("Phone number saved!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]" />

      <div className="w-full max-w-xl mx-auto z-10">
        <div className="mb-12 flex justify-between items-center text-sm font-medium text-white/40 border-b border-white/10 pb-6">
          <span className="text-white font-semibold">OCC.</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
              One more thing.
            </h1>
            <p className="text-lg text-white/50">
              Add your mobile number to complete your profile.
            </p>
            <p className="text-sm text-white/35 mt-2">
              This helps your club leaders stay in touch with you.
            </p>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-white/60 uppercase tracking-wider">
              Mobile Number
            </label>
            <div className="relative">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 font-medium select-none">
                +91
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={phoneNumber}
                onChange={(e) =>
                  setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="00000 00000"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-16 pr-6 py-4 text-white font-medium text-xl focus:outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all placeholder:text-white/20"
              />
            </div>
            {phoneNumber.length > 0 && phoneNumber.length < 10 && (
              <p className="text-xs text-amber-500/80">
                Keep typing… {phoneNumber.length}/10 digits
              </p>
            )}
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || phoneNumber.length !== 10}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-500 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.2)]"
            >
              {loading ? (
                <>
                  {React.createElement(Loader2 as any, {
                    className: "w-5 h-5 animate-spin",
                  })}
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <span>Save &amp; Continue</span>
                  {React.createElement(CheckCircle2 as any, {
                    className: "w-5 h-5",
                  })}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
