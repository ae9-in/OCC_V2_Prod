import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/jwt";
import { staffGateHref, STAFF_PUBLIC_PREFIX, ADMIN_CP_PREFIX } from "@/lib/staff-paths";

// ── Security: sensitive file patterns that must NEVER be served ──
const BLOCKED_FILES = /(\.env|\.git|\.git\/|package\.json|package-lock\.json|pnpm-lock\.yaml)$/i;
const BUILD_MANIFEST_PATTERN = /_buildManifest\.js$/;

const PROTECTED_PATHS = [
  "/dashboard",
  "/clubs",
  "/events",
  "/gigs",
  "/profile",
  "/explore",
  "/notifications",
  "/e-clubs",
];

function isSharedPostPath(pathname: string) {
  return pathname === "/p" || pathname.startsWith("/p/");
}
const AUTH_PATHS = ["/login", "/register", "/club-header/login", "/club-header/register"];

function isStaffGatePath(pathname: string) {
  const publicGate = `${STAFF_PUBLIC_PREFIX}/gate`;
  return (
    pathname === publicGate || 
    pathname.startsWith(`${publicGate}/`) ||
    pathname === "/staff-gate-internal" ||
    pathname.startsWith("/staff-gate-internal/")
  );
}

function isStaffPanelPath(pathname: string) {
  if (isStaffGatePath(pathname)) return false;
  return (
    pathname === STAFF_PUBLIC_PREFIX || 
    pathname.startsWith(`${STAFF_PUBLIC_PREFIX}/`) ||
    pathname === "/staff-panel-internal" ||
    pathname.startsWith("/staff-panel-internal/")
  );
}

function isLegacyAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isInternalStaffPath(pathname: string) {
  return (
    pathname.startsWith("/staff-panel-internal") ||
    pathname.startsWith("/staff-gate-internal") ||
    pathname.startsWith("/admin-control-panel-internal")
  );
}

function isAdminCPPath(pathname: string) {
  return (
    pathname === ADMIN_CP_PREFIX ||
    pathname.startsWith(`${ADMIN_CP_PREFIX}/`) ||
    pathname === "/admin-control-panel-internal" ||
    pathname.startsWith("/admin-control-panel-internal/")
  );
}

function isAdminApiPath(pathname: string) {
  return (
    pathname === "/api/admin-cp" ||
    pathname.startsWith("/api/admin-cp/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

function isClubHeaderApiPath(pathname: string) {
  return pathname === "/api/club-header" || pathname.startsWith("/api/club-header/");
}

function isMutationMethod(method: string) {
  return method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
}

function originMatchesRequestHost(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const requestHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  return originHost.toLowerCase() === requestHost.toLowerCase();
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("occ-token")?.value;
  const { pathname, search } = req.nextUrl;
  const reauthRequested = req.nextUrl.searchParams.get("reauth") === "1";

  // ── P1 FIX: Block _buildManifest.js to prevent internal route leaking ──
  if (BUILD_MANIFEST_PATTERN.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // ── P1 FIX: Block .env, .git, package.json from ever being served ──
  if (BLOCKED_FILES.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // Strict CSRF guard for privileged mutation APIs.
  if (
    isMutationMethod(req.method) &&
    (isAdminApiPath(pathname) || isClubHeaderApiPath(pathname))
  ) {
    if (!originMatchesRequestHost(req)) {
      return NextResponse.json({ error: "Forbidden (CSRF)" }, { status: 403 });
    }
  }

  if (isLegacyAdminPath(pathname) || isInternalStaffPath(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  // Extra gate for admin APIs: hide endpoints from unauthenticated/non-admin callers.
  if (isAdminApiPath(pathname)) {
    if (!token) return new NextResponse(null, { status: 404 });
    try {
      const payload = await verifyAuthToken(token);
      if (payload.role !== "ADMIN" || payload.suspended) {
        return new NextResponse(null, { status: 404 });
      }
      return NextResponse.next();
    } catch {
      const response = new NextResponse(null, { status: 404 });
      response.cookies.delete("occ-token");
      return response;
    }
  }

  const isProtected =
    PROTECTED_PATHS.some((path) => pathname.startsWith(path)) || isSharedPostPath(pathname);
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));
  const isStaffPanel = isStaffPanelPath(pathname);
  const isAdminCP = isAdminCPPath(pathname);
  const isStaffGate = isStaffGatePath(pathname);
  const isHeaderPath = pathname.startsWith("/header");
  const isPendingPath = pathname.startsWith("/pending");
  const isOnboardingPath = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const isUpdatePhonePath = pathname === "/update-phone" || pathname.startsWith("/update-phone/");
  const requiresAuth = isProtected || isStaffPanel || isAdminCP || isHeaderPath || isPendingPath;

  if (isOnboardingPath) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", "/onboarding");
      return NextResponse.redirect(loginUrl);
    }
    try {
      const payload = await verifyAuthToken(token);
      if (payload.suspended) {
        const loginUrl = new URL("/login", req.url);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete("occ-token");
        return response;
      }
      // Local users must never access /onboarding — they use /update-phone
      if (payload.provider === "local") {
        return NextResponse.redirect(
          payload.hasPhone === true
            ? new URL("/dashboard", req.url)
            : new URL("/update-phone", req.url),
        );
      }
      // Google users who already have phone and completed onboarding are done
      if (payload.hasPhone === true && payload.onboardingComplete !== false) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    } catch {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", "/onboarding");
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isUpdatePhonePath) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", "/update-phone");
      return NextResponse.redirect(loginUrl);
    }
    try {
      const payload = await verifyAuthToken(token);
      if (payload.suspended) {
        const loginUrl = new URL("/login", req.url);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete("occ-token");
        return response;
      }
      // Google users collect phone through /onboarding, not /update-phone
      if (payload.provider === "google") {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }
      // Already has phone — no reason to be here
      if (payload.hasPhone === true) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    } catch {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", "/update-phone");
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isStaffGate && token) {
    try {
      const payload = await verifyAuthToken(token);
      if (payload.role === "ADMIN") {
        return NextResponse.redirect(new URL(STAFF_PUBLIC_PREFIX, req.url));
      }
    } catch {
      /* fall through */
    }
  }

  if (requiresAuth) {
    if (!token) {
      // ── P1 FIX: Return 404 for staff/admin routes when unauthenticated ──
      // This hides the existence of admin routes from attackers.
      if (isStaffPanel || isAdminCP) {
        return new NextResponse(null, { status: 404 });
      }
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname + (search || ""));
      return NextResponse.redirect(loginUrl);
    }

    try {
      const payload = await verifyAuthToken(token);
      const role = payload.role;
      const status = payload.approvalStatus;

      if (payload.suspended) {
        const loginUrl = new URL("/login", req.url);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete("occ-token");
        return response;
      }

      // ── P1 FIX: Non-admin users get 404 on staff/admin routes ──
      if ((isStaffPanel || isAdminCP) && role !== "ADMIN") {
        return new NextResponse(null, { status: 404 });
      }

      if (isHeaderPath) {
        if (role !== "CLUB_HEADER") {
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }
        if (status === "PENDING") {
          return NextResponse.redirect(new URL("/pending", req.url));
        }
      }

      if (isPendingPath && role === "CLUB_HEADER" && status === "APPROVED") {
        return NextResponse.redirect(new URL("/header/dashboard", req.url));
      }

      // Provider-aware phone/onboarding guard
      const isGoogleUser =
        payload.provider === "google" ||
        (payload.provider === undefined && payload.onboardingComplete === false);

      if (isGoogleUser) {
        if (payload.onboardingComplete === false || payload.hasPhone !== true) {
          return NextResponse.redirect(new URL("/onboarding", req.url));
        }
      } else {
        // Local user (or legacy token with onboardingComplete: true)
        if (payload.hasPhone !== true) {
          return NextResponse.redirect(new URL("/update-phone", req.url));
        }
      }

      return NextResponse.next();
    } catch {
      // ── P1 FIX: Invalid token on staff/admin routes → 404 ──
      if (isStaffPanel || isAdminCP) {
        return new NextResponse(null, { status: 404 });
      }
      const loginUrl = new URL("/login", req.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("occ-token");
      return response;
    }
  }

  if (isAuthPath && reauthRequested) {
    const response = NextResponse.next();
    response.cookies.delete("occ-token");
    return response;
  }

  if (isAuthPath && token) {
    try {
      const payload = await verifyAuthToken(token);
      const role = payload.role;
      const approval = payload.approvalStatus;
      
      const requestedRedirect = req.nextUrl.searchParams.get("redirect");
      if (requestedRedirect && requestedRedirect.startsWith("/")) {
        return NextResponse.redirect(new URL(requestedRedirect, req.url));
      }

      if (role === "ADMIN") {
        return NextResponse.redirect(new URL(STAFF_PUBLIC_PREFIX, req.url));
      }
      if (role === "CLUB_HEADER" && approval === "APPROVED") {
        return NextResponse.redirect(new URL("/header/dashboard", req.url));
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    } catch {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

/**
 * Middleware matcher — covers auth routes, staff gates, admin panels,
 * AND security-sensitive paths (_buildManifest, .env, .git, etc.).
 */
export const config = {
  matcher: [
    "/login",
    "/register",
    "/onboarding",
    "/onboarding/:path*",
    "/club-header/:path*",
    "/dashboard/:path*",
    "/clubs/:path*",
    "/events/:path*",
    "/gigs/:path*",
    "/profile/:path*",
    "/explore",
    "/explore/:path*",
    "/notifications/:path*",
    "/e-clubs",
    "/e-clubs/:path*",
    "/header/:path*",
    "/pending/:path*",
    "/p",
    "/p/:path*",
    "/admin",
    "/admin/:path*",
    // Must match default NEXT_PUBLIC_OCC_STAFF_PREFIX; update both if you change the env prefix.
    "/k9xm2p7qv4nw8-stf",
    "/k9xm2p7qv4nw8-stf/:path*",
    "/k9xm2p7qv4nw8-admin-control-panel",
    "/k9xm2p7qv4nw8-admin-control-panel/:path*",
    "/api/admin/:path*",
    "/api/admin-cp/:path*",
    "/admin-control-panel-internal",
    "/admin-control-panel-internal/:path*",
    "/staff-gate-internal",
    "/staff-gate-internal/:path*",
    "/staff-panel-internal",
    "/staff-panel-internal/:path*",
    "/update-phone",
    // ── Security: block sensitive files ──
    "/.env",
    "/.env.local",
    "/.env.example",
    "/.git",
    "/.git/:path*",
    "/package.json",
    "/package-lock.json",
    "/pnpm-lock.yaml",
  ],
};
