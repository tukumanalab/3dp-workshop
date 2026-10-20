import { NextResponse } from "next/server";
import { canViewProject } from "@/lib/access";
import { isProjectVisible, loadProjectContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { thumbnailUrl } from "@/lib/gallery";
import { notFound } from "@/lib/http";
import { viewerFromRequest } from "@/lib/viewer";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const viewer = await viewerFromRequest(req);
  const ctx = await loadProjectContext(id);
  if (!ctx || !isProjectVisible(ctx, viewer)) return notFound();
  const children = await prisma.project.findMany({
    where: { isRemixOfUid: ctx.project.uid, workshopId: ctx.workshop.id },
    include: { session: true, participant: { select: { displayName: true } }, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const remixes = children
    .filter((c) => canViewProject(ctx.workshop, c.session, c, viewer))
    .map((c) => ({
      id: c.uid,
      title: c.title,
      authorName: c.participant?.displayName ?? c.user?.name ?? "",
      thumbnailUrl: c.hasThumbnail ? thumbnailUrl(c.uid, c.headVersionTs) : null,
    }));
  return NextResponse.json({ remixes });
}
