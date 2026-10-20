import { NextResponse } from "next/server";
import { canViewSession, canViewWorkshop, isSessionVisibility, isWorkshopStaff } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  const sessions = await prisma.session.findMany({ where: { workshopId: w.id }, orderBy: [{ order: "asc" }, { id: "asc" }] });
  return NextResponse.json({ sessions: sessions.filter((s) => canViewSession(w, s, viewer)) });
}

export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!isWorkshopStaff(w, viewer)) return forbidden();
  const body = await readJson<{ name?: string; visibility?: string; defaultShared?: boolean }>(req);
  const name = (body?.name ?? "").trim();
  if (!name || name.length > 60) return jsonError("セッション名を 1〜60 文字で入力してください", 400);
  if (body?.visibility !== undefined && !isSessionVisibility(body.visibility)) return jsonError("公開範囲が不正です", 400);
  const max = await prisma.session.aggregate({ where: { workshopId: w.id }, _max: { order: true } });
  const s = await prisma.session.create({
    data: {
      workshopId: w.id,
      name,
      visibility: body?.visibility ?? "PUBLIC",
      defaultShared: body?.defaultShared === true,
      order: (max._max.order ?? -1) + 1,
    },
  });
  return NextResponse.json({ session: s }, { status: 201 });
}
