import { NextResponse } from "next/server";
import { canViewWorkshop, isWorkshopStaff } from "@/lib/access";
import { loadWorkshopBySlug } from "@/lib/context";
import { prisma } from "@/lib/db";
import { forbidden, notFound } from "@/lib/http";
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
