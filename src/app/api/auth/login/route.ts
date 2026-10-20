import { NextResponse } from "next/server";
import { config } from "@/lib/env";
import { prisma } from "@/lib/db";
import { verifySecret } from "@/lib/crypto";
import { jsonError, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { makeUserCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 開発・管理用のパスワードログイン (PASSWORD_LOGIN_ENABLED=true のときのみ)。 */
export async function POST(req: Request) {
  if (!config.passwordLoginEnabled) return jsonError("パスワードログインは無効です", 404);
  if (!rateLimit(`pwlogin:${clientIp(req)}`, 10, 60_000)) return jsonError("試行回数が多すぎます。しばらく待ってください", 429);
  const body = await readJson<{ email?: string; password?: string }>(req);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  if (!email || !password) return jsonError("メールアドレスとパスワードを入力してください", 400);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "APPROVED" || !verifySecret(password, user.passwordHash)) {
    return jsonError("メールアドレスまたはパスワードが違います", 401);
  }
  const res = NextResponse.json({ ok: true });
  const c = await makeUserCookie({ userId: user.id, role: user.role });
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
