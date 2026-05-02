"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, ArrowRight, MessageCircle, Globe, Users, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { REFERRAL_CODE_MIN_LEN } from "@/lib/validations";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/app/components/ui/input-otp";
import { isLegitIndianMobile } from "@/lib/phone-utils";

const REFERRAL_SOURCES = [
  { id: "Instagram", icon: Globe },
  { id: "LinkedIn", icon: MessageCircle },
  { id: "From a friend", icon: Users },
  { id: "Official college event", icon: GraduationCap },
  { id: "Google search", icon: Globe },
  { id: "Other", icon: Users },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Auto-skip logic for existing users with no phone
  useEffect(() => {
    async function checkExistingProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const profile = await res.json();
          const user = profile.user;
          // If they haven't verified phone, force Step 3.
          // Otherwise, if they have a college name, they might have skipped previous steps.
          if (user.phoneVerified === false) {
            if (user.collegeName && user.collegeName !== "Not specified") {
              setCollegeName(user.collegeName);
            }
            if (user.referralSource) {
              setReferralSource(user.referralSource);
            }
            setStep(3);
          } else if (user.onboardingComplete === true) {
            router.push("/dashboard");
          }
        } else if (res.status === 401) {
          window.location.href = "/login?reauth=1";
        }
      } catch (e) {
        console.error("Failed to check profile status", e);
      } finally {
        setInitializing(false);
      }
    }
    checkExistingProfile();
  }, []);
  
  // Step 1
  const [referralSource, setReferralSource] = useState("");
  
  // Step 2
  const [collegeName, setCollegeName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [clubInfo, setClubInfo] = useState<{name: string, headerName: string} | null>(null);
  const [codeSuggestion, setCodeSuggestion] = useState<string | null>(null);

  // Step 3
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");

  const referralValidateSeq = useRef(0);

  // Debounce referral code validation
  useEffect(() => {
    const trimmed = referralCode.trim();
    if (!trimmed) {
      setCodeValid(null);
      setClubInfo(null);
      setCodeSuggestion(null);
      setCodeValidating(false);
      return;
    }
    if (trimmed.length < REFERRAL_CODE_MIN_LEN) {
      setCodeValid(null);
      setClubInfo(null);
      setCodeSuggestion(null);
      setCodeValidating(false);
      return;
    }

    const requestId = ++referralValidateSeq.current;
    const validateCode = async () => {
      setCodeValidating(true);
      try {
        const res = await fetch("/api/referral/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: trimmed }),
          cache: "no-store",
        });
        const data = (await res.json()) as {
          valid?: boolean;
          club?: { name: string };
          headerName?: string;
          suggestion?: string;
        };
        if (requestId !== referralValidateSeq.current) return;

        if (data.valid) {
          setCodeValid(true);
          setCodeSuggestion(null);
          setClubInfo({ name: data.club?.name || "the club", headerName: data.headerName || "the club leader" });
        } else {
          setCodeValid(false);
          setClubInfo(null);
          setCodeSuggestion(
            typeof data.suggestion === "string" && data.suggestion.length >= REFERRAL_CODE_MIN_LEN
              ? data.suggestion
              : null,
          );
        }
      } catch {
        if (requestId !== referralValidateSeq.current) return;
        setCodeValid(false);
        setClubInfo(null);
        setCodeSuggestion(null);
      } finally {
        if (requestId === referralValidateSeq.current) {
          setCodeValidating(false);
        }
      }
    };

    const timer = setTimeout(validateCode, 500);
    return () => {
      clearTimeout(timer);
      referralValidateSeq.current++;
    };
  }, [referralCode]);

  const handleNextStep = () => {
    if (!referralSource) {
      toast.error("Please select an option to continue");
      return;
    }
    setStep(2);
  };

  const handleMoveToPhone = (skipCode = false) => {
    if (collegeName.trim().length < 2) {
      toast.error("Please enter your college / university name.");
      return;
    }
    if (skipCode) {
      setReferralCode("");
    }
    setStep(3);
  };


  const handleFinalSubmit = async () => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        referralSource,
        collegeName: collegeName.trim(),
        referralCode: referralCode.trim().toUpperCase(),
        phoneNumber: cleanPhone,
      };

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete onboarding");
      }
      
      toast.success("Welcome aboard!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]" />

      <div className="w-full max-w-xl mx-auto z-10">
        {/* Progress header */}
        <div className="mb-12 flex justify-between items-center text-sm font-medium text-white/40 border-b border-white/10 pb-6">
          <div className="flex space-x-2">
            <span className="text-white">OCC.</span>
          </div>
          <div className="flex space-x-2 items-center">
            <span className={step >= 1 ? "text-white" : ""}>01</span>
            <span className="w-8 h-[1px] bg-white/20 block" />
            <span className={step >= 2 ? "text-white" : ""}>02</span>
            <span className="w-8 h-[1px] bg-white/20 block" />
            <span className={step >= 3 ? "text-white" : ""}>03</span>
          </div>
        </div>

        <React.Fragment>
          {initializing ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-white/40 font-medium">Preparing your setup...</p>
            </div>
          ) : step === 1 && (
            <div
              key="step1"
              className="space-y-8"
            >
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
                  Welcome aboard.
                </h1>
                <p className="text-lg text-white/50">
                  How did you reach us? Tell us how you heard about OCC.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REFERRAL_SOURCES.map((source) => {
                  const Icon = source.icon as any;
                  const isSelected = referralSource === source.id;
                  return (
                    <button
                      key={source.id}
                      onClick={() => setReferralSource(source.id)}
                      className={`flex flex-col items-start p-5 rounded-2xl border transition-all duration-300 ${
                        isSelected 
                        ? "border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]" 
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-4 ${isSelected ? "text-blue-400" : "text-white/40"}`} />
                      <span className={`font-medium ${isSelected ? "text-white" : "text-white/70"}`}>
                        {source.id}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-6">
                <button
                  onClick={handleNextStep}
                  disabled={!referralSource}
                  className="w-full flex items-center justify-center space-x-2 bg-white text-black py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Continue</span>
                  {React.createElement(ArrowRight as any, { className: "w-5 h-5" })}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div
              key="step2"
              className="space-y-8"
            >
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
                  Got an invite?
                </h1>
                <p className="text-lg text-white/50">
                  Enter your referral code to join a specific club. You can skip this if you don&apos;t have one.
                </p>
                <p className="text-sm text-white/35 mt-2">
                  Use the exact code from your club leader (letters only). A single missing or extra letter will fail—try the suggested fix if we show one.
                </p>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-medium text-white/60 uppercase tracking-wider">
                  College / University
                </label>
                <input
                  type="text"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  placeholder="Enter your college name"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-5 py-4 text-white font-medium text-base focus:outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all placeholder:text-white/20"
                />
              </div>

              <div className="space-y-4">
                <label className="text-sm font-medium text-white/60 uppercase tracking-wider">
                  Referral Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. OCC2024"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-5 py-4 text-white font-medium text-lg focus:outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all placeholder:text-white/20 uppercase"
                  />
                  {codeValidating && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                      {React.createElement(Loader2 as any, { className: "w-5 h-5 animate-spin" })}
                    </div>
                  )}
                </div>

                <React.Fragment>
                  {codeValid === true && clubInfo && (
                    <div
                      className="flex items-center space-x-2 text-emerald-400 text-sm font-medium bg-emerald-400/10 px-4 py-3 rounded-lg border border-emerald-400/20 overflow-hidden"
                    >
                      {React.createElement(CheckCircle2 as any, { className: "w-4 h-4 shrink-0" })}
                      <span>Valid code! You'll be joining <strong>{clubInfo.name}</strong> alongside {clubInfo.headerName}.</span>
                    </div>
                  )}
                  {codeValid === false &&
                    referralCode.trim().length >= REFERRAL_CODE_MIN_LEN &&
                    !codeValidating && (
                    <div
                      className="space-y-3 text-rose-400 text-sm font-medium bg-rose-400/10 px-4 py-3 rounded-lg border border-rose-400/20 overflow-hidden"
                    >
                      <div className="flex items-start gap-2">
                        {React.createElement(XCircle as any, { className: "w-4 h-4 shrink-0 mt-0.5" })}
                        <span>
                          We couldn&apos;t verify that code. Compare it letter-for-letter with your leader&apos;s code, or use a suggestion below if one appears.
                        </span>
                      </div>
                      {codeSuggestion ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pl-6 border-t border-rose-400/20 pt-3">
                          <span className="text-white/80 text-xs font-normal">
                            Did you mean <strong className="font-mono text-emerald-300">{codeSuggestion}</strong>?
                          </span>
                          <button
                            type="button"
                            onClick={() => setReferralCode(codeSuggestion)}
                            className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 w-fit"
                          >
                            Use {codeSuggestion}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </React.Fragment>
              </div>

              <div className="pt-6 flex flex-col space-y-4">
                <button
                  type="button"
                  onClick={() => handleMoveToPhone(false)}
                  disabled={
                    loading ||
                    collegeName.trim().length < 2 ||
                    (referralCode.trim().length > 0 && codeValid !== true)
                  }
                  className="w-full flex items-center justify-center space-x-2 bg-white text-black py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{referralCode.trim() ? "Continue with this code" : "Continue"}</span>
                  {React.createElement(ArrowRight as any, { className: "w-5 h-5" })}
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveToPhone(true)}
                  disabled={loading || collegeName.trim().length < 2}
                  className="w-full py-3 text-sm font-medium text-white/50 hover:text-white/80 transition-colors disabled:opacity-30"
                >
                  Skip — I don&apos;t have a referral code
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div
              key="step3"
              className="space-y-8"
            >
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
                  Almost there.
                </h1>
                <p className="text-lg text-white/50">
                  Enter your mobile number to complete your profile.
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
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 font-medium">
                    +91
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="00000 00000"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-16 pr-6 py-4 text-white font-medium text-xl focus:outline-none focus:border-white/30 focus:bg-white/[0.05] transition-all placeholder:text-white/20"
                  />
                </div>
                {phoneNumber.length > 0 && phoneNumber.length < 10 && (
                   <p className="text-xs text-amber-500/80">Keep typing... {phoneNumber.length}/10 digits</p>
                )}

              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={loading || phoneNumber.length !== 10}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-500 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.2)]"
                >
                  {loading ? (
                     <>
                        {React.createElement(Loader2 as any, { className: "w-5 h-5 animate-spin" })}
                        <span>Setting up your account...</span>
                     </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      {React.createElement(CheckCircle2 as any, { className: "w-5 h-5" })}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={loading}
                  className="w-full py-3 text-sm font-medium text-white/50 hover:text-white/80 transition-colors disabled:opacity-30"
                >
                  Go back
                </button>
              </div>
            </div>
          )}
        </React.Fragment>
      </div>
    </div>
  );
}
