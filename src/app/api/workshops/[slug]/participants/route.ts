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
    participants: list.map((p) => ({ id: p.id, loginId: p.loginId, displayName: p.displayName, hasPin: !!p.pinHash, projectCount: p._count.projects, createdAt: p.createdAt })),
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
