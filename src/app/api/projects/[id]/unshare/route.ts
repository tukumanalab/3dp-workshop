import { NextResponse } from "next/server";
import { canManageProject } from "@/lib/access";
import { isProjectVisible, loadProjectContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, notFound } from "@/lib/http";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const viewer = await viewerFromRequest(req);
  const ctx = await loadProjectContext(id);
  if (!ctx || !isProjectVisible(ctx, viewer)) return notFound();
  if (!canManageProject(ctx.workshop, ctx.project, viewer)) return forbidden();
  await prisma.project.update({ where: { id: ctx.project.id }, data: { isShared: false } });
  return NextResponse.json({ ok: true, isShared: false });
}
