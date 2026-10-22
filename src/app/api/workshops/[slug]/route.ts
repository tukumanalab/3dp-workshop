import { NextResponse } from "next/server";
import { canViewSession, canViewWorkshop, isWorkshopOwner, isWorkshopStaff, isWorkshopVisibility } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { deleteWorkshopWithFiles, serializeWorkshop } from "@/lib/workshops";
import { newJoinCode } from "@/lib/crypto";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  const sessions = await prisma.session.findMany({ where: { workshopId: w.id }, orderBy: [{ order: "asc" }, { id: "asc" }] });
  return NextResponse.json({
    workshop: serializeWorkshop(w, viewer),
    sessions: sessions.filter((s) => canViewSession(w, s, viewer)),
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!isWorkshopStaff(w, viewer)) return forbidden();
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t || t.length > 100) return jsonError("タイトルが不正です", 400);
    data.title = t;
  }
  if (typeof body.description === "string") data.description = body.description.slice(0, 2000);
  if (body.visibility !== undefined) {
    if (!isWorkshopVisibility(body.visibility)) return jsonError("公開範囲が不正です", 400);
    data.visibility = body.visibility;
  }
  if (typeof body.isOpen === "boolean") data.isOpen = body.isOpen;
  if (body.regenerateJoinCode === true) data.joinCode = newJoinCode();
  const updated = await prisma.workshop.update({ where: { id: w.id }, data, include: { staff: true } });
  return NextResponse.json({ workshop: serializeWorkshop(updated, viewer) });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!isWorkshopOwner(w, viewer)) return forbidden();
  await deleteWorkshopWithFiles(w.id);
  return NextResponse.json({ ok: true });
}
