"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Grid3X3, Users, FileText, Calendar, Orbit, Briefcase,
  CheckCircle2, TrendingUp, ScrollText, Settings, Download,
  ChevronRight, LogOut, MoreHorizontal, Shield, Flag, ToggleLeft, Radio, Clock, FileKey,
  ClipboardCheck
} from "lucide-react";
import { adminCpHref, ADMIN_CP_PREFIX } from "@/lib/staff-paths";
import { type AdminLevel, can, type AdminModule, type EffectiveAdminAccess } from "@/lib/admin-permissions";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useLogout } from "@/hooks/useLogout";
import { OCC_BRAND_ICON } from "@/lib/brand";

type NavItem = {
  path: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: string;
  module: AdminModule | "dashboard";
};

const nav: NavItem[] = [
  { path: "", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
  { path: "/clubs", label: "Clubs", icon: Grid3X3, module: "clubs" },
  { path: "/users", label: "Users", icon: Users, module: "users" },
  { path: "/posts", label: "Posts", icon: FileText, module: "posts" },
  { path: "/events", label: "Events", icon: Calendar, module: "events" },
  { path: "/orbit", label: "Orbit", icon: Orbit, module: "orbit" },
  { path: "/gigs", label: "Gigs", icon: Briefcase, module: "gigs" },
  { path: "/gigs/applications", label: "Applications", icon: ClipboardCheck, module: "gigs" },
  { path: "/approvals", label: "Approvals", icon: CheckCircle2, badgeKey: "pending", module: "approvals" },
  { path: "/moderation", label: "Moderation", icon: Flag, module: "moderation" },
  { path: "/analytics", label: "Analytics", icon: TrendingUp, module: "analytics" },
  { path: "/export", label: "Export", icon: Download, module: "export" },
  { path: "/activity", label: "Activity", icon: ScrollText, module: "audit" },
  { path: "/audit", label: "Audit Log", icon: ScrollText, module: "audit" },
  { path: "/roles", label: "Roles", icon: Shield, module: "roles" },
  { path: "/feature-flags", label: "Feature flags", icon: ToggleLeft, module: "feature_flags" },
  { path: "/broadcasts", label: "Broadcasts", icon: Radio, module: "broadcasts" },
  { path: "/scheduled-announcements", label: "Scheduled banners", icon: Clock, module: "announcement_schedule" },
  { path: "/compliance", label: "Compliance", icon: FileKey, module: "compliance" },
  { path: "/settings", label: "Settings", icon: Settings, module: "settings" },
];

function toEffectiveAccess(
  adminAccess: { fullAccess: true } | { fullAccess: false; matrix: Record<string, string[]> },
): EffectiveAdminAccess {
  if (adminAccess.fullAccess) return { fullAccess: true };
  return { fullAccess: false, matrix: adminAccess.matrix };
}

export function AdminCPShell({
  children, pendingCount, alertCount, adminUser, adminAccess,
}: {
  children: React.ReactNode;
  pendingCount: number;
  alertCount: number;
  adminUser: {
    id: string;
    fullName: string;
    email: string;
    adminLevel: string | null;
    roleTemplateName?: string | null;
  };
  adminAccess: { fullAccess: true } | { fullAccess: false; matrix: Record<string, string[]> };
}) {
  const pathname = usePathname();
  const logout = useLogout();
  const [mounted, setMounted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const al = (adminUser.adminLevel ?? "SUPER_ADMIN") as AdminLevel;
  const access = toEffectiveAccess(adminAccess);

  const visibleNav = nav.filter((item) => {
    if (item.module === "dashboard") return true;
    return can(access, item.module, "read");
  });

  useEffect(() => {
    setMounted(true);
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const navWithHref = visibleNav.map((item) => ({ ...item, href: adminCpHref(item.path) }));

  const getBadge = (key?: string) => {
    if (key === "pending" && pendingCount > 0) return pendingCount;
    if (key === "alerts" && alertCount > 0) return alertCount;
    return 0;
  };

  return (
    <div className="relative min-h-screen bg-[#070914] text-[#F5F1EB] overflow-hidden">
      {/* Background */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#5227FF] opacity-[0.08] blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00E87A] opacity-[0.04] blur-[150px] pointer-events-none" />

      <div className="flex h-screen max-w-[1920px] mx-auto relative z-10">
        {/* SIDEBAR */}
        <motion.aside
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative hidden w-[280px] flex-col border-r border-[#5227FF]/15 bg-white/[0.015] backdrop-blur-3xl md:flex z-50 pt-2 pb-6 px-3"
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-3 py-6 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-[0_0_20px_rgba(82,39,255,0.4)]">
              <img src={OCC_BRAND_ICON} alt="OCC" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg tracking-wide text-white flex items-center gap-2 font-semibold">
                OCC
                <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#5227FF] to-[#8C6DFD] text-[8px] uppercase tracking-widest font-bold text-white">
                  Control Panel
                </span>
              </span>
            </div>
          </div>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
            <nav className="space-y-0.5">
              {navWithHref.map(({ href, label, icon: Icon, badgeKey, module }) => {
                const active = pathname === href ||
                  (href !== ADMIN_CP_PREFIX && pathname.startsWith(href + "/")) ||
                  (href === ADMIN_CP_PREFIX && pathname === ADMIN_CP_PREFIX);
                const badge = getBadge(badgeKey);

                return (
                  <Link href={href} key={href} className="relative block">
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`relative flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-all duration-300 z-10 ${
                        active ? "text-white" : "text-white/35 hover:text-white/80 hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-[18px] w-[18px] ${active ? "text-white" : ""}`} strokeWidth={active ? 2.5 : 2} />
                        <span className={`text-[13px] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
                      </div>
                      {badge > 0 && (
                        <div className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                          badgeKey === "alerts"
                            ? "bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                            : "bg-[#00E87A] text-[#070914] shadow-[0_0_8px_rgba(0,232,122,0.5)]"
                        }`}>
                          {badge}
                        </div>
                      )}
                    </motion.div>
                    {active && mounted && (
                      <motion.div
                        layoutId="acp-sidebar-active"
                        className="absolute inset-0 z-0 rounded-xl bg-gradient-to-r from-[#5227FF]/20 to-transparent border-l-2 border-[#5227FF]"
                        initial={false}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Profile */}
          <div className="mt-auto px-1 relative" ref={profileRef}>
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -4 }} exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full left-0 w-full mb-2 p-2 rounded-xl bg-[#0F111A] border border-[#5227FF]/20 shadow-2xl z-[60]"
                >
                  <button onClick={logout} className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-red-500/10 text-red-400 transition-all font-bold text-sm">
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <div
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center justify-between group cursor-pointer rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 hover:bg-white/[0.04] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#5227FF] to-[#8C6DFD] text-sm font-bold text-white">
                  {adminUser.fullName.charAt(0)}
                </div>
                <div className="flex flex-col max-w-[120px]">
                  <span className="text-[13px] font-semibold text-white/90 truncate">{adminUser.fullName}</span>
                  <span className="text-[9px] font-medium text-[#5227FF] uppercase tracking-wider truncate">
                    {adminUser.roleTemplateName
                      ? adminUser.roleTemplateName
                      : al === "MODERATOR"
                        ? "Moderator"
                        : "Super Admin"}
                  </span>
                </div>
              </div>
              <MoreHorizontal className="h-4 w-4 text-white/40" />
            </div>
          </div>
        </motion.aside>

        {/* MAIN */}
        <div className="flex flex-1 flex-col overflow-hidden relative z-10">
          <motion.header
            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="flex items-center justify-between border-b border-white/[0.05] bg-white/[0.01] backdrop-blur-2xl px-6 py-3.5 md:px-8 z-30 sticky top-0"
          >
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 text-xs">
              <span className="font-semibold text-white/50">Admin</span>
              <ChevronRight className="h-3 w-3 text-white/30" />
              <span className="font-semibold text-white">Control Panel</span>
              <ChevronRight className="h-3 w-3 text-white/30" />
              <span className="font-semibold text-[#5227FF]">
                {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            </div>
            <div className="flex items-center gap-3">
            </div>
          </motion.header>

          <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8 scrollbar-hide max-w-[1400px] mx-auto w-full pb-32 md:pb-8">
            {children}
          </main>
        </div>
      </div>

      {/* MOBILE NAV */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#070914]/95 backdrop-blur-2xl border-t border-[#5227FF]/20 z-[100] md:hidden flex items-center justify-around px-1">
        {navWithHref.slice(0, 5).map((item) => {
          const isActive = pathname === item.href || (item.href !== ADMIN_CP_PREFIX && pathname.startsWith(item.href + "/"));
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="flex flex-col items-center justify-center w-14 h-full">
              <Icon className={`h-5 w-5 ${isActive ? "text-[#5227FF]" : "text-white/35"}`} strokeWidth={isActive ? 3 : 2} />
              <span className={`text-[8px] font-bold uppercase mt-1 ${isActive ? "text-[#5227FF]" : "text-white/20"}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
