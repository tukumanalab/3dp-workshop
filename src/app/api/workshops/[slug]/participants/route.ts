import { NextResponse } from "next/server";
import { canViewWorkshop, isWorkshopStaff } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { BULK_MAX, registerParticipants, type ParticipantInput } from "@/lib/participants";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!isWorkshopStaff(w, viewer)) return forbidden();
  const list = await prisma.participant.findMany({
    where: { workshopId: w.id, deletedAt: null },
    orderBy: { id: "asc" },
    include: { _count: { select: { projects: true } } },
  });
  return NextResponse.json({
    participants: list.map((p) => ({ id: p.id, loginId: p.loginId, displayName: p.displayName, hasPin: !!p.pinHash, projectCount: p._count.projects, createdAt: p.createdAt, lastAccessAt: p.lastAccessAt })),
  });
}

/** POST { participants: [{ displayName, loginId?, pin? }] } → staff による事前登録（個別・一括） */
export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!isWorkshopStaff(w, viewer)) return forbidden();
  const body = await readJson<{ participants?: unknown }>(req);
  if (!body || !Array.isArray(body.participants) || body.participants.length === 0) return jsonError("リクエストが不正です", 400);
  if (body.participants.length > BULK_MAX) return jsonError(`一度に登録できるのは ${BULK_MAX} 人までです`, 400);
  const rows = body.participants.map((r) => (r && typeof r === "object" ? (r as ParticipantInput) : {}));
  return NextResponse.json(await registerParticipants(w.id, rows));
}

/** DELETE { ids: [1, 2, ...] } → 参加者をまとめて削除する（単体の削除と同じく論理削除。作品は残る）。 */
export async function DELETE(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!isWorkshopStaff(w, viewer)) return forbidden();
  const body = await readJson<{ ids?: unknown }>(req);
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id))) return jsonError("リクエストが不正です", 400);
  if (ids.length > BULK_MAX) return jsonError(`一度に削除できるのは ${BULK_MAX} 人までです`, 400);
  const r = await prisma.participant.updateMany({
    where: { id: { in: ids as number[] }, workshopId: w.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true, deleted: r.count });
}
