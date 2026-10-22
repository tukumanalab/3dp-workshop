import { NextResponse } from "next/server";
import { canViewWorkshop, isWorkshopStaff } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound } from "@/lib/http";
import { MaterialError, createMaterialFromRequest, listVisibleMaterials, serializeMaterial } from "@/lib/materials";
import { viewerFromRequest } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  const sessions = await prisma.session.findMany({ where: { workshopId: w.id } });
  const list = await listVisibleMaterials(w, sessions, viewer);
  return NextResponse.json({ materials: list.map((m) => serializeMaterial(slug, m)) });
}

/** POST multipart(file, title, sessionId?, audience?) | JSON { title, url, sessionId?, audience? }（staff のみ） */
export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return notFound();
  if (!isWorkshopStaff(w, viewer)) return forbidden();
  try {
    const m = await createMaterialFromRequest(w.id, req);
    return NextResponse.json({ material: serializeMaterial(slug, m) });
  } catch (e) {
    if (e instanceof MaterialError) return jsonError(e.message, e.status);
    throw e;
  }
}
