import { NextResponse } from "next/server";
import { canViewWorkshop, isWorkshopStaff } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, jsonError, notFound, readJson } from "@/lib/http";
import { MaterialError, deleteMaterial, serializeMaterial, updateMaterial } from "@/lib/materials";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string; materialId: string }> };

async function load(req: Request, ctx: Ctx) {
  const { slug, materialId } = await ctx.params;
  const viewer = await viewerFromRequest(req);
  const w = await loadWorkshopBySlug(slug);
  if (!w || !canViewWorkshop(w, viewer)) return { error: notFound() } as const;
  if (!isWorkshopStaff(w, viewer)) return { error: forbidden() } as const;
  const m = await prisma.material.findFirst({ where: { id: Number(materialId) || -1, workshopId: w.id } });
  if (!m) return { error: notFound() } as const;
  return { slug, m } as const;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if (r.error) return r.error;
  const body = await readJson<Record<string, unknown>>(req);
  if (!body) return jsonError("リクエストが不正です", 400);
  try {
    const m = await updateMaterial(r.m, body);
    return NextResponse.json({ material: serializeMaterial(r.slug, m) });
  } catch (e) {
    if (e instanceof MaterialError) return jsonError(e.message, e.status);
    throw e;
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const r = await load(req, ctx);
  if (r.error) return r.error;
  await deleteMaterial(r.m);
  return NextResponse.json({ ok: true });
}
