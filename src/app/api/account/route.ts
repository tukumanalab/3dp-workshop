import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, unauthorized } from "@/lib/http";
import { S } from "@/lib/strings";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";

/** ログイン中のユーザー（サイト管理者・開催者）が自分の表示名を変更する。 */
export async function PATCH(req: Request) {
  const viewer = await viewerFromRequest(req);
  if (!viewer.user) return unauthorized();
  const body = await readJson<{ name?: unknown }>(req);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) return jsonError(S.account.errors.invalidName, 400);
  const user = await prisma.user.update({
    where: { id: viewer.user.userId },
    data: { name },
    select: { id: true, email: true, name: true, role: true },
  });
  return NextResponse.json({ user });
}
