import { NextResponse } from "next/server";
import { decodeIdToken } from "arctic";
import { emailAllowed, googleClient } from "@/lib/auth";
import { config } from "@/lib/env";
import { prisma } from "@/lib/db";
import { OAUTH_STATE_COOKIE, makeUserCookie, parseCookieHeader, verifyToken } from "@/lib/session";

export const dynamic = "force-dynamic";

function back(path: string, error?: string) {
  const u = new URL(`${config.appOrigin}${config.basePath}${path}`);
  if (error) u.searchParams.set("error", error);
  return NextResponse.redirect(u.toString());
}

export async function GET(req: Request) {
  const google = googleClient();
  if (!google) return back("/login", "oauth_unconfigured");
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = parseCookieHeader(req.headers.get("cookie"));
  const saved = await verifyToken<{ state: string; verifier: string; next: string }>(jar[OAUTH_STATE_COOKIE]);
  if (!code || !state || !saved || saved.state !== state) return back("/login", "oauth_state");

  let claims: { sub?: string; email?: string; name?: string; email_verified?: boolean };
  try {
    const tokens = await google.validateAuthorizationCode(code, saved.verifier);
    claims = decodeIdToken(tokens.idToken()) as typeof claims;
  } catch {
    return back("/login", "oauth_failed");
  }
  const email = claims.email?.toLowerCase();
  if (!email || !claims.sub || claims.email_verified === false) return back("/login", "oauth_email");
  if (!emailAllowed(email)) return back("/login", "email_not_allowed");

  let user = await prisma.user.findFirst({ where: { OR: [{ googleSub: claims.sub }, { email }] } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name: claims.name || email.split("@")[0]!, googleSub: claims.sub, role: "organizer" } });
  } else if (!user.googleSub) {
    user = await prisma.user.update({ where: { id: user.id }, data: { googleSub: claims.sub } });
  }
  if (user.status !== "APPROVED") return back("/login", "suspended");

  const res = NextResponse.redirect(`${config.appOrigin}${config.basePath}${saved.next || "/dashboard"}`);
  const c = await makeUserCookie({ userId: user.id, role: user.role });
  res.cookies.set(c.name, c.value, c.options);
  res.cookies.delete({ name: OAUTH_STATE_COOKIE, path: config.basePath });
  return res;
}
