import { NextResponse } from "next/server";
import { generateCodeVerifier, generateState } from "arctic";
import { googleClient, safeNext } from "@/lib/auth";
import { OAUTH_STATE_COOKIE, cookieOptions, signToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const google = googleClient();
  if (!google) return NextResponse.json({ error: "Google OAuth が設定されていません" }, { status: 503 });
  const state = generateState();
  const verifier = generateCodeVerifier();
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const url = google.createAuthorizationURL(state, verifier, ["openid", "email", "profile"]);
  const res = NextResponse.redirect(url.toString());
  res.cookies.set(OAUTH_STATE_COOKIE, await signToken({ state, verifier, next }, 600), cookieOptions(600));
  return res;
}
