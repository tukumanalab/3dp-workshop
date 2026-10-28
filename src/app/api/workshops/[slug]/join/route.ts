import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashSecret, verifySecret } from "@/lib/crypto";
import { loadWorkshopBySlug } from "@/lib/context";
import { jsonError, notFound, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { allocateLoginId, PIN_RE } from "@/lib/participants";
import { makeParticipantCookie } from "@/lib/session";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/**
 * 参加: { joinCode, displayName, pin? } → 新規参加者 (loginId は server が発行)
 *   ワークショップの joinCode が null（参加コードなし）なら joinCode は見ない
 * 再ログイン: { loginId, pin? }
 */
export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  if (!rateLimit(`join:${clientIp(req)}`, 20, 60_000)) return jsonError("試行回数が多すぎます。しばらく待ってください", 429);
  const w = await loadWorkshopBySlug(slug);
  if (!w) return notFound();
  const body = await readJson<{ joinCode?: string; displayName?: string; pin?: string; loginId?: string }>(req);
  if (!body) return jsonError("リクエストが不正です", 400);

  let participant;
  if (body.loginId) {
    const loginId = String(body.loginId).trim().toLowerCase();
    const p = await prisma.participant.findUnique({ where: { workshopId_loginId: { workshopId: w.id, loginId } } });
    const pin = body.pin ? String(body.pin) : "";
    if (!p || p.deletedAt || (p.pinHash && !verifySecret(pin, p.pinHash))) {
      return jsonError("ログイン ID または PIN が違います", 401);
    }
    participant = await prisma.participant.update({ where: { id: p.id }, data: { lastAccessAt: new Date() } });
  } else {
    const code = (body.joinCode ?? "").trim().toUpperCase();
    if (w.joinCode && code !== w.joinCode) return jsonError("参加コードが違います", 403);
    if (!w.isOpen) return jsonError("このワークショップは受付を終了しています", 403);
    const displayName = (body.displayName ?? "").trim();
    if (!displayName || displayName.length > 40) return jsonError("表示名を 1〜40 文字で入力してください", 400);
    if (body.pin !== undefined && body.pin !== "" && !PIN_RE.test(String(body.pin))) return jsonError("PIN は 4 桁の数字です", 400);
    const loginId = await allocateLoginId(w.id);
    participant = await prisma.participant.create({
      data: { workshopId: w.id, loginId, displayName, pinHash: body.pin ? hashSecret(String(body.pin)) : null, lastAccessAt: new Date() },
    });
  }

  const res = NextResponse.json({
    participant: { loginId: participant.loginId, displayName: participant.displayName, hasPin: !!participant.pinHash },
  });
  const c = await makeParticipantCookie({ participantId: participant.id, workshopId: w.id });
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
