import { NextResponse } from "next/server";
import { canViewWorkshop, isWorkshopStaff } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/** PATCH { ids: [...] } → ワークショップの全セッションを ids の順に並べ替える（order に添字を書く） */
export async function PATCH(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!isWorkshopStaff(w, viewer)) return forbidden();
  const body = await readJson<{ ids?: unknown }>(req);
  const ids = Array.isArray(body?.ids) ? body.ids : null;
  const current = await prisma.session.findMany({ where: { workshopId: w.id }, select: { id: true } });
  const same =
    ids !== null &&
    ids.length === current.length &&
    new Set(ids).size === ids.length &&
    current.every((s) => ids.includes(s.id));
  if (!same) return jsonError("セッションの並びが不正です", 400);
  await prisma.$transaction(ids.map((id, order) => prisma.session.update({ where: { id: id as number }, data: { order } })));
  return NextResponse.json({ ok: true });
}
