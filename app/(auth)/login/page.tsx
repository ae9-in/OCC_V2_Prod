"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { STAFF_PUBLIC_PREFIX } from "@/lib/staff-paths";
import { Interactive3DModel } from "@/app/components/auth/Interactive3DModel";

function Particles() {
  const [dots, setDots] = useState<any[]>([]);
  useEffect(() => {
    setDots([...Array(50)].map((_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 2 + Math.random() * 2,
      delay: Math.random() * 2,
    })));
  }, []);

  return (
    <>
      {dots.map((dot, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{ left: dot.left, top: dot.top }}
          animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.5, 1] }}
          transition={{ duration: dot.duration, repeat: Infinity, delay: dot.delay }}
        />
      ))}
    </>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const reauth = searchParams.get("reauth") === "1";
  const oauthError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
        role?: string;
        approvalStatus?: string;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? "Invalid credentials. Please try again.");
        return;
      }

      const role = data?.role;
      const approval = data?.approvalStatus;
      const hasPhone = data?.hasPhone;
      let next = redirectTo;
      if (!redirectTo || redirectTo === "/dashboard") {
        if (hasPhone === false) next = "/update-phone";
        else if (role === "ADMIN") next = STAFF_PUBLIC_PREFIX;
        else if (role === "CLUB_HEADER" && approval === "APPROVED") next = "/header/dashboard";
        else if (role === "CLUB_HEADER" && approval === "PENDING") next = "/pending";
        else next = "/dashboard";
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const target = `/api/auth/google/start?redirect=${encodeURIComponent(redirectTo)}`;
    window.location.assign(target);
  };

  const openForgot = () => {
    setForgotOpen(true);
    setResetEmail(email || "");
    setNewPassword("");
    setConfirmNewPassword("");
    setResetSuccess("");
    setResetError("");
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setResetError("Enter a valid email.");
      return;
    }
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setResetError("Password must include uppercase, lowercase, and number.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setResetting(true);
    try {
      const res = await fetch("/api/auth/password-reset/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: resetEmail.trim(),
          newPassword,
          confirmNewPassword,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setResetError(data?.error || "Password reset failed. Make sure the email is registered.");
        return;
      }
      setForgotOpen(false);
      router.push("/dashboard");
      router.refresh();
    } catch {
      setResetError("Password reset failed.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Login Form */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24 bg-white"
      >
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <span aria-hidden>←</span>
            Back to landing
          </a>
        </div>

        {/* Logo */}
        <div className="mb-12">
          <h1 className="text-4xl font-black tracking-tight text-gray-900 flex items-center">
            occ
            <motion.span
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="ml-1.5 h-3 w-3 rounded-full bg-[#3B5BFF]"
            />
          </h1>
          <p className="text-sm text-gray-500 mt-1">Off Campus Clubs</p>
        </div>

        {/* Language Selector - Top Right on Desktop */}
        <div className="absolute top-8 right-8 hidden lg:flex items-center gap-2 text-sm text-gray-600">
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30'%3E%3Crect width='60' height='30' fill='%23012169'/%3E%3Cpath d='M0,0 L60,30 M60,0 L0,30' stroke='%23fff' stroke-width='6'/%3E%3Cpath d='M0,0 L60,30 M60,0 L0,30' stroke='%23C8102E' stroke-width='4'/%3E%3Cpath d='M30,0 v30 M0,15 h60' stroke='%23fff' stroke-width='10'/%3E%3Cpath d='M30,0 v30 M0,15 h60' stroke='%23C8102E' stroke-width='6'/%3E%3C/svg%3E"
            alt="UK Flag"
            className="w-5 h-3"
          />
          <span>EN</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-8"
        >
          <h2 className="text-5xl md:text-6xl font-black text-gray-900 mb-2">Hi there!</h2>
          <p className="text-gray-600">Welcome to OCC. Community Dashboard</p>
        </motion.div>

        {reauth ? (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Your session expired or became invalid. Please log in again.
          </div>
        ) : null}

        {oauthError ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {oauthError}
          </div>
        ) : null}

        {/* Form */}
        {!forgotOpen ? (
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Log in with Google
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or</span>
            </div>
          </div>

          {/* Email Input */}
          <div>
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={openForgot}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Forgot password?
            </button>
          </div>

          {/* Error Message */}
          {error ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm"
            >
              {error}
            </motion.div>
          ) : null}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Logging in...
              </>
            ) : (
              "Log in"
            )}
          </button>

          {/* Sign Up Link */}
          <p className="text-center text-gray-600 text-sm">
            Don&apos;t have an account?{" "}
            <a href="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
              Sign up
            </a>
          </p>
        </motion.form>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-gray-200 bg-gray-50/70 p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Reset password</h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                Back to login
              </button>
            </div>

            <form onSubmit={resetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">New password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-gray-900"
                />
              </div>

              {resetSuccess ? <p className="text-xs text-emerald-700">{resetSuccess}</p> : null}
              {resetError ? <p className="text-xs text-red-600">{resetError}</p> : null}

              <button
                type="submit"
                disabled={resetting}
                className="w-full rounded-full bg-gray-900 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {resetting ? "Resetting..." : "Reset password"}
              </button>
            </form>
          </motion.div>
        )}
      </motion.div>

      {/* Right Side - Illustration */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden"
      >
        {/* Particle Background */}
        <div className="absolute inset-0">
          <Particles />
        </div>

        {/* Top Right Buttons */}
        <div className="absolute top-8 right-8 flex items-center gap-3 z-10">

        </div>

        {/* Community Badge */}
        <div className="absolute top-24 right-8 flex items-center gap-3 bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/20 z-10">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-gray-900"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">OFF-Campus Club</p>
            <p className="text-white/70 text-xs">Community</p>
          </div>
        </div>

        {/* Main Illustration */}
        <div className="relative w-full h-[600px] flex items-center justify-center p-12">
          <Interactive3DModel />
        </div>

        {/* Bottom Text */}
        <div className="absolute bottom-12 left-12 right-12 z-10">
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="text-4xl font-bold text-white leading-tight"
          >
            Join anywhere you want in a
            <br />
            Clubs full of wonders!
          </motion.h3>
        </div>

      </motion.div>
    </div>
  );
}



export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0C0C0A]" aria-hidden />}>
      <LoginPageInner />
    </Suspense>
  );
}
