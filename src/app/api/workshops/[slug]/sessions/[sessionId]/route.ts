import { NextResponse } from "next/server";
import { canViewWorkshop, isSessionVisibility, isWorkshopStaff } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { materialFileUids, removeMaterialFiles } from "@/lib/materials";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string; sessionId: string }> };

async function load(req: Request, ctx: Ctx) {
  const { slug, sessionId } = await ctx.params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return { error: notFound() } as const;
  if (!isWorkshopStaff(w, viewer)) return { error: forbidden() } as const;
  const session = await prisma.session.findFirst({ where: { id: Number(sessionId) || -1, workshopId: w.id } });
  if (!session) return { error: notFound() } as const;
  return { w, session } as const;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if (r.error) return r.error;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (!n || n.length > 60) return jsonError("セッション名が不正です", 400);
    data.name = n;
  }
  if (body.visibility !== undefined) {
    if (!isSessionVisibility(body.visibility)) return jsonError("公開範囲が不正です", 400);
    data.visibility = body.visibility;
  }
  if (typeof body.defaultShared === "boolean") data.defaultShared = body.defaultShared;
  if (typeof body.order === "number" && Number.isInteger(body.order)) data.order = body.order;
  const s = await prisma.session.update({ where: { id: r.session.id }, data });
  return NextResponse.json({ session: s });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if (r.error) return r.error;
  const count = await prisma.project.count({ where: { sessionId: r.session.id } });
  if (count > 0) return jsonError("作品が残っているセッションは削除できません", 409);
  const sessions = await prisma.session.count({ where: { workshopId: r.w.id } });
  if (sessions <= 1) return jsonError("最後のセッションは削除できません", 409);
  const materials = await materialFileUids({ sessionId: r.session.id });
  await prisma.session.delete({ where: { id: r.session.id } });
  await removeMaterialFiles(materials);
  return NextResponse.json({ ok: true });
}
