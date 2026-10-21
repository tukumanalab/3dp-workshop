import { NextResponse } from "next/server";
import { isWorkshopVisibility } from "@/lib/access";
import { requireSiteAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/db";
import { jsonError, notFound, readJson } from "@/lib/http";
import { deleteWorkshopWithFiles } from "@/lib/workshops";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

/** 受け付けるのは visibility と isOpen だけ（中身の編集は staff の仕事）。 */
export async function PATCH(req: Request, { params }: Ctx) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  const { slug } = await params;
  const w = await prisma.workshop.findUnique({ where: { slug } });
  if (!w) return notFound();
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  const data: { visibility?: string; isOpen?: boolean } = {};
  if (body.visibility !== undefined) {
    if (!isWorkshopVisibility(body.visibility)) return jsonError("公開範囲が不正です", 400);
    data.visibility = body.visibility;
  }
  if (typeof body.isOpen === "boolean") data.isOpen = body.isOpen;
  const updated = await prisma.workshop.update({ where: { id: w.id }, data });
  return NextResponse.json({ workshop: { slug: updated.slug, visibility: updated.visibility, isOpen: updated.isOpen } });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  const { slug } = await params;
  const w = await prisma.workshop.findUnique({ where: { slug } });
  if (!w) return notFound();
  await deleteWorkshopWithFiles(w.id);
  return NextResponse.json({ ok: true });
}
