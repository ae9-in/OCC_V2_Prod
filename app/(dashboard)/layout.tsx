import dynamic from "next/dynamic";
import { requireUser } from "@/lib/auth";
import { OCCSidebar } from "@/components/occ-dashboard/OCCSidebar";
import { OCCHeader } from "@/components/occ-dashboard/OCCHeader";
import { headers, cookies } from "next/headers";
import { verifyAuthToken } from "@/lib/jwt";
import { isLegitIndianMobile } from "@/lib/phone-utils";

const DashboardPageTransition = dynamic(
  () =>
    import("@/components/occ-dashboard/DashboardPageTransition").then(
      (m) => m.DashboardPageTransition,
    ),
  { ssr: true },
);
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const path = headers().get("next-url") ?? "/dashboard";

  const { redirect } = await import("next/navigation");

  if (!user.onboardingComplete) {
    redirect("/onboarding");
  }

  if (!isLegitIndianMobile(user.phoneNumber)) {
    const token = cookies().get("occ-token")?.value;
    let provider: string | undefined;
    if (token) {
      try {
        const jwtPayload = await verifyAuthToken(token);
        provider = jwtPayload.provider;
      } catch { /* token unreadable — fall through to default */ }
    }
    redirect(provider === "google" ? "/onboarding" : "/update-phone");
  }

  return (
    <div className="dashboard-page-zoom flex min-h-screen bg-[#F6F7FA] font-sans tracking-normal text-black overflow-hidden select-none antialiased [font-family:system-ui,-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif]">
      {/* Unified Navigation - Handles Sidebar & Bottom Nav */}
      <OCCSidebar activePath={path} />
      
      {/* Main Content Area */}
      <div className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <OCCHeader user={user} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 xl:px-10 pb-24 lg:pb-12 pt-4 bg-[#F6F7FA]">
          <div className="mx-auto w-full max-w-[1400px]">
            <DashboardPageTransition>{children}</DashboardPageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}

