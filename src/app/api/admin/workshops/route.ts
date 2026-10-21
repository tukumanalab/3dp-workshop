import { NextResponse } from "next/server";
import { isWorkshopVisibility } from "@/lib/access";
import { requireSiteAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await requireSiteAdmin(req);
  if ("response" in g) return g.response;
  const sp = new URL(req.url).searchParams;
  const q = (sp.get("q") ?? "").trim();
  const visibility = sp.get("visibility");
  const uid = g.viewer.user!.userId;
  const rows = await prisma.workshop.findMany({
    where: {
      ...(q ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }] } : {}),
      ...(isWorkshopVisibility(visibility) ? { visibility } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      staff: { select: { userId: true } },
      _count: { select: { participants: true, projects: true } },
    },
  });
  return NextResponse.json({
    workshops: rows.map((w) => ({
      slug: w.slug,
      title: w.title,
      visibility: w.visibility,
      isOpen: w.isOpen,
      createdAt: w.createdAt,
      owner: w.owner,
      participantCount: w._count.participants,
      projectCount: w._count.projects,
      isMember: w.ownerId === uid || w.staff.some((s) => s.userId === uid),
    })),
  });
}
