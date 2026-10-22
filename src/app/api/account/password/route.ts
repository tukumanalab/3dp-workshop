import { NextResponse } from "next/server";
import { config } from "@/lib/env";
import { prisma } from "@/lib/db";
import { hashSecret, verifySecret } from "@/lib/crypto";
import { jsonError, readJson, unauthorized } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { S } from "@/lib/strings";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;

/**
 * 自分のパスワードを変更する。既にパスワードがある場合は現在のパスワードが必要。
 * Google ログインのみでパスワード未設定のユーザーは、現在のパスワードなしで新規設定できる。
 */
export async function POST(req: Request) {
  if (!config.passwordLoginEnabled) return jsonError(S.account.errors.disabled, 404);
  const viewer = await viewerFromRequest(req);
  if (!viewer.user) return unauthorized();
  if (!rateLimit(`pwchange:${viewer.user.userId}`, 10, 60_000)) return jsonError(S.account.errors.rateLimited, 429);
  const body = await readJson<{ currentPassword?: unknown; newPassword?: unknown }>(req);
  const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (next.length < PASSWORD_MIN) return jsonError(S.account.errors.tooShort, 400);
  if (next.length > PASSWORD_MAX) return jsonError(S.account.errors.tooLong, 400);

  const user = await prisma.user.findUnique({ where: { id: viewer.user.userId }, select: { id: true, passwordHash: true } });
  if (!user) return unauthorized();
  if (user.passwordHash) {
    if (!current) return jsonError(S.account.errors.currentRequired, 400);
    if (!verifySecret(current, user.passwordHash)) return jsonError(S.account.errors.currentWrong, 400);
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashSecret(next) } });
  return NextResponse.json({ ok: true });
}
