import { attachStudentToReferralCode } from "@/lib/attach-referral";
import { DEFAULT_AVATAR_URL } from "@/lib/avatar";
import {
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  GOOGLE_OAUTH_FROM_COOKIE,
  GOOGLE_OAUTH_REDIRECT_COOKIE,
  GOOGLE_OAUTH_REFERRAL_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  oauthCallbackUrl,
} from "@/lib/google-oauth";
import { authCookieOptions, signAuthToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { STAFF_PUBLIC_PREFIX } from "@/lib/staff-paths";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { storeOAuthToken } from "@/lib/poll-store";
import { isLegitIndianMobile } from "@/lib/phone-utils";

const MOBILE_SCHEME = "OCC://google-auth";

function generateIndianPhoneNumber(): string {
  const first = [6, 7, 8, 9][Math.floor(Math.random() * 4)];
  const rest = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  return `${first}${rest}`;
}

function safeRedirectPath(path: string | null | undefined): string {
  if (path === "mobile") return "mobile";
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }
  return path.slice(0, 2000);
}

function postLoginDestination(
  user: { role: string; approvalStatus: string; onboardingComplete?: boolean; phoneNumber?: string | null; phoneVerified?: boolean },
  redirectCookie: string | undefined,
): string {
  const safe = safeRedirectPath(redirectCookie);

  // MOBILE BRIDGE: If the redirect cookie is "mobile", return the custom scheme
  if (safe === "mobile") {
    return MOBILE_SCHEME;
  }

  const hasLegitPhone = isLegitIndianMobile(user.phoneNumber);

  // Force onboarding if either flag is missing or phone is dummy or not verified in DB
  if (user.role === "STUDENT" && (user.onboardingComplete === false || !hasLegitPhone || !user.phoneVerified)) {
    return "/onboarding";
  }

  // Universal catch-all for missing phone (including Admins/Headers)
  if (!hasLegitPhone) {
    return "/onboarding";
  }

  if (safe !== "/dashboard") {
    return safe;
  }
  if (user.role === "ADMIN") {
    return STAFF_PUBLIC_PREFIX;
  }
  if (user.role === "CLUB_HEADER" && user.approvalStatus === "APPROVED") {
    return "/header/dashboard";
  }
  if (user.role === "CLUB_HEADER" && user.approvalStatus === "PENDING") {
    return "/pending";
  }
  return "/dashboard";
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  const url = req.nextUrl;
  const oauthError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const oauthFrom = req.cookies.get(GOOGLE_OAUTH_FROM_COOKIE)?.value;
  const authErrorBase = oauthFrom === "register" ? "/register" : "/login";

  // Extract CSRF part and encoded payload from state BEFORE defining failRedirect
  // State formats:
  //   web:              "{csrf}"
  //   mobile (poll):    "{csrf}:poll:{base64(pollKey)}"
  //   mobile (returnTo):  "{csrf}:{base64(returnTo)}"
  const stateParts = (state ?? "").split(":");
  const stateCsrf = stateParts[0] ?? "";
  const isPollMode = stateParts[1] === "poll";
  const pollKey = isPollMode ? (() => {
    try { return Buffer.from(stateParts[2] ?? "", "base64").toString("utf-8"); } catch { return ""; }
  })() : "";

  // Legacy returnTo mode
  const stateEncodedReturn = !isPollMode && stateParts.length > 1 ? stateParts[1] : null;
  let stateDecodedReturnUrl: string | null = null;
  if (stateEncodedReturn) {
    try {
      stateDecodedReturnUrl = Buffer.from(stateEncodedReturn, "base64").toString("utf-8");
    } catch { /* ignore */ }
  }

  const isMobileFlow = isPollMode || (!!stateDecodedReturnUrl && (
    stateDecodedReturnUrl.startsWith("exp://") ||
    stateDecodedReturnUrl.startsWith("OCC://") ||
    stateDecodedReturnUrl.startsWith("occ://")
  ));

  console.log(`[GOOGLE CALLBACK] isPollMode: ${isPollMode}, pollKey: ${pollKey || '(none)'}, isMobile: ${isMobileFlow}`);

  // For mobile: failRedirect sends user BACK to the app with an error, not the website
  const failRedirect = (message: string) => {
    let destination: string;
    if (isMobileFlow && stateDecodedReturnUrl) {
      destination = `${stateDecodedReturnUrl}${stateDecodedReturnUrl.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`;
    } else {
      destination = new URL(`${authErrorBase}?error=${encodeURIComponent(message)}`, req.url).toString();
    }
    const res = NextResponse.redirect(destination);
    res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    res.cookies.delete(GOOGLE_OAUTH_REDIRECT_COOKIE);
    res.cookies.delete(GOOGLE_OAUTH_REFERRAL_COOKIE);
    res.cookies.delete(GOOGLE_OAUTH_FROM_COOKIE);
    return res;
  };

  if (oauthError) {
    return failRedirect("Google sign-in was cancelled or failed");
  }
  if (!code || !state) {
    return failRedirect("Missing OAuth parameters");
  }
  if (!clientId || !clientSecret) {
    return failRedirect("Google OAuth is not configured on the server");
  }

  const cookieState = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const redirectCookie = req.cookies.get(GOOGLE_OAUTH_REDIRECT_COOKIE)?.value;

  // CSRF cookie validation — but on mobile (iOS) ASWebAuthenticationSession uses an ephemeral
  // cookie store, so the cookie set during /google/start may not be received here.
  // For mobile flows: if the state itself encodes a valid mobile return URL, we trust the state.
  const csrfValid = cookieState && cookieState.split(":")[0] === stateCsrf;
  const mobileStateTrusted = isMobileFlow && stateDecodedReturnUrl;
  // Poll mode is trusted by design — it doesn't set cookies (mobile ephemeral session)
  // and the token is only delivered via polling with the same pollKey
  const pollModeTrusted = isPollMode && !!pollKey;

  if (!csrfValid && !mobileStateTrusted && !pollModeTrusted) {
    console.warn(`[GOOGLE CALLBACK] CSRF fail — cookieState: ${cookieState}, stateCsrf: ${stateCsrf}, isMobile: ${isMobileFlow}, isPoll: ${isPollMode}`);
    return failRedirect("Invalid session. Please try signing in again.");
  }

  // Recover mobileReturnTo — prefer cookie (web flow) then decoded state (mobile flow)
  const recoveredMobileReturn = req.cookies.get("mobile-return-to")?.value || stateDecodedReturnUrl || null;
  if (recoveredMobileReturn) {
    console.log(`[GOOGLE CALLBACK] mobileReturnTo resolved: ${recoveredMobileReturn}`);
  }

  const redirectUri = oauthCallbackUrl(req);

  let access_token: string;
  try {
    ({ access_token } = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    }));
  } catch (e) {
    console.error("[auth/google/callback] token exchange", e);
    return failRedirect("Could not complete Google sign-in");
  }

  let googleUser: Awaited<ReturnType<typeof fetchGoogleUserInfo>>;
  try {
    googleUser = await fetchGoogleUserInfo(access_token);
  } catch (e) {
    console.error("[auth/google/callback] userinfo", e);
    return failRedirect("Could not read Google profile");
  }

  if (!googleUser.email) {
    return failRedirect("Google did not return an email address");
  }

  const email = googleUser.email.toLowerCase().trim();
  const fullNameFromGoogle =
    googleUser.name?.trim() || email.split("@")[0] || "OCC Member";

  let user = await prisma.user.findUnique({
    where: { email },
  });

  let createdViaGoogle = false;

  if (!user) {
    createdViaGoogle = true;
    const randomPassword = crypto.randomBytes(48).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 12);

    try {
      user = await prisma.user.create({
        data: {
          fullName: fullNameFromGoogle,
          collegeName: "Not specified",
          phoneNumber: null, // Allow user to update manually
          email,
          password: hashedPassword,
          avatar: googleUser.picture ?? null,
          emailVerified: new Date(),
          role: "STUDENT",
        },
      });
    } catch (e) {
      console.error("[auth/google/callback] create user", e);
      return failRedirect("Could not create account");
    }
  } else {
    if (user.suspended) {
      return failRedirect("Account suspended");
    }

    const updates: {
      avatar?: string | null;
      emailVerified?: Date;
    } = {};

    const pic = googleUser.picture?.trim();
    if (pic && (!user.avatar || user.avatar === DEFAULT_AVATAR_URL)) {
      updates.avatar = pic;
    }
    if (!user.emailVerified) {
      updates.emailVerified = new Date();
    }

    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updates,
      });
    }
  }

  const referralCookie = req.cookies.get(GOOGLE_OAUTH_REFERRAL_COOKIE)?.value?.trim() ?? "";

  if (createdViaGoogle && referralCookie.length >= 3) {
    const attached = await attachStudentToReferralCode({
      studentId: user.id,
      studentFullName: user.fullName,
      studentCollegeName: user.collegeName,
      codeRaw: referralCookie,
    });
    if (attached.ok) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          onboardingComplete: true,
          referralSource: "Google registration",
        },
      });
    }
  }

  const token = await signAuthToken({
    userId: user.id,
    email: user.email,
    role: user.role as "ADMIN" | "CLUB_HEADER" | "STUDENT",
    approvalStatus: user.approvalStatus as "PENDING" | "APPROVED" | "REJECTED",
    suspended: user.suspended,
    onboardingComplete: user.onboardingComplete,
    phoneVerified: user.phoneVerified,
    hasPhone: isLegitIndianMobile(user.phoneNumber),
  });

  const mobileReturnCookie = recoveredMobileReturn;
  const redirectCookieVal = req.cookies.get(GOOGLE_OAUTH_REDIRECT_COOKIE)?.value;

  console.log(`[GOOGLE CALLBACK] User: ${user.email} | isPollMode: ${isPollMode} | pollKey: ${pollKey || 'none'}`);

  // === POLL MODE: Store token server-side, let app poll for it ===
  if (isPollMode && pollKey) {
    await storeOAuthToken(pollKey, token, user.email);
    console.log(`[GOOGLE CALLBACK] Token stored for polling, key: ${pollKey}`);

    // Check if the user is on mobile by looking at the user agent or if they requested OCC://
    // We will redirect back to the custom scheme to force the browser window to close seamlessly!
    const res = NextResponse.redirect("OCC://google-auth");
    res.cookies.set("occ-token", token, authCookieOptions);
    res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    res.cookies.delete(GOOGLE_OAUTH_REDIRECT_COOKIE);
    return res;
  }

  // === LEGACY MOBILE MODE: redirect to returnTo URL ===
  if (mobileReturnCookie) {
    const connector = mobileReturnCookie.includes("?") ? "&" : "?";
    const finalDestination = `${mobileReturnCookie}${connector}token=${token}`;
    console.log(`[GOOGLE CALLBACK] Legacy mobile redirect: ${finalDestination}`);
    const res = NextResponse.redirect(finalDestination);
    res.cookies.set("occ-token", token, authCookieOptions);
    res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    res.cookies.delete(GOOGLE_OAUTH_REDIRECT_COOKIE);
    res.cookies.delete("mobile-return-to");
    return res;
  }

  const destination = postLoginDestination(
    { 
      role: user.role, 
      approvalStatus: user.approvalStatus, 
      onboardingComplete: user.onboardingComplete,
      phoneNumber: user.phoneNumber,
      phoneVerified: user.phoneVerified
    },
    redirectCookieVal,
  );

  console.log(`[GOOGLE CALLBACK] Web/Fallback destination: ${destination}`);

  const isCustomScheme = destination.startsWith("OCC://") ||
    destination.startsWith("exp://") ||
    destination.includes("token=");

  const res = isCustomScheme
    ? NextResponse.redirect(`${destination}${destination.includes('?') ? '&' : '?'}token=${token}`)
    : NextResponse.redirect(new URL(destination, req.url));

  res.cookies.set("occ-token", token, authCookieOptions);
  res.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  res.cookies.delete(GOOGLE_OAUTH_REDIRECT_COOKIE);
  res.cookies.delete(GOOGLE_OAUTH_REFERRAL_COOKIE);
  res.cookies.delete(GOOGLE_OAUTH_FROM_COOKIE);
  return res;
}
